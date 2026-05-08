/**
 * Sync manager: replays queued mutations when online and pulls fresh data.
 * Listens for online/offline events and triggers sync automatically.
 */

import { createClient } from "@/utils/supabase/client"
import { getQueue, dequeue, type QueuedMutation } from "./queue"
import { putAll, setMeta, type StoreName } from "./db"

type SyncListener = (status: "syncing" | "synced" | "error" | "offline" | "online") => void

const listeners = new Set<SyncListener>()
let syncing = false
let lastSyncAttempt = 0
const SYNC_COOLDOWN = 30_000 // 30 seconds between sync attempts

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

/** Pull fresh data from Supabase for a specific user and cache in IndexedDB */
export async function pullAllData(userId: string): Promise<void> {
  const supabase = createClient()

  const tables: { table: string; store: StoreName; order?: { column: string; ascending: boolean }; limit?: number }[] = [
    { table: "assets", store: "assets" },
    { table: "liabilities", store: "liabilities" },
    { table: "transactions", store: "transactions" },
    { table: "goals", store: "goals" },
    { table: "snapshots", store: "snapshots", order: { column: "snapshot_date", ascending: true }, limit: 12 },
    { table: "parties", store: "parties" },
    { table: "party_transactions", store: "party_transactions" },
    { table: "profiles", store: "profiles" },
  ]

  // Fetch in batches of 3 to avoid exhausting browser connections
  for (let i = 0; i < tables.length; i += 3) {
    const batch = tables.slice(i, i + 3)
    const results = await Promise.allSettled(
      batch.map(async ({ table, store, order, limit }) => {
        let query = supabase.from(table).select("*").eq("user_id", userId)
        if (order) query = query.order(order.column, { ascending: order.ascending })
        if (limit) query = query.limit(limit)
        const { data, error } = await query
        if (error) throw error
        await putAll(store, data || [])
      })
    )

    const failed = results.filter(r => r.status === "rejected")
    if (failed.length > 0) {
      console.warn("[sync] Some tables failed to pull:", failed)
    }
  }

  await setMeta("lastSync", new Date().toISOString())
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
      return
    }

    // 2. Pull fresh data
    await pullAllData(userId)
    notify("synced")
  } catch (err) {
    console.error("[sync] Full sync failed:", err)
    notify("error")
  } finally {
    syncing = false
  }
}

/** Set up online/offline listeners. Returns cleanup fn. */
export function setupConnectivityListeners(userId: string): () => void {
  const handleOnline = () => {
    notify("online")
    fullSync(userId)
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
  }
}
