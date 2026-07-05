import { insertRow, deleteRow } from "@/lib/offline"
import type { Sip, SipPayment, Transaction } from "@/lib/types"
import { todayLocalISO } from "@/lib/utils"

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

export async function markSipPaid(
  userId: string,
  sip: Sip,
  monthKey: string,
  paidDate: string = todayLocalISO(),
): Promise<{ ok: boolean; error?: string }> {
  const amount = Number(sip.amount)
  const { data: tx, error: txError } = await insertRow<Transaction>("transactions", {
    user_id: userId,
    profile_id: sip.profile_id,
    type: "expense",
    category: "investment",
    amount,
    description: sipExpenseDescription(sip),
    date: paidDate,
    currency: sip.currency || "INR",
  })
  if (txError || !tx) return { ok: false, error: txError ?? "Could not add expense" }

  const { error: payError } = await insertRow("sip_payments", {
    user_id: userId,
    sip_id: sip.id,
    month: monthKey,
    paid_date: paidDate,
    amount,
    transaction_id: tx.id,
  })
  if (payError) {
    await deleteRow("transactions", tx.id)
    return { ok: false, error: payError }
  }
  return { ok: true }
}

export async function unmarkSipPaid(payment: SipPayment): Promise<void> {
  if (payment.transaction_id) {
    await deleteRow("transactions", payment.transaction_id)
  }
  await deleteRow("sip_payments", payment.id)
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
