/**
 * Offline-first data layer.
 * - Reads: try Supabase first, cache to IDB. If offline, read from IDB.
 * - Writes: if online, write to Supabase + update IDB. If offline, write to IDB + enqueue for sync.
 */

import { createClient } from "@/utils/supabase/client"
import { getAll, put, putAll, remove as idbRemove, DATA_STORES, type StoreName } from "./db"
import { enqueue } from "./queue"

// Table name === store name for every synced table; derive the map from the
// single registry in db.ts instead of repeating the list here.
const TABLE_TO_STORE: Record<string, StoreName> = Object.fromEntries(
  DATA_STORES.map((name) => [name, name])
)

function isOnline(): boolean {
  return typeof navigator !== "undefined" ? navigator.onLine : true
}

/**
 * A "permanent" error is one the server will reject on every attempt — RLS
 * denial, constraint/validation violation, unknown column, etc. PostgREST and
 * Postgres errors carry a non-empty string `code`; genuine network failures
 * (offline, aborted fetch) do not. We must NOT queue permanent errors for
 * offline replay: they would fail forever and block the whole sync queue.
 */
function isPermanentError(err: unknown): boolean {
  const code = (err as { code?: unknown } | null)?.code
  return typeof code === "string" && code.length > 0
}

function errorMessage(err: unknown, fallback: string): string {
  const msg = (err as { message?: unknown } | null)?.message
  return typeof msg === "string" && msg.length > 0 ? msg : fallback
}

/**
 * Broadcast a failed write so a top-level listener can surface a toast. Keeps
 * this data layer UI-agnostic (no React imports) while guaranteeing that NO
 * write fails silently — even for callers that ignore the returned `error`.
 * Returns the message so callers can write `error: reportWriteError(msg)`.
 */
function reportWriteError(message: string): string {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("finboom:write-error", { detail: message }))
  }
  return message
}

// Deduplication: prevent multiple concurrent fetches for the same table+user
const inflight = new Map<string, Promise<unknown[]>>()

/**
 * Fetch all rows for a user from a table.
 * Online: fetch from Supabase, cache to IDB, return.
 * Offline: return cached IDB data.
 * Deduplicates concurrent requests for the same table+user.
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

  // Deduplicate concurrent requests (only for unfiltered full-table fetches)
  const dedupeKey = !options?.filters ? `${table}:${userId}` : null
  if (dedupeKey && inflight.has(dedupeKey)) {
    return inflight.get(dedupeKey) as Promise<T[]>
  }

  const promise = _fetchTableImpl<T>(table, store, userId, options)

  if (dedupeKey) {
    inflight.set(dedupeKey, promise as Promise<unknown[]>)
    promise.finally(() => inflight.delete(dedupeKey))
  }

  return promise
}

async function _fetchTableImpl<T>(
  table: string,
  store: StoreName,
  userId: string,
  options?: {
    order?: { column: string; ascending: boolean }
    limit?: number
    filters?: Array<{ column: string; op: "eq" | "gte" | "lte"; value: string | number }>
  }
): Promise<T[]> {

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

      // Cache the fetched data in background (don't block return)
      if (!options?.filters) {
        putAll(store, data || []).catch(() => {})
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
  if (!store) return { data: null, error: reportWriteError(`Unknown table: ${table}`), offline: false }

  // Generate a temporary ID for offline inserts. Stamp created_at too — the
  // server would default it on replay, but until then cached rows without it
  // sort before every real timestamp (e.g. in the account ledger's same-day
  // ordering), and queueing it keeps the true creation time after sync.
  const tempId = data.id as string || crypto.randomUUID()
  const record = { ...data, id: tempId, created_at: (data.created_at as string) || new Date().toISOString() }

  if (isOnline()) {
    try {
      const supabase = createClient()
      const { data: result, error } = await supabase.from(table).insert(data).select().single()
      if (error) throw error
      // Cache the server-returned row (with real ID)
      await put(store, result)
      return { data: result as T, error: null, offline: false }
    } catch (err) {
      if (isOnline() && isPermanentError(err)) {
        // Server rejected the write; queueing it would loop forever. Surface it.
        console.error(`[offline] Insert rejected by server for ${table}:`, err)
        return { data: null, error: reportWriteError(errorMessage(err, "Insert failed")), offline: false }
      }
      console.warn(`[offline] Insert failed for ${table}, queueing:`, err)
    }
  }

  // Offline or network failure: store locally + queue.
  // Queue the record WITH its generated id so the server inserts the same id —
  // otherwise the server would assign a new id and the next sync would create a
  // duplicate alongside this temp row (and updates/deletes against the temp id
  // would never match the server row).
  await put(store, record)
  await enqueue(table, "insert", record)
  return { data: record as unknown as T, error: null, offline: true }
}

/**
 * Upsert a row, resolving collisions on the given conflict columns.
 * Online: Supabase upsert + IDB cache.
 * Offline: resolve against the cache (merge into the matching row or insert a
 * fresh temp row) + enqueue for replay.
 *
 * This exists for the "take snapshot" flow: a second snapshot on the same day
 * must overwrite the first instead of stacking a duplicate, and that decision
 * must not depend on possibly-stale React-query state. Upserting on
 * (profile_id, snapshot_date) makes the same-day override atomic and race-free.
 */
