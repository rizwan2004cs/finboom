"use client"

import { useQuery } from "@tanstack/react-query"
import type { SipPayment } from "@/lib/types"
import { putAll } from "@/lib/offline/db"

async function loadSipPaymentsFromApi(): Promise<SipPayment[]> {
  const res = await fetch("/api/sip-payments")
  const data = await res.json()
  if (!res.ok) throw new Error(data.error ?? "Could not load SIP payments")
  const payments = (data.payments ?? []) as SipPayment[]
  await putAll("sip_payments", payments)
  return payments
}

/** SIP payments via server API — avoids client RLS empty reads wiping local cache. */
export function useSipPayments(userId: string | undefined) {
  return useQuery<SipPayment[]>({
    queryKey: ["sip_payments", userId, "api"],
    queryFn: loadSipPaymentsFromApi,
    enabled: !!userId,
    staleTime: 30_000,
  })
}
