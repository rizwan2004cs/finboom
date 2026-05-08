/**
 * Offline-first data layer.
 * - Reads: try Supabase first, cache to IDB. If offline, read from IDB.
 * - Writes: if online, write to Supabase + update IDB. If offline, write to IDB + enqueue for sync.
 */

import { createClient } from "@/utils/supabase/client"
import { getAll, put, putAll, remove as idbRemove, type StoreName } from "./db"
import { enqueue } from "./queue"

const TABLE_TO_STORE: Record<string, StoreName> = {
  assets: "assets",
  liabilities: "liabilities",
  transactions: "transactions",
  goals: "goals",
  snapshots: "snapshots",
  parties: "parties",
  party_transactions: "party_transactions",
  profiles: "profiles",
}

function isOnline(): boolean {
  return typeof navigator !== "undefined" ? navigator.onLine : true
}

/**
 * Fetch all rows for a user from a table.
 * Online: fetch from Supabase, cache to IDB, return.
 * Offline: return cached IDB data.
 */
export async function fetchTable<T>(
  table: string,
  userId: string,
  options?: {
    order?: { column: string; ascending: boolean }
    limit?: number
    filters?: Array<{ column: string; op: "eq" | "gte" | "lte"; value: string | number }>
  }
): Promise<T[]> {
  const store = TABLE_TO_STORE[table]
  if (!store) throw new Error(`Unknown table: ${table}`)

  if (isOnline()) {
    try {
      const supabase = createClient()
      let query = supabase.from(table).select("*").eq("user_id", userId)
      if (options?.filters) {
        for (const f of options.filters) {
          if (f.op === "eq") query = query.eq(f.column, f.value)
          else if (f.op === "gte") query = query.gte(f.column, f.value)
          else if (f.op === "lte") query = query.lte(f.column, f.value)
        }
      }
      if (options?.order) query = query.order(options.order.column, { ascending: options.order.ascending })
      if (options?.limit) query = query.limit(options.limit)
      const { data, error } = await query
      if (error) throw error

      // Cache the fetched data (only full-table fetches without extra filters)
      if (!options?.filters) {
        await putAll(store, data || [])
      }
      return (data || []) as T[]
    } catch (err) {
      console.warn(`[offline] Supabase fetch failed for ${table}, using cache:`, err)
      return getAll<T>(store)
    }
  }

  // Offline: read from cache
  let cached = await getAll<T>(store)

  // Apply client-side filters for offline
  if (options?.filters) {
    cached = cached.filter(row => {
      return options.filters!.every(f => {
        const val = (row as Record<string, unknown>)[f.column]
        if (f.op === "eq") return val === f.value
        if (f.op === "gte") return (val as string) >= (f.value as string)
        if (f.op === "lte") return (val as string) <= (f.value as string)
        return true
      })
    })
  }

  // Apply client-side ordering
  if (options?.order) {
    const { column, ascending } = options.order
    cached.sort((a, b) => {
      const va = (a as Record<string, unknown>)[column]
      const vb = (b as Record<string, unknown>)[column]
      if (va == null || vb == null) return 0
      const cmp = va < vb ? -1 : va > vb ? 1 : 0
      return ascending ? cmp : -cmp
    })
  }

  if (options?.limit) {
    cached = cached.slice(0, options.limit)
  }

  return cached
}

/**
 * Insert a row.
 * Online: Supabase + IDB cache.
 * Offline: IDB + enqueue.
 */
export async function insertRow<T extends { id?: string }>(
  table: string,
  data: Record<string, unknown>,
): Promise<{ data: T | null; error: string | null; offline: boolean }> {
  const store = TABLE_TO_STORE[table]
  if (!store) return { data: null, error: `Unknown table: ${table}`, offline: false }

  // Generate a temporary ID for offline inserts
  const tempId = data.id as string || crypto.randomUUID()
  const record = { ...data, id: tempId }

  if (isOnline()) {
    try {
      const supabase = createClient()
      const { data: result, error } = await supabase.from(table).insert(data).select().single()
      if (error) throw error
      // Cache the server-returned row (with real ID)
      await put(store, result)
      return { data: result as T, error: null, offline: false }
    } catch (err) {
      console.warn(`[offline] Insert failed for ${table}, queueing:`, err)
    }
  }

  // Offline or network failure: store locally + queue
  await put(store, record)
  await enqueue(table, "insert", data)
  return { data: record as T, error: null, offline: true }
}

/**
 * Update a row.
 * Online: Supabase + IDB cache.
 * Offline: IDB + enqueue.
 */
export async function updateRow<T>(
  table: string,
  id: string,
  data: Record<string, unknown>,
): Promise<{ data: T | null; error: string | null; offline: boolean }> {
  const store = TABLE_TO_STORE[table]
  if (!store) return { data: null, error: `Unknown table: ${table}`, offline: false }

  if (isOnline()) {
    try {
      const supabase = createClient()
      const { data: result, error } = await supabase.from(table).update(data).eq("id", id).select().single()
      if (error) throw error
      await put(store, result)
      return { data: result as T, error: null, offline: false }
    } catch (err) {
      console.warn(`[offline] Update failed for ${table}/${id}, queueing:`, err)
    }
  }

  // Offline: update local copy + queue
  const existing = await getAll<Record<string, unknown>>(store)
  const current = existing.find(r => r.id === id)
  const updated = { ...current, ...data, id }
  await put(store, updated)
  await enqueue(table, "update", data, { id })
  return { data: updated as T, error: null, offline: true }
}

/**
 * Delete a row.
 * Online: Supabase + IDB cache.
 * Offline: IDB + enqueue.
 */
export async function deleteRow(
  table: string,
  id: string,
): Promise<{ error: string | null; offline: boolean }> {
  const store = TABLE_TO_STORE[table]
  if (!store) return { error: `Unknown table: ${table}`, offline: false }

  if (isOnline()) {
    try {
      const supabase = createClient()
      const { error } = await supabase.from(table).delete().eq("id", id)
      if (error) throw error
      await idbRemove(store, id)
      return { error: null, offline: false }
    } catch (err) {
      console.warn(`[offline] Delete failed for ${table}/${id}, queueing:`, err)
    }
  }

  // Offline: remove locally + queue
  await idbRemove(store, id)
  await enqueue(table, "delete", {}, { id })
  return { error: null, offline: true }
}
