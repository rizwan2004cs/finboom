"use client"

import { useMemo, useState } from "react"
import { Repeat } from "lucide-react"
import { useUser } from "@/hooks/use-auth"
import { useSipPayments, mergeSipPaymentInCache } from "@/hooks/use-sip-payments"
import { useQueryClient } from "@tanstack/react-query"
import type { Sip, SipPayment, Transaction } from "@/lib/types"
import { monthKeyFromDate, sipStatusForMonth } from "@/lib/finance/monthly-cashflow"
import { markSipPaid, unmarkSipPaid, markAllSipsPaid } from "@/lib/finance/sip-payments"
import { useCurrency } from "@/hooks/use-currency"

function ordinal(n: number): string {
  const v = n % 100
  if (v >= 11 && v <= 13) return `${n}th`
  switch (n % 10) {
    case 1: return `${n}st`
    case 2: return `${n}nd`
    case 3: return `${n}rd`
    default: return `${n}th`
  }
}

interface Props {
  sips: Sip[]
  profileId?: string
  /** Defaults to current calendar month (YYYY-MM). */
  monthKey?: string
  /** Used to detect SIP expenses already logged without a sip_payment row. */
  transactions?: Transaction[]
}

export function SipMonthChecklist({ sips, profileId, monthKey: monthKeyProp, transactions = [] }: Props) {
  const { user } = useUser()
  const { formatCompact: formatCurrency } = useCurrency()
  const queryClient = useQueryClient()
  const monthKey = monthKeyProp ?? monthKeyFromDate()

  const { data: payments = [], refetch } = useSipPayments(user?.id)
  const [busy, setBusy] = useState(false)

  const scopedSips = useMemo(
    () => (profileId ? sips.filter((s) => s.profile_id === profileId) : sips),
    [sips, profileId],
  )
  const activeSips = scopedSips.filter((s) => s.active)

  const scopedTx = useMemo(
    () => (profileId ? transactions.filter((t) => t.profile_id === profileId) : transactions),
    [transactions, profileId],
  )

  const { unpaid, paid } = useMemo(
    () => sipStatusForMonth(activeSips, payments, monthKey, scopedTx),
    [activeSips, payments, monthKey, scopedTx],
  )

  const paymentBySipId = useMemo(
    () => new Map(
      payments.filter((p) => p.month === monthKey).map((p) => [p.sip_id, p]),
    ),
    [payments, monthKey],
  )

  if (activeSips.length === 0 || unpaid.length === 0) return null

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["sip_payments"] })
    queryClient.invalidateQueries({ queryKey: ["transactions"] })
    refetch()
  }

  function syncPayment(payment: SipPayment | undefined) {
    if (payment) mergeSipPaymentInCache(queryClient, user?.id, payment)
  }

  async function togglePaid(sip: Sip, isPaid: boolean) {
    if (!user || busy) return
    setBusy(true)
    try {
      if (isPaid) {
        const row = paymentBySipId.get(sip.id)
        if (row) {
          const result = await unmarkSipPaid(row)
          if (!result.ok) {
            window.dispatchEvent(
              new CustomEvent("finboom:write-error", { detail: result.error ?? "Could not undo" }),
            )
          }
        }
      } else {
        const result = await markSipPaid(user.id, sip, monthKey)
        syncPayment(result.payment)
        if (!result.ok) {
          window.dispatchEvent(
            new CustomEvent("finboom:write-error", { detail: result.error ?? "Could not mark paid" }),
          )
        }
      }
      invalidate()
    } finally {
      setBusy(false)
    }
  }

  async function markAllPaid() {
    if (!user || busy || unpaid.length === 0) return
    setBusy(true)
    try {
      const { marked, failed, payments: newPayments } = await markAllSipsPaid(user.id, unpaid, monthKey)
      for (const p of newPayments) syncPayment(p)
      if (failed > 0) {
        window.dispatchEvent(
          new CustomEvent("finboom:write-error", {
            detail: `Marked ${marked}, failed ${failed} — try again`,
          }),
        )
      }
      invalidate()
    } finally {
      setBusy(false)
    }
  }

  const monthLabel = new Date(`${monthKey}-01`).toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
  })

  return (
    <div className="liquid-glass rounded-2xl p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-[#1d1d1f] dark:text-white">SIPs · {monthLabel}</h3>
          <p className="text-[11px] text-[#86868b]">Mark paid to add Investment expenses</p>
        </div>
        <div className="text-right flex flex-col items-end gap-1">
          <p className="text-[11px] text-[#86868b]">
            {paid.length}/{activeSips.length} done
          </p>
          {unpaid.length > 0 && (
            <button
              type="button"
              disabled={busy}
              onClick={markAllPaid}
              className="text-[11px] font-medium px-2.5 py-1 rounded-lg bg-[#1d1d1f] text-white disabled:opacity-50"
            >
              Mark all paid
            </button>
          )}
        </div>
      </div>

      <div className="space-y-2">
        {unpaid.map((sip) => {
          const label = sip.fund_name || sip.name
          return (
            <button
              key={sip.id}
              type="button"
              disabled={busy}
              onClick={() => togglePaid(sip, false)}
              className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all bg-[#f5f5f7]/80 dark:bg-white/[0.04] border border-transparent hover:bg-[#ebebed] dark:hover:bg-white/[0.06]"
            >
              <span className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center bg-white dark:bg-white/10 text-[#86868b]">
                <Repeat className="w-4 h-4" />
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-medium truncate text-[#1d1d1f] dark:text-white">
                  {label}
                </span>
                <span className="text-[11px] text-[#86868b]">
                  {formatCurrency(Number(sip.amount))} · {ordinal(sip.sip_day)} of month
                </span>
              </span>
              <span className="text-[11px] font-medium flex-shrink-0 text-[#86868b]">
                Mark paid
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
