import type { Sip, SipPayment, Transaction } from "@/lib/types"
import { todayLocalISO } from "@/lib/utils"
import { put, remove as idbRemove } from "@/lib/offline/db"

// Defined in monthly-cashflow.ts (IDB-free) so server code can use it; kept
// here for existing importers.
export { sipExpenseDescription } from "@/lib/finance/monthly-cashflow"

function isOnline(): boolean {
  return typeof navigator !== "undefined" ? navigator.onLine : true
}

async function cacheMarkResult(transaction: Transaction, payment: SipPayment) {
  await put("transactions", transaction)
  await put("sip_payments", payment)
}

async function cacheUnmarkResult(payment: SipPayment) {
  if (payment.transaction_id) {
    await idbRemove("transactions", payment.transaction_id)
  }
  await idbRemove("sip_payments", payment.id)
}

async function fetchSipPaymentFromApi(
  sipId: string,
  monthKey: string,
): Promise<SipPayment | null> {
  const res = await fetch(
    `/api/sip-payments?${new URLSearchParams({ sipId, month: monthKey })}`,
  )
  const data = await res.json()
  if (!res.ok) return null
  const payment = (data.payments as SipPayment[] | undefined)?.[0]
  if (payment) await put("sip_payments", payment)
  return payment ?? null
}

export async function markSipPaid(
  _userId: string,
  sip: Sip,
  monthKey: string,
  paidDate?: string,
): Promise<{ ok: boolean; error?: string; payment?: SipPayment }> {
  if (!isOnline()) {
    return { ok: false, error: "Go online to mark SIPs paid" }
  }

  // The expense must land inside the month being marked. Today's date is only
  // valid for the current month — when marking a past month, use the SIP's
  // debit day clamped to that month's length, otherwise the expense would hit
  // this month's cashflow and block the current month's real payment.
  let effectiveDate = paidDate ?? todayLocalISO()
  if (!effectiveDate.startsWith(monthKey)) {
    const [y, m] = monthKey.split("-").map(Number)
    const lastDay = new Date(y, m, 0).getDate()
    effectiveDate = `${monthKey}-${String(Math.min(sip.sip_day, lastDay)).padStart(2, "0")}`
  }

  try {
    const res = await fetch("/api/sip-payments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sipId: sip.id, monthKey, paidDate: effectiveDate }),
    })
    const data = await res.json()

    // Already paid on server — sync local + query cache instead of showing an error.
    if (res.status === 409) {
      const payment = data.payment as SipPayment | undefined
      if (payment) {
        await put("sip_payments", payment)
        return { ok: true, payment }
      }
      const existing = await fetchSipPaymentFromApi(sip.id, monthKey)
      if (existing) return { ok: true, payment: existing }
      return { ok: false, error: data.error ?? "Already marked paid" }
    }

    if (!res.ok) {
      return { ok: false, error: data.error ?? "Could not mark paid" }
    }
    const payment = data.payment as SipPayment
    await cacheMarkResult(data.transaction as Transaction, payment)
    return { ok: true, payment }
  } catch {
    return { ok: false, error: "Network error — try again" }
  }
}

/** Skip a SIP for a month — no expense is created and it no longer counts as due. */
export async function skipSip(
  sip: Sip,
  monthKey: string,
): Promise<{ ok: boolean; error?: string; payment?: SipPayment }> {
  if (!isOnline()) {
    return { ok: false, error: "Go online to skip SIPs" }
  }
  try {
    const res = await fetch("/api/sip-payments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sipId: sip.id, monthKey, skip: true }),
    })
    const data = await res.json()
    const payment = data.payment as SipPayment | undefined
    if (res.status === 409 && payment) {
      await put("sip_payments", payment)
      return { ok: true, payment }
    }
    if (!res.ok || !payment) {
      return { ok: false, error: data.error ?? "Could not skip" }
    }
    await put("sip_payments", payment)
    return { ok: true, payment }
  } catch {
    return { ok: false, error: "Network error — try again" }
  }
}

/** Undo a skip (same as unmarking — the month row is removed). */
export const unskipSip = unmarkSipPaid

export async function unmarkSipPaid(payment: SipPayment): Promise<{ ok: boolean; error?: string }> {
  if (!isOnline()) {
    return { ok: false, error: "Go online to undo" }
  }

  try {
    const res = await fetch("/api/sip-payments", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paymentId: payment.id }),
    })
    const data = await res.json()
    if (!res.ok) {
      return { ok: false, error: data.error ?? "Could not undo" }
    }
    await cacheUnmarkResult(payment)
    return { ok: true }
  } catch {
    return { ok: false, error: "Network error — try again" }
  }
}

export async function markAllSipsPaid(
  userId: string,
  sips: Sip[],
  monthKey: string,
): Promise<{ marked: number; failed: number; payments: SipPayment[] }> {
  let marked = 0
  let failed = 0
  const payments: SipPayment[] = []
  for (const sip of sips) {
    // Let markSipPaid pick the date so past months clamp per-SIP correctly.
    const result = await markSipPaid(userId, sip, monthKey)
    if (result.ok) {
      marked++
      if (result.payment) payments.push(result.payment)
    } else failed++
  }
  return { marked, failed, payments }
}
