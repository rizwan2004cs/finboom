"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { insertRow, updateRow, deleteRow } from "@/lib/offline"
import { useToast } from "@/components/toast"

/**
 * Mutation hook for offline-first insert/update/delete.
 * Invalidates the relevant table query on success.
 *
 * Optional `successMessage` shows a confirmation toast; errors always surface
 * a toast (overridable via `errorMessage`) so failed saves are never silent.
 */
type ToastOptions = { successMessage?: string; errorMessage?: string }

const DEFAULT_ERROR = "Something went wrong. Please try again."

export function useInsertMutation<T extends { id?: string }>(
  table: string,
  options: ToastOptions = {}
) {
  const qc = useQueryClient()
  const toast = useToast()

  return useMutation({
    mutationFn: (data: Record<string, unknown>) => insertRow<T>(table, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [table] })
      if (options.successMessage) toast.success(options.successMessage)
    },
    onError: () => toast.error(options.errorMessage ?? DEFAULT_ERROR),
  })
}

export function useUpdateMutation<T>(table: string, options: ToastOptions = {}) {
  const qc = useQueryClient()
  const toast = useToast()

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      updateRow<T>(table, id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [table] })
      if (options.successMessage) toast.success(options.successMessage)
    },
    onError: () => toast.error(options.errorMessage ?? DEFAULT_ERROR),
  })
}

export function useDeleteMutation(table: string, options: ToastOptions = {}) {
  const qc = useQueryClient()
  const toast = useToast()

  return useMutation({
    mutationFn: (id: string) => deleteRow(table, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [table] })
      if (options.successMessage) toast.success(options.successMessage)
    },
    onError: () => toast.error(options.errorMessage ?? DEFAULT_ERROR),
  })
}
