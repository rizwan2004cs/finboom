/**
 * Offline mutation queue.
 * When offline, mutations (insert/update/delete) are saved here.
 * When back online, the sync manager replays them in order.
 */

import { getAll, put, remove } from "./db"

export interface QueuedMutation {
  queue_id: string
  table: string
  operation: "insert" | "update" | "delete"
  data: Record<string, unknown>       // for insert/update
  match: Record<string, unknown>      // for update/delete (eq filters)
  created_at: number                  // timestamp for ordering
  retries: number
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

/** Enqueue a mutation for later sync */
export async function enqueue(
  table: string,
  operation: "insert" | "update" | "delete",
  data: Record<string, unknown>,
  match: Record<string, unknown> = {},
): Promise<void> {
  const mutation: QueuedMutation = {
    queue_id: generateId(),
    table,
    operation,
    data,
    match,
    created_at: Date.now(),
    retries: 0,
  }
  await put("_queue", mutation)
}

/** Get all queued mutations in order */
export async function getQueue(): Promise<QueuedMutation[]> {
  const all = await getAll<QueuedMutation>("_queue")
  return all.sort((a, b) => a.created_at - b.created_at)
}

/** Remove a mutation from the queue (after successful sync) */
export async function dequeue(queueId: string): Promise<void> {
  await remove("_queue", queueId)
}

/** Get count of pending mutations */
export async function getPendingCount(): Promise<number> {
  const all = await getAll<QueuedMutation>("_queue")
  return all.length
}
