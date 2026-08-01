/**
 * Sync manager: replays queued mutations when online and pulls fresh data.
 * Listens for online/offline events and triggers sync automatically.
 */

import { createClient } from "@/utils/supabase/client"
import { getQueue, dequeue, setRetries, type QueuedMutation } from "./queue"
import { putAll, bulkPut, clearAllStores, setMeta, getMeta, getById, put, DATA_STORES, type DataStore } from "./db"

type SyncListener = (status: "syncing" | "synced" | "error" | "offline" | "online") => void

const listeners = new Set<SyncListener>()
let syncing = false
let lastSyncAttempt = 0
let retryTimer: ReturnType<typeof setTimeout> | null = null
let retryCount = 0
const SYNC_COOLDOWN = 5_000 // 5 seconds between sync attempts
const MAX_RETRIES = 3
const RETRY_DELAYS = [3_000, 8_000, 20_000] // escalating retry delays
// How many times a single mutation may fail to replay before we discard it.
// Prevents a permanently-rejected ("poison") mutation from blocking the queue
// — and pinning the sync badge — forever.
const MAX_REPLAY_ATTEMPTS = 3

export function onSyncStatus(fn: SyncListener): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

function notify(status: "syncing" | "synced" | "error" | "offline" | "online") {
  listeners.forEach(fn => fn(status))
}

/** Replay a single queued mutation against Supabase.
 *  "rejected" = the server actively refused it (PostgREST error with a code);
 *  "network" = the request never got a real answer (offline, captive portal).
 *  The distinction matters: only rejections may count toward dropping the
 *  mutation as poison — a flaky network must never destroy queued writes.
 */
async function replayMutation(
  m: QueuedMutation,
): Promise<{ status: "ok" | "rejected" | "network"; code?: string }> {
  const supabase = createClient()
  try {
    let query

    if (m.operation === "insert") {
      query = supabase.from(m.table).insert(m.data)
    } else if (m.operation === "update") {
      query = supabase.from(m.table).update(m.data)
      for (const [key, val] of Object.entries(m.match)) {
        query = query.eq(key, val as string)
      }
    } else if (m.operation === "delete") {
      query = supabase.from(m.table).delete()
      for (const [key, val] of Object.entries(m.match)) {
        query = query.eq(key, val as string)
      }
    } else if (m.operation === "upsert") {
      query = supabase.from(m.table).upsert(m.data, { onConflict: m.onConflict })
    }

    if (query) {
      const { error } = await query
      if (error) {
        console.error(`[sync] Failed to replay ${m.operation} on ${m.table}:`, error)
        // PostgREST rejections carry a non-empty string code; fetch failures
        // surfaced as error objects don't (mirrors isPermanentError in data.ts).
        const code = (error as { code?: unknown }).code
        return typeof code === "string" && code.length > 0
          ? { status: "rejected", code }
          : { status: "network" }
      }
    }
    return { status: "ok" }
  } catch {
    return { status: "network" }
  }
}

/** Replay all queued mutations in order.
 *  - On success: dequeue.
 *  - On failure: bump the retry counter. If it has now failed too many times it's
 *    treated as a "poison" mutation and dropped so it can't block the queue (and
 *    the sync badge) forever; otherwise we stop to preserve ordering and retry it
 *    on the next sync.
 */
