import type { Sip, SipPayment, Transaction } from "@/lib/types"
import { todayLocalISO } from "@/lib/utils"
import { put, remove as idbRemove } from "@/lib/offline/db"

export function sipExpenseDescription(sip: Sip): string {
  const label = sip.fund_name || sip.name
  return `SIP: ${label}`
}

export const MONTH_FORWARD_DESCRIPTION = "Previous month's forward"

/** YYYY-MM for the calendar month before `monthKey`. */
export function previousMonthKey(monthKey: string): string {
  const [y, m] = monthKey.split("-").map(Number)
  const d = new Date(y, m - 2, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}

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
  paidDate: string = todayLocalISO(),
): Promise<{ ok: boolean; error?: string }> {
  if (!isOnline()) {
    return { ok: false, error: "Go online to mark SIPs paid" }
  }

  try {
    const res = await fetch("/api/sip-payments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sipId: sip.id, monthKey, paidDate }),
    })
    const data = await res.json()

    // Already paid on server — sync local state instead of showing an error.
    if (res.status === 409) {
      const existing = await fetchSipPaymentFromApi(sip.id, monthKey)
      if (existing) return { ok: true }
      return { ok: false, error: data.error ?? "Already marked paid" }
    }

    if (!res.ok) {
      return { ok: false, error: data.error ?? "Could not mark paid" }
    }
    await cacheMarkResult(data.transaction as Transaction, data.payment as SipPayment)
    return { ok: true }
  } catch {
    return { ok: false, error: "Network error — try again" }
  }
}

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
): Promise<{ marked: number; failed: number }> {
  let marked = 0
  let failed = 0
  const paidDate = todayLocalISO()
  for (const sip of sips) {
    const result = await markSipPaid(userId, sip, monthKey, paidDate)
    if (result.ok) marked++
    else failed++
  }
  return { marked, failed }
}

/** Carry surplus left from the previous month into this month as income. */
export async function ensureMonthCarryForward(
  userId: string,
  profileId: string,
  monthKey: string,
  amount: number,
  existingTransactions: Transaction[],
): Promise<boolean> {
  if (amount <= 0) return false
  const already = existingTransactions.some(
    (t) =>
      t.type === "income" &&
      t.description === MONTH_FORWARD_DESCRIPTION &&
      (t.date || "").startsWith(monthKey),
  )
  if (already) return false

  const { insertRow } = await import("@/lib/offline")
  const firstDay = `${monthKey}-01`

  const { error } = await insertRow("transactions", {
    user_id: userId,
    profile_id: profileId,
    type: "income",
    category: "other",
    amount,
    description: MONTH_FORWARD_DESCRIPTION,
    date: firstDay,
    currency: "INR",
  })
  return !error
}
