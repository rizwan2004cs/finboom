import type { Asset, Sip, Transaction } from "@/lib/types"

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
    if (t.type === "income") income += Number(t.amount)
    else expense += Number(t.amount)
  }
  return { income, expense, surplus: income - expense }
}

/** Active SIPs whose debit day is still ahead (or today) in the current month. */
export function sipsDueRestOfMonth(sips: Sip[], now: Date = new Date()): {
  amount: number
  count: number
  nextDay: number
} {
  const todayDay = now.getDate()
  const lastDayThisMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const effectiveSipDay = (day: number) => Math.min(day, lastDayThisMonth)
  const remaining = sips.filter((s) => s.active && effectiveSipDay(s.sip_day) >= todayDay)
  return {
    amount: remaining.reduce((sum, s) => sum + Number(s.amount), 0),
    count: remaining.length,
    nextDay: remaining.length > 0 ? Math.min(...remaining.map((s) => effectiveSipDay(s.sip_day))) : 0,
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
): Record<string, number> {
  const monthKey = monthKeyFromDate(now)
  const { income, expense, surplus } = sumCashflow(transactionsInMonth(transactions, monthKey))
  const sipsDue = sipsDueRestOfMonth(sips, now)
  const liquid = sumLiquidAssets(assets)
  const liquidAfterSips = Math.max(0, liquid - sipsDue.amount)
  const availableThisMonth = surplus - sipsDue.amount

  return {
    ...assetClassBreakdown(assets),
    [SNAPSHOT_META.monthlyIncome]: income,
    [SNAPSHOT_META.monthlyExpense]: expense,
    [SNAPSHOT_META.monthlySurplus]: surplus,
    [SNAPSHOT_META.sipsRemainder]: sipsDue.amount,
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