export async function replayQueue(): Promise<{ success: number; failed: number; dropped: number }> {
  const queue = await getQueue()
  let success = 0
  let failed = 0
  let dropped = 0

  for (const mutation of queue) {
    let result = await replayMutation(mutation)

    // A queued transaction pointing at an account that was deleted elsewhere
    // fails the FK (23503). Dropping it as poison would destroy a real money
    // record — instead retry with the tag nulled, matching the FK's own
    // on-delete-set-null semantics (the row survives, merely unlinked).
    if (
      result.status === "rejected" &&
      result.code === "23503" &&
      mutation.table === "transactions" &&
      mutation.operation !== "delete" &&
      (mutation.data as { account_id?: unknown })?.account_id != null
    ) {
      const healed = { ...mutation, data: { ...mutation.data, account_id: null } }
      result = await replayMutation(healed)
      if (result.status === "ok") {
        // Mirror the unlink into the cache so the local row matches the server.
        const id =
          ((mutation.data as { id?: string }).id) ||
          ((mutation.match as { id?: string })?.id)
        if (id) {
          const cached = await getById<Record<string, unknown>>("transactions", id)
          if (cached) await put("transactions", { ...cached, account_id: null })
        }
      }
    }

    if (result.status === "ok") {
      await dequeue(mutation.queue_id)
      success++
      continue
    }

    if (result.status === "network") {
      // Connectivity problem, not a rejection — never counts toward poison.
      // Stop (preserving order) and let the next sync retry the whole queue.
      failed++
      break
    }

    const attempts = (mutation.retries ?? 0) + 1
    if (attempts >= MAX_REPLAY_ATTEMPTS) {
      // Poison mutation: the server keeps rejecting it. Drop it and move on so
      // the rest of the queue can sync instead of being blocked indefinitely —
      // but tell the user their change was discarded instead of doing it silently.
      console.warn(`[sync] Dropping mutation after ${attempts} rejected attempts:`, mutation)
      await dequeue(mutation.queue_id)
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("finboom:write-error", {
            detail: `An offline change to ${mutation.table} kept being rejected and was discarded`,
          }),
        )
      }
      dropped++
      continue
    }

    // Not exhausted yet — persist the bumped count, then stop to preserve order.
    await setRetries(mutation, attempts)
    failed++
    break
  }

  return { success, failed, dropped }
}

/** Pull fresh data from Supabase for a specific user and cache in IndexedDB.
 *  Uses delta sync: only fetches rows updated since the last sync per table.
 *  Falls back to full pull if no previous sync timestamp exists.
 */
// Per-table pull tweaks (ordering / row caps). Everything else uses defaults.
// `snapshots` keeps the most RECENT rows (descending) — the dashboard trend and
// "% from last month" rely on the latest history, not the oldest.
const PULL_OVERRIDES: Partial<
  Record<DataStore, { order?: { column: string; ascending: boolean }; limit?: number }>
> = {
  snapshots: { order: { column: "snapshot_date", ascending: false }, limit: 60 },
}

// How often to force a FULL pull (instead of an incremental delta). A full pull
// reconciles server-side deletes (rows removed elsewhere) and heals any cache
// gaps, while everyday syncs stay cheap by pulling only what changed.
const FULL_REFRESH_INTERVAL = 6 * 60 * 60 * 1000 // 6 hours

