/**
 * IndexedDB wrapper for offline data storage.
 * Stores all Supabase tables locally for offline reads and caches data on every fetch.
 */

const DB_NAME = "finboom-offline"
const DB_VERSION = 5

// Single source of truth for the user-data tables synced offline. Every layer
// (IndexedDB stores, the offline data router, and the sync puller) derives its
// table list from this array, so adding a table only needs a change here plus a
// matching Supabase table — not edits scattered across three files.
export const DATA_STORES = [
  "assets",
  "liabilities",
  "transactions",
  "goals",
  "budgets",
  "snapshots",
  "parties",
  "party_transactions",
  "profiles",
  "health_checks",
  "sips",
] as const

export type DataStore = (typeof DATA_STORES)[number]

const STORES = [
  ...DATA_STORES,
  "_queue", // mutation queue for offline writes
  "_meta",  // metadata (last sync timestamps, etc.)
] as const

export type StoreName = (typeof STORES)[number]

let dbPromise: Promise<IDBDatabase> | null = null

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = (event) => {
      const db = request.result
      const oldVersion = event.oldVersion

      // V0 → V1: create all initial stores
      if (oldVersion < 1) {
        for (const name of STORES) {
          if (!db.objectStoreNames.contains(name)) {
            const store = db.createObjectStore(name, { keyPath: name === "_queue" ? "queue_id" : name === "_meta" ? "key" : "id" })
            if (name === "_queue") {
              store.createIndex("created_at", "created_at")
            }
          }
        }
      }

      // V1 → V2: add updated_at index on data stores for delta sync
      if (oldVersion < 2) {
        const dataStores = ["assets", "liabilities", "transactions", "goals", "snapshots", "parties", "party_transactions", "profiles", "budgets"] as const
        for (const name of dataStores) {
          if (db.objectStoreNames.contains(name)) {
            const tx = (event.target as IDBOpenDBRequest).transaction!
            const store = tx.objectStore(name)
            if (!store.indexNames.contains("updated_at")) {
              store.createIndex("updated_at", "updated_at")
            }
          }
        }
      }

      // V2 → V3: add budgets store
      if (oldVersion < 3) {
        if (!db.objectStoreNames.contains("budgets")) {
          const store = db.createObjectStore("budgets", { keyPath: "id" })
          store.createIndex("updated_at", "updated_at")
        }
      }

      // V3 → V4: add health_checks store
      if (oldVersion < 4) {
        if (!db.objectStoreNames.contains("health_checks")) {
          const store = db.createObjectStore("health_checks", { keyPath: "id" })
          store.createIndex("updated_at", "updated_at")
        }
      }

      // V4 → V5: add sips store
      if (oldVersion < 5) {
        if (!db.objectStoreNames.contains("sips")) {
          const store = db.createObjectStore("sips", { keyPath: "id" })
          store.createIndex("updated_at", "updated_at")
        }
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
  return dbPromise
}

/** Get all records from a store */
export async function getAll<T>(store: StoreName): Promise<T[]> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readonly")
    const req = tx.objectStore(store).getAll()
    req.onsuccess = () => resolve(req.result as T[])
    req.onerror = () => reject(req.error)
  })
}

/** Get a single record by id */
export async function getById<T>(store: StoreName, id: string): Promise<T | undefined> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readonly")
    const req = tx.objectStore(store).get(id)
    req.onsuccess = () => resolve(req.result as T | undefined)
    req.onerror = () => reject(req.error)
  })
}

/** Put (upsert) a single record */
export async function put<T>(store: StoreName, record: T): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readwrite")
    tx.objectStore(store).put(record)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

/** Put multiple records (bulk upsert), clearing old data first */
export async function putAll<T>(store: StoreName, records: T[]): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readwrite")
    const objectStore = tx.objectStore(store)
    objectStore.clear()
    for (const record of records) {
      objectStore.put(record)
    }
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

/** Delete a record by id */
export async function remove(store: StoreName, id: string): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readwrite")
    tx.objectStore(store).delete(id)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

/** Get a meta value */
export async function getMeta(key: string): Promise<string | null> {
  const record = await getById<{ key: string; value: string }>("_meta", key)
  return record?.value ?? null
}

/** Set a meta value */
export async function setMeta(key: string, value: string): Promise<void> {
  await put("_meta", { key, value })
}
