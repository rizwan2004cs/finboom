import type { Asset, Sip, SipPayment, Transaction } from "@/lib/types"
import { sipExpenseDescription } from "@/lib/finance/sip-payments"
import { isAccountMovement } from "@/lib/finance/accounts"

/** YYYY-MM for a calendar month. */
export function monthKeyFromDate(date: Date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
}

export function transactionsInMonth(transactions: Transaction[], monthKey: string): Transaction[] {
  return transactions.filter((t) => (t.date || "").startsWith(monthKey))
}

export function sumCashflow(transactions: Transaction[]): {
  income: number
  expense: number
  surplus: number
} {
  let income = 0
  let expense = 0
  for (const t of transactions) {
    // Transfers between own accounts and balance adjustments move money
    // around but are not cashflow — counting them would inflate both sides.
    if (isAccountMovement(t)) continue
    if (t.type === "income") income += Number(t.amount)
    else expense += Number(t.amount)
  }
  return { income, expense, surplus: income - expense }
}

/** Active SIPs whose debit day is still ahead (or today) in the current month. */
export function sipsDueRestOfMonth(
  sips: Sip[],
  now: Date = new Date(),
  paidSipIds: Set<string> = new Set(),
): {
  amount: number
  count: number
  nextDay: number
} {
  const todayDay = now.getDate()
  const lastDayThisMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const effectiveSipDay = (day: number) => Math.min(day, lastDayThisMonth)
  const remaining = sips.filter(
    (s) => s.active && !paidSipIds.has(s.id) && effectiveSipDay(s.sip_day) >= todayDay,
  )
  return {
    amount: remaining.reduce((sum, s) => sum + Number(s.amount), 0),
    count: remaining.length,
    nextDay: remaining.length > 0 ? Math.min(...remaining.map((s) => effectiveSipDay(s.sip_day))) : 0,
  }
}

/** The YYYY-MM a SIP was set up — its first applicable month (local time).
 *  created_at is a UTC timestamptz; slicing it directly would shift a SIP
 *  created between 00:00 and 05:30 IST on the 1st into the previous month. */
export function sipStartMonthKey(sip: Sip): string {
  if (!sip.created_at) return ""
  const d = new Date(sip.created_at)
  return Number.isNaN(d.getTime()) ? "" : monthKeyFromDate(d)
}

/**
 * A SIP only counts for a month from the month it was set up onward, so paging
 * back to months before the SIP existed doesn't surface it as due.
 */
export function sipAppliesToMonth(sip: Sip, monthKey: string): boolean {
  const start = sipStartMonthKey(sip)
  return !start || monthKey >= start
}

export function isSkippedPayment(p: Pick<SipPayment, "status">): boolean {
  return p.status === "skipped"
}

/** Per-SIP paid / skipped / unpaid status for a calendar month. */
export function sipStatusForMonth(
  sips: Sip[],
  payments: SipPayment[],
  monthKey: string,
  transactions: Transaction[] = [],
): {
  paidIds: Set<string>
  skippedIds: Set<string>
  unpaid: Sip[]
  paid: Sip[]
  skipped: Sip[]
  unpaidAmount: number
  paidAmount: number
} {
  const monthPayments = payments.filter((p) => p.month === monthKey)
  const skippedIds = new Set(monthPayments.filter(isSkippedPayment).map((p) => p.sip_id))
  const paidIds = new Set(
    monthPayments.filter((p) => !isSkippedPayment(p)).map((p) => p.sip_id),
  )
  const active = sips.filter((s) => s.active && sipAppliesToMonth(s, monthKey))
  const monthTx = transactionsInMonth(transactions, monthKey)
  for (const sip of active) {
    if (paidIds.has(sip.id) || skippedIds.has(sip.id)) continue
    const desc = sipExpenseDescription(sip)
    const hasExpense = monthTx.some(
      (t) =>
        t.type === "expense" &&
        t.category === "investment" &&
        t.description === desc,
    )
    if (hasExpense) paidIds.add(sip.id)
  }
  const unpaid = active.filter((s) => !paidIds.has(s.id) && !skippedIds.has(s.id))
  const paid = active.filter((s) => paidIds.has(s.id))
  const skipped = active.filter((s) => skippedIds.has(s.id))
  return {
    paidIds,
    skippedIds,
    unpaid,
    paid,
    skipped,
    unpaidAmount: unpaid.reduce((sum, s) => sum + Number(s.amount), 0),
    paidAmount: paid.reduce((sum, s) => sum + Number(s.amount), 0),
  }
}

