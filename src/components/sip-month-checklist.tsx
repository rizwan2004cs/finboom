"use client"

import { useMemo, useState } from "react"
import { Check, Repeat } from "lucide-react"
import { useUser } from "@/hooks/use-auth"
import { useOfflineQuery } from "@/hooks/use-offline-query"
import { useQueryClient } from "@tanstack/react-query"
import type { Sip, SipPayment } from "@/lib/types"
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
}

export function SipMonthChecklist({ sips, profileId, monthKey: monthKeyProp }: Props) {
  const { user } = useUser()
  const { formatCompact: formatCurrency } = useCurrency()
  const queryClient = useQueryClient()
  const monthKey = monthKeyProp ?? monthKeyFromDate()

  const { data: payments = [] } = useOfflineQuery<SipPayment>(
    "sip_payments",
    user?.id,
    { enabled: !!user },
  )
  const [busy, setBusy] = useState(false)

  const scopedSips = useMemo(
    () => (profileId ? sips.filter((s) => s.profile_id === profileId) : sips),
    [sips, profileId],
  )
  const activeSips = scopedSips.filter((s) => s.active)

  const { unpaid, paid, unpaidAmount, paidAmount } = useMemo(
    () => sipStatusForMonth(activeSips, payments, monthKey),
    [activeSips, payments, monthKey],
  )

  const paymentBySipId = useMemo(
    () => new Map(
      payments.filter((p) => p.month === monthKey).map((p) => [p.sip_id, p]),
    ),
    [payments, monthKey],
  )

  if (activeSips.length === 0) return null

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["sip_payments"] })
    queryClient.invalidateQueries({ queryKey: ["transactions"] })
  }

  async function togglePaid(sip: Sip, isPaid: boolean) {
    if (!user || busy) return
    setBusy(true)
    try {
      if (isPaid) {
        const row = paymentBySipId.get(sip.id)
        if (row) await unmarkSipPaid(row)
      } else {
        await markSipPaid(user.id, sip, monthKey)
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
      await markAllSipsPaid(user.id, unpaid, monthKey)
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
        {activeSips.map((sip) => {
          const isPaid = paid.some((p) => p.id === sip.id)
          const label = sip.fund_name || sip.name
          return (
            <button
              key={sip.id}
              type="button"
              disabled={busy}
              onClick={() => togglePaid(sip, isPaid)}
              className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all ${
                isPaid
                  ? "bg-green-50/80 dark:bg-green-500/10 border border-green-200/60 dark:border-green-500/20"
                  : "bg-[#f5f5f7]/80 dark:bg-white/[0.04] border border-transparent hover:bg-[#ebebed] dark:hover:bg-white/[0.06]"
              }`}
            >
              <span
                className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${
                  isPaid ? "bg-green-600 text-white" : "bg-white dark:bg-white/10 text-[#86868b]"
                }`}
              >
                {isPaid ? <Check className="w-4 h-4" /> : <Repeat className="w-4 h-4" />}
              </span>
              <span className="flex-1 min-w-0">
                <span className={`block text-sm font-medium truncate ${isPaid ? "text-green-800 dark:text-green-300 line-through" : "text-[#1d1d1f] dark:text-white"}`}>
                  {label}
                </span>
                <span className="text-[11px] text-[#86868b]">
                  {formatCurrency(Number(sip.amount))} · {ordinal(sip.sip_day)} of month
                </span>
              </span>
              <span className={`text-[11px] font-medium flex-shrink-0 ${isPaid ? "text-green-700" : "text-[#86868b]"}`}>
                {isPaid ? "Paid" : "Mark paid"}
              </span>
            </button>
          )
        })}
      </div>

      {paidAmount > 0 && unpaidAmount === 0 && (
        <p className="text-[11px] text-green-700 dark:text-green-400 flex items-center gap-1">
          <Check className="w-3.5 h-3.5" />
          All SIPs marked for {monthLabel}
        </p>
      )}
    </div>
  )
}
