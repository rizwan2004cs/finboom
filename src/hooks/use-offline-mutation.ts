"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { insertRow, updateRow, deleteRow } from "@/lib/offline"
import { useToast } from "@/components/toast"

/**
 * Mutation hook for offline-first insert/update/delete.
 * Invalidates the relevant table query on success.
 *
 * The offline data layer resolves (never throws) and returns `{ error }` on a
 * server rejection, so we must inspect that field here — otherwise React Query
 * treats a rejected write as a success. When `error` is set we skip the success
 * path; the failure toast itself is raised centrally by {@link WriteErrorToaster}
 * (the data layer broadcasts it), so we don't toast again here to avoid dupes.
 * A genuine thrown error (unexpected) still falls through to `onError`.
 */
type ToastOptions = { successMessage?: string; errorMessage?: string }

const DEFAULT_ERROR = "Something went wrong. Please try again."

function hasError(res: unknown): boolean {
  return !!(res as { error?: string | null } | null)?.error
}

export function useInsertMutation<T extends { id?: string }>(
  table: string,
  options: ToastOptions = {}
) {
  const qc = useQueryClient()
  const toast = useToast()

  return useMutation({
    mutationFn: (data: Record<string, unknown>) => insertRow<T>(table, data),
    onSuccess: (res) => {
      if (hasError(res)) return
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
    onSuccess: (res) => {
      if (hasError(res)) return
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
    onSuccess: (res) => {
      if (hasError(res)) return
      qc.invalidateQueries({ queryKey: [table] })
      if (options.successMessage) toast.success(options.successMessage)
    },
    onError: () => toast.error(options.errorMessage ?? DEFAULT_ERROR),
  })
}