/** Cash + savings — the pool SIPs typically debit from. */
export const LIQUID_ASSET_CLASSES = new Set(["cash", "savings_account"])

export function sumLiquidAssets(assets: Asset[]): number {
  return assets
    .filter((a) => LIQUID_ASSET_CLASSES.has(a.asset_class))
    .reduce((sum, a) => sum + Number(a.current_value), 0)
}

/** Keys stored inside snapshot `asset_breakdown` for monthly metrics (prefixed _). */
export const SNAPSHOT_META = {
  monthlyIncome: "_monthly_income",
  monthlyExpense: "_monthly_expense",
  monthlySurplus: "_monthly_surplus",
  sipsRemainder: "_sips_remainder",
  liquidAssets: "_liquid_assets",
  liquidAfterSips: "_liquid_after_sips",
  availableThisMonth: "_available_this_month",
} as const

export function isSnapshotMetaKey(key: string): boolean {
  return key.startsWith("_")
}

export function assetClassBreakdown(assets: Asset[]): Record<string, number> {
  const breakdown: Record<string, number> = {}
  for (const a of assets) {
    breakdown[a.asset_class] = (breakdown[a.asset_class] ?? 0) + Number(a.current_value)
  }
  return breakdown
}

export function buildSnapshotBreakdown(
  assets: Asset[],
  transactions: Transaction[],
  sips: Sip[],
  now: Date = new Date(),
  sipPayments: SipPayment[] = [],
): Record<string, number> {
  const monthKey = monthKeyFromDate(now)
  const { income, expense, surplus } = sumCashflow(transactionsInMonth(transactions, monthKey))
  // Pass transactions so SIPs already logged as investment expenses count as paid
  // (otherwise they'd be subtracted twice: once in surplus, once in unpaidAmount).
  const { unpaidAmount, paidIds } = sipStatusForMonth(sips, sipPayments, monthKey, transactions)
  const liquid = sumLiquidAssets(assets)
  const liquidAfterSips = Math.max(0, liquid - unpaidAmount)
  const availableThisMonth = surplus - unpaidAmount

  return {
    ...assetClassBreakdown(assets),
    [SNAPSHOT_META.monthlyIncome]: income,
    [SNAPSHOT_META.monthlyExpense]: expense,
    [SNAPSHOT_META.monthlySurplus]: surplus,
    [SNAPSHOT_META.sipsRemainder]: unpaidAmount,
    [SNAPSHOT_META.liquidAssets]: liquid,
    [SNAPSHOT_META.liquidAfterSips]: liquidAfterSips,
    [SNAPSHOT_META.availableThisMonth]: availableThisMonth,
  }
}

export function readSnapshotMeta(breakdown: Record<string, number>) {
  const num = (key: string) => {
    const v = breakdown[key]
    return typeof v === "number" && Number.isFinite(v) ? v : null
  }
  return {
    monthlyIncome: num(SNAPSHOT_META.monthlyIncome),
    monthlyExpense: num(SNAPSHOT_META.monthlyExpense),
    monthlySurplus: num(SNAPSHOT_META.monthlySurplus),
    sipsRemainder: num(SNAPSHOT_META.sipsRemainder),
    liquidAssets: num(SNAPSHOT_META.liquidAssets),
    liquidAfterSips: num(SNAPSHOT_META.liquidAfterSips),
    availableThisMonth: num(SNAPSHOT_META.availableThisMonth),
  }
}

/** Income − expenses − unpaid SIP amount for a month. */
export function availableAfterUnpaidSips(
  transactions: Transaction[],
  sips: Sip[],
  payments: SipPayment[],
  monthKey: string,
): number {
  const { surplus } = sumCashflow(transactionsInMonth(transactions, monthKey))
  // Pass transactions so manually-logged SIP expenses aren't double-subtracted.
  const { unpaidAmount } = sipStatusForMonth(sips, payments, monthKey, transactions)
  return surplus - unpaidAmount
}