export async function pullAllData(userId: string): Promise<void> {
  const supabase = createClient()

  const tables = DATA_STORES.map((name) => ({
    table: name,
    store: name,
    ...PULL_OVERRIDES[name],
  }))

  const syncStart = new Date().toISOString()
  const lastFull = await getMeta("lastFullSync")
  const forceFull =
    !lastFull || Date.now() - new Date(lastFull).getTime() > FULL_REFRESH_INTERVAL

  // Fetch in batches of 3 to avoid exhausting browser connections
  for (let i = 0; i < tables.length; i += 3) {
    const batch = tables.slice(i, i + 3)
    const results = await Promise.allSettled(
      batch.map(async ({ table, store, order, limit }) => {
        const lastTableSync = await getMeta(`lastSync_${table}`)
        // A full pull replaces the whole store; a delta merges only changes.
        const isFullPull = forceFull || !lastTableSync
        let query = supabase.from(table).select("*").eq("user_id", userId)

        // Delta sync: only fetch rows updated since last sync
        if (!isFullPull && lastTableSync) {
          query = query.gte("updated_at", lastTableSync)
        }

        if (order) query = query.order(order.column, { ascending: order.ascending })
        if (isFullPull && limit) query = query.limit(limit) // cap only full pulls
        const { data, error } = await query
        if (error) throw error

        if (isFullPull) {
          // Replace the store with the authoritative server snapshot. This also
          // prunes rows deleted on the server (or another device).
          await putAll(store, data || [])
        } else if (data && data.length > 0) {
          // Merge changed rows without clearing untouched ones.
          await bulkPut(store, data)
        }
        // Advance the watermark from SERVER timestamps (max updated_at seen),
        // not the client clock — a fast client clock would set a watermark in
        // the server's future and silently skip other-device updates until the
        // next forced full pull. When no rows changed, keep the old watermark
        // (or fall back to client time on the first-ever pull).
        const prevMark = lastTableSync ?? ""
        const maxUpdated = (data ?? []).reduce<string>((m, r) => {
          const u = (r as { updated_at?: string }).updated_at
          return typeof u === "string" && u > m ? u : m
        }, prevMark)
        await setMeta(`lastSync_${table}`, maxUpdated || syncStart)
      })
    )

    const failed = results.filter(r => r.status === "rejected")
    if (failed.length > 0) {
      console.warn("[sync] Some tables failed to pull:", failed)
    }
  }

  await setMeta("lastSync", syncStart)
  if (forceFull) await setMeta("lastFullSync", syncStart)
}

/** Full sync: replay queue → pull fresh data */
export async function fullSync(userId: string): Promise<void> {
  if (syncing) return
  const now = Date.now()
  if (now - lastSyncAttempt < SYNC_COOLDOWN) return
  lastSyncAttempt = now
  syncing = true
  notify("syncing")

  try {
    // 0. Guard against account switches on a shared device: if the cached data
    //    belongs to a different user, wipe everything (data, queue, sync marks)
    //    BEFORE replaying — otherwise the previous user's queued writes would be
    //    replayed under, and their cached rows shown to, the new account.
    const cachedUser = await getMeta("userId")
    if (cachedUser && cachedUser !== userId) {
      await clearAllStores()
    }
    await setMeta("userId", userId)

    // 1. Replay offline mutations
    const { failed, dropped } = await replayQueue()
    if (dropped > 0) {
      console.warn(`[sync] Discarded ${dropped} change(s) the server kept rejecting`)
    }
    if (failed > 0) {
      notify("error")
      syncing = false
      scheduleRetry(userId)
      return
    }

    // 2. Pull fresh data
    await pullAllData(userId)
    notify("synced")
    retryCount = 0
  } catch (err) {
    console.error("[sync] Full sync failed:", err)
    notify("error")
    scheduleRetry(userId)
  } finally {
    syncing = false
  }
}

/** Schedule an automatic retry with backoff */
function scheduleRetry(userId: string) {
  if (retryTimer) clearTimeout(retryTimer)
  if (retryCount >= MAX_RETRIES) {
    retryCount = 0
    return
  }
  const delay = RETRY_DELAYS[retryCount] || RETRY_DELAYS[RETRY_DELAYS.length - 1]
  retryCount++
  retryTimer = setTimeout(() => {
    if (navigator.onLine) {
      lastSyncAttempt = 0 // reset cooldown for retry
      fullSync(userId)
    }
  }, delay)
}

/** Set up online/offline listeners. Returns cleanup fn. */
export function setupConnectivityListeners(userId: string): () => void {
  const handleOnline = () => {
    notify("online")
    // Delay sync slightly — network may not be fully ready yet
    setTimeout(() => {
      if (navigator.onLine) fullSync(userId)
    }, 1500)
  }
  const handleOffline = () => {
    notify("offline")
  }

  window.addEventListener("online", handleOnline)
  window.addEventListener("offline", handleOffline)

  // Notify initial status
  if (!navigator.onLine) {
    notify("offline")
  }

  return () => {
    window.removeEventListener("online", handleOnline)
    window.removeEventListener("offline", handleOffline)
    if (retryTimer) clearTimeout(retryTimer)
  }
}
