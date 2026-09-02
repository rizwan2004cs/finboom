"use client"

import { useQuery } from "@tanstack/react-query"
import type { QueryClient } from "@tanstack/react-query"
import type { SipPayment } from "@/lib/types"
import { getAll, putAll, put } from "@/lib/offline/db"

function isOnline(): boolean {
  return typeof navigator !== "undefined" ? navigator.onLine : true
}

/**
 * Rows come from /api/sip-payments (server-side auth, so the list is never an
 * empty RLS read). The IndexedDB store is the offline copy: it is filled from
 * every successful API call and read back whenever the network is unavailable
 * or the request fails, mirroring fetchTable — otherwise paid/skipped SIPs
 * would all show as due while offline.
 */
async function loadSipPaymentsFromApi(): Promise<SipPayment[]> {
  if (!isOnline()) return getAll<SipPayment>("sip_payments")
  try {
    const res = await fetch("/api/sip-payments")
    const data = await res.json()
    if (!res.ok) throw new Error(data.error ?? "Could not load SIP payments")
    const payments = (data.payments ?? []) as SipPayment[]
    await putAll("sip_payments", payments)
    return payments
  } catch (err) {
    console.warn("[sip_payments] API fetch failed, using cache:", err)
    return getAll<SipPayment>("sip_payments")
  }
}

/** Keep React Query cache in sync after mark/reconcile without waiting for refetch. */
export function mergeSipPaymentInCache(
  queryClient: QueryClient,
  userId: string | undefined,
  payment: SipPayment,
) {
  if (!userId) return
  queryClient.setQueryData<SipPayment[]>(["sip_payments", userId, "api"], (old) => {
    const list = old ?? []
    const withoutDup = list.filter(
      (p) => !(p.sip_id === payment.sip_id && p.month === payment.month),
    )
    return [...withoutDup, payment]
  })
  void put("sip_payments", payment)
}

/** SIP payments for the signed-in user — API when online, IndexedDB otherwise. */
export function useSipPayments(userId: string | undefined) {
  return useQuery<SipPayment[]>({
    queryKey: ["sip_payments", userId, "api"],
    queryFn: loadSipPaymentsFromApi,
    enabled: !!userId,
    staleTime: 30_000,
    // Run the queryFn even without a network so the cache fallback is reached.
    networkMode: "offlineFirst",
  })
}
