/**
 * Sync manager: replays queued mutations when online and pulls fresh data.
 * Listens for online/offline events and triggers sync automatically.
 */

import { createClient } from "@/utils/supabase/client"
import { getQueue, dequeue, type QueuedMutation } from "./queue"
import { putAll, setMeta, getMeta, DATA_STORES, type DataStore } from "./db"

type SyncListener = (status: "syncing" | "synced" | "error" | "offline" | "online") => void

const listeners = new Set<SyncListener>()
let syncing = false
let lastSyncAttempt = 0
let retryTimer: ReturnType<typeof setTimeout> | null = null
let retryCount = 0
const SYNC_COOLDOWN = 5_000 // 5 seconds between sync attempts
const MAX_RETRIES = 3
const RETRY_DELAYS = [3_000, 8_000, 20_000] // escalating retry delays

export function onSyncStatus(fn: SyncListener): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

function notify(status: "syncing" | "synced" | "error" | "offline" | "online") {
  listeners.forEach(fn => fn(status))
}

/** Replay a single queued mutation against Supabase */
async function replayMutation(m: QueuedMutation): Promise<boolean> {
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
    }

    if (query) {
      const { error } = await query
      if (error) {
        console.error(`[sync] Failed to replay ${m.operation} on ${m.table}:`, error)
        return false
      }
    }
    return true
  } catch {
    return false
  }
}

/** Replay all queued mutations in order */
export async function replayQueue(): Promise<{ success: number; failed: number }> {
  const queue = await getQueue()
  let success = 0
  let failed = 0

  for (const mutation of queue) {
    const ok = await replayMutation(mutation)
    if (ok) {
      await dequeue(mutation.queue_id)
      success++
    } else {
      failed++
      // Stop on first failure to preserve order
      break
    }
  }

  return { success, failed }
}

/** Pull fresh data from Supabase for a specific user and cache in IndexedDB.
 *  Uses delta sync: only fetches rows updated since the last sync per table.
 *  Falls back to full pull if no previous sync timestamp exists.
 */
// Per-table pull tweaks (ordering / row caps). Everything else uses defaults.
const PULL_OVERRIDES: Partial<
  Record<DataStore, { order?: { column: string; ascending: boolean }; limit?: number }>
> = {
  snapshots: { order: { column: "snapshot_date", ascending: true }, limit: 12 },
}

export async function pullAllData(userId: string): Promise<void> {
  const supabase = createClient()

  const tables = DATA_STORES.map((name) => ({
    table: name,
    store: name,
    ...PULL_OVERRIDES[name],
  }))

  const syncStart = new Date().toISOString()

  // Fetch in batches of 3 to avoid exhausting browser connections
  for (let i = 0; i < tables.length; i += 3) {
    const batch = tables.slice(i, i + 3)
    const results = await Promise.allSettled(
      batch.map(async ({ table, store, order, limit }) => {
        const lastTableSync = await getMeta(`lastSync_${table}`)
        let query = supabase.from(table).select("*").eq("user_id", userId)

        // Delta sync: only fetch rows updated since last sync
        if (lastTableSync) {
          query = query.gte("updated_at", lastTableSync)
        }

        if (order) query = query.order(order.column, { ascending: order.ascending })
        if (limit && !lastTableSync) query = query.limit(limit) // skip limit for delta pulls
        const { data, error } = await query
        if (error) throw error
        if (data && data.length > 0) {
          await putAll(store, data)
        }
        // Update per-table sync timestamp on success
        await setMeta(`lastSync_${table}`, syncStart)
      })
    )

    const failed = results.filter(r => r.status === "rejected")
    if (failed.length > 0) {
      console.warn("[sync] Some tables failed to pull:", failed)
    }
  }

  await setMeta("lastSync", syncStart)
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
    // 1. Replay offline mutations
    const { failed } = await replayQueue()
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