export async function upsertRow<T>(
  table: string,
  data: Record<string, unknown>,
  conflict: { columns: string[] },
): Promise<{ data: T | null; error: string | null; offline: boolean }> {
  const store = TABLE_TO_STORE[table]
  if (!store) return { data: null, error: reportWriteError(`Unknown table: ${table}`), offline: false }

  const onConflict = conflict.columns.join(",")

  if (isOnline()) {
    try {
      const supabase = createClient()
      const { data: result, error } = await supabase
        .from(table)
        .upsert(data, { onConflict })
        .select()
        .single()
      if (error) throw error
      await put(store, result)
      return { data: result as T, error: null, offline: false }
    } catch (err) {
      if (isOnline() && isPermanentError(err)) {
        console.error(`[offline] Upsert rejected by server for ${table}:`, err)
        return { data: null, error: reportWriteError(errorMessage(err, "Save failed")), offline: false }
      }
      console.warn(`[offline] Upsert failed for ${table}, queueing:`, err)
    }
  }

  // Offline: resolve the conflict against the cache so the local view is correct
  // immediately, then queue the resolved record (with a stable id) so the server
  // upsert lands on the same row and a later delta sync doesn't create a
  // duplicate beside this temp row.
  const existing = await getAll<Record<string, unknown>>(store)
  const match = existing.find(r => conflict.columns.every(c => r[c] === data[c]))
  const tempId = (data.id as string) || crypto.randomUUID()
  const record = match
    ? { ...match, ...data, id: match.id }
    : { ...data, id: tempId, created_at: (data.created_at as string) || new Date().toISOString() }
  await put(store, record)
  await enqueue(table, "upsert", record, {}, onConflict)
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
  if (!store) return { data: null, error: reportWriteError(`Unknown table: ${table}`), offline: false }

  if (isOnline()) {
    try {
      const supabase = createClient()
      const { data: result, error } = await supabase.from(table).update(data).eq("id", id).select().single()
      if (error) throw error
      await put(store, result)
      return { data: result as T, error: null, offline: false }
    } catch (err) {
      if (isOnline() && isPermanentError(err)) {
        console.error(`[offline] Update rejected by server for ${table}/${id}:`, err)
        return { data: null, error: reportWriteError(errorMessage(err, "Update failed")), offline: false }
      }
      console.warn(`[offline] Update failed for ${table}/${id}, queueing:`, err)
    }
  }

  // Offline: update local copy + queue. Only merge into an existing cached row;
  // writing `{ ...undefined, ...data }` would persist a sparse record missing
  // required fields. The queued update still carries the change either way.
  const existing = await getAll<Record<string, unknown>>(store)
  const current = existing.find(r => r.id === id)
  const updated = current ? { ...current, ...data, id } : { ...data, id }
  if (current) await put(store, updated)
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
  if (!store) return { error: reportWriteError(`Unknown table: ${table}`), offline: false }

  if (isOnline()) {
    try {
      const supabase = createClient()
      const { error } = await supabase.from(table).delete().eq("id", id)
      if (error) throw error
      await idbRemove(store, id)
      return { error: null, offline: false }
    } catch (err) {
      if (isOnline() && isPermanentError(err)) {
        console.error(`[offline] Delete rejected by server for ${table}/${id}:`, err)
        return { error: reportWriteError(errorMessage(err, "Delete failed")), offline: false }
      }
      console.warn(`[offline] Delete failed for ${table}/${id}, queueing:`, err)
    }
  }

  // Offline: remove locally + queue
  await idbRemove(store, id)
  await enqueue(table, "delete", {}, { id })
  return { error: null, offline: true }
}
