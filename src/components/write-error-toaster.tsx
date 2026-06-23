"use client"

import { useEffect } from "react"
import { useToast } from "@/components/toast"

/**
 * Listens for the `finboom:write-error` event dispatched by the offline data
 * layer (see {@link "@/lib/offline/data"}) whenever a Supabase write is rejected
 * — missing table, RLS denial, constraint violation, etc. — and shows a toast.
 *
 * This is the safety net that guarantees a failed save is never silent, even for
 * the many modals/pages that call insertRow/updateRow/deleteRow directly without
 * inspecting the returned `error`.
 */
export function WriteErrorToaster() {
  const toast = useToast()

  useEffect(() => {
    function onWriteError(e: Event) {
      const message = (e as CustomEvent<string>).detail
      toast.error(message ? `Couldn't save: ${message}` : "Couldn't save. Please try again.")
    }
    window.addEventListener("finboom:write-error", onWriteError)
    return () => window.removeEventListener("finboom:write-error", onWriteError)
  }, [toast])

  return null
}
