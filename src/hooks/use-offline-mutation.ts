"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { insertRow, updateRow, deleteRow } from "@/lib/offline"

/**
 * Mutation hook for offline-first insert/update/delete.
 * Invalidates the relevant table query on success.
 */
export function useInsertMutation<T extends { id?: string }>(table: string) {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: (data: Record<string, unknown>) => insertRow<T>(table, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [table] })
    },
  })
}

export function useUpdateMutation<T>(table: string) {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      updateRow<T>(table, id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [table] })
    },
  })
}

export function useDeleteMutation(table: string) {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => deleteRow(table, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [table] })
    },
  })
}
