"use client"

import { useQuery, type UseQueryOptions } from "@tanstack/react-query"
import { fetchTable } from "@/lib/offline"

type FetchOptions = {
  order?: { column: string; ascending: boolean }
  limit?: number
  filters?: Array<{ column: string; op: "eq" | "gte" | "lte"; value: string | number }>
}

/**
 * React Query wrapper around the offline-first fetchTable.
 * Automatically handles caching, deduplication, and background refetch.
 */
export function useOfflineQuery<T>(
  table: string,
  userId: string | undefined,
  options?: FetchOptions & {
    enabled?: boolean
    queryKey?: unknown[]
  }
) {
  const { enabled, queryKey: extraKey, ...fetchOpts } = options ?? {}

  // Build a stable query key from table + userId + filters/order/limit
  const queryKey = [
    table,
    userId,
    fetchOpts.filters ?? null,
    fetchOpts.order ?? null,
    fetchOpts.limit ?? null,
    ...(extraKey ?? []),
  ]

  return useQuery<T[]>({
    queryKey,
    queryFn: () => fetchTable<T>(table, userId!, fetchOpts),
    enabled: enabled !== false && !!userId,
  })
}
