// Wealth Check — a single 0-100 score across the pillars of a healthy financial
// life. Every number is computed deterministically from the user's own data;
// nothing is invented. Powers the headline score on the health page.

import type { Account, Asset, Goal, Liability, Transaction, HealthCheck } from "@/lib/types"
import { computeConcentration, computeTaxSaverTotal } from "./portfolio"
import { isAccountMovement } from "./accounts"
import { computeNetWorth } from "./net-worth"
import { monthKeyFromDate } from "./monthly-cashflow"

export type DimStatus = "strong" | "fair" | "weak"

export interface WealthDimension {
  key: string
  label: string
  score: number
  status: DimStatus
  detail: string
  action?: string
  weight: number
}

export interface WealthCheckResult {
  score: number
  grade: string
  dimensions: WealthDimension[]
}

export interface WealthInput {
  assets: Asset[]
  liabilities: Liability[]
  transactions: Transaction[]
  goals: Goal[]
  health: HealthCheck
  monthlyIncome: number
  /** Cash, bank and card accounts of the profile. When present, card dues
   *  count as debt and the emergency fund is derived from live balances. */
  accounts?: Account[]
  /** Reference date for the trailing 6-month windows (defaults to now). */
  now?: Date
}

export const EMERGENCY_FUND_TARGET_MONTHS = 6

export interface EmergencyFundMonths {
  months: number
  /** "derived" = cash & bank ÷ monthly expenses; "manual" = the typed value. */
  source: "derived" | "manual"
  cashAndBank: number
  /** Monthly expense figure the derivation used (0 when unknown). */
  monthlyExpense: number
}

const clamp = (n: number) => Math.max(0, Math.min(100, n))

function statusFor(score: number): DimStatus {
  if (score >= 75) return "strong"
  if (score >= 45) return "fair"
  return "weak"
}

function gradeFor(score: number): string {
  if (score >= 80) return "Excellent"
  if (score >= 65) return "Good"
  if (score >= 45) return "Fair"
  return "Needs work"
}

function emiScoreFromRatio(ratioPct: number): number {
  if (ratioPct <= 20) return 100
  if (ratioPct >= 60) return 0
  return 100 - ((ratioPct - 20) / 40) * 100
}

const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`

/** YYYY-MM of the first of the 6-calendar-month window ending in `now`
 *  (this month plus the five before it). Compared as strings against
 *  `t.date` so the window never depends on the runtime timezone. */
export function sixMonthWindowKey(now: Date = new Date()): string {
  return monthKeyFromDate(new Date(now.getFullYear(), now.getMonth() - 5, 1))
}

function recentCashflowRows(transactions: Transaction[], type: Transaction["type"], now: Date): Transaction[] {
  const windowKey = sixMonthWindowKey(now)
  return transactions.filter(
    (t) => t.type === type && !isAccountMovement(t) && (t.date || "").slice(0, 7) >= windowKey,
  )
}

/** Average monthly income/expense over the trailing 6 calendar months, divided
 *  by the number of months that actually had rows (not a flat 6) so a profile
 *  with one month of history isn't averaged down to a sixth of reality. */
export function averageMonthlyCashflow(
  transactions: Transaction[],
  type: Transaction["type"],
  now: Date = new Date(),
): number {
  const rows = recentCashflowRows(transactions, type, now)
  if (rows.length === 0) return 0
  const total = rows.reduce((s, t) => s + Number(t.amount), 0)
  const months = new Set(rows.map((t) => t.date.slice(0, 7)))
  return total / months.size
}

/** Months of expenses covered by the emergency fund. Derived from live cash &
 *  bank balances whenever the profile has accounts and a monthly expense
 *  figure (typed, else the 6-month average); the hand-typed value is only a
 *  fallback for profiles without accounts. */
export function emergencyFundMonths(input: {
  health: Pick<HealthCheck, "emergency_fund_months" | "monthly_expenses">
  accounts?: Account[]
  transactions?: Transaction[]
  now?: Date
}): EmergencyFundMonths {
  const { health, accounts = [], transactions = [], now = new Date() } = input
  const manual = { months: Number(health.emergency_fund_months) || 0, source: "manual" as const, cashAndBank: 0, monthlyExpense: 0 }
  if (accounts.length === 0) return manual
  const { cashAndBank } = computeNetWorth({ assets: [], liabilities: [], accounts, transactions })
  const monthlyExpense = Number(health.monthly_expenses) || averageMonthlyCashflow(transactions, "expense", now)
  // Every profile gets a seeded (often empty) Cash account, so "has accounts"
  // is not evidence the user keeps their buffer in tracked accounts. Derive
  // from live balances, but never below what they typed — the typed figure
  // can include FDs and other instruments that aren't accounts.
  if (monthlyExpense <= 0 || cashAndBank <= 0) return { ...manual, cashAndBank }
  const derived = cashAndBank / monthlyExpense
  if (derived < manual.months) return { ...manual, cashAndBank, monthlyExpense }
  return { months: derived, source: "derived", cashAndBank, monthlyExpense }
}

function allocationDimension(assets: Asset[], cashAndBank: number): WealthDimension {
  const conc = computeConcentration(assets, cashAndBank)
  const score = assets.length === 0 ? 0 : conc.diversificationScore
  let action: string | undefined
  if (assets.length === 0) action = "Add your investments to analyse allocation."
  else if (conc.warnings.length > 0) action = conc.warnings[0]
  return {
    key: "allocation",
    label: "Asset allocation",
    score,
    status: statusFor(score),
    weight: 1.2,
    detail:
      assets.length === 0
        ? "No assets tracked yet."
        : `Equity ${conc.equityPct.toFixed(0)}% · Debt ${conc.debtPct.toFixed(0)}% · Diversification ${conc.diversificationScore}/100.`,
    action,
  }
}

function emergencyDimension(
  health: HealthCheck,
  accounts: Account[] | undefined,
  transactions: Transaction[],
  now: Date,
): WealthDimension {
  const fund = emergencyFundMonths({ health, accounts, transactions, now })
  const score = clamp((fund.months / EMERGENCY_FUND_TARGET_MONTHS) * 100)
  const monthsLabel = Number.isInteger(fund.months) ? String(fund.months) : fund.months.toFixed(1)
  const detail =
    fund.source === "derived"
      ? `Cash & bank ${inr(fund.cashAndBank)} covers ${monthsLabel} of ${EMERGENCY_FUND_TARGET_MONTHS} recommended months (${inr(fund.monthlyExpense)}/month).`
      : `${monthsLabel} of ${EMERGENCY_FUND_TARGET_MONTHS} recommended months saved.`
  return {
    key: "emergency",
    label: "Emergency fund",
    score: Math.round(score),
    status: statusFor(score),
    weight: 1.2,
    detail,
    action: score < 75 ? "Build a buffer of 6 months of expenses in a liquid fund." : undefined,
  }
}

function insuranceDimension(health: HealthCheck, monthlyIncome: number): WealthDimension {
  const annualIncome = monthlyIncome * 12
  const idealTerm = annualIncome * 10
  const idealHealth = Math.max(500000, annualIncome * 0.5)
  // Score 0 ("unknown") when income — and thus the ideal cover — can't be
  // estimated, instead of dividing by a 1-rupee floor that always returns 100%.
  const termScore = health.has_term_insurance && idealTerm > 0
    ? clamp((health.term_insurance_cover / idealTerm) * 100)
    : 0
  const healthScore = health.has_health_insurance
    ? clamp((health.health_insurance_cover / Math.max(idealHealth, 1)) * 100)
    : 0
  const score = Math.round((termScore + healthScore) / 2)
  return {
    key: "insurance",
    label: "Insurance cover",
    score,
    status: statusFor(score),
    weight: 1,
    detail: `${health.has_term_insurance ? "Term ✓" : "No term"} · ${health.has_health_insurance ? "Health ✓" : "No health"}.`,
    action: score < 75 ? "Aim for ~10× income term cover and adequate family health cover." : undefined,
  }
}

function taxDimension(assets: Asset[]): WealthDimension {
  const used = computeTaxSaverTotal(assets)
  const score = clamp((used / 150000) * 100)
  return {
    key: "tax",
    label: "Tax efficiency (80C)",
    score: Math.round(score),
    status: statusFor(score),
    weight: 0.8,
    detail: `${inr(used)} of ₹1,50,000 used via ELSS/PPF/EPF/NPS.`,
    action: score < 75 ? "Use remaining 80C headroom (ELSS, PPF, NPS) to cut tax." : undefined,
  }
}

function debtToAssets(outstanding: number, assets: Asset[]): { pct: number; score: number } {
  const totalAssets = assets.reduce((s, a) => s + Number(a.current_value), 0)
  const pct = totalAssets > 0 ? (outstanding / totalAssets) * 100 : 100
  return { pct, score: clamp(100 - pct) }
}

function debtDimension(
  liabilities: Liability[],
  assets: Asset[],
  monthlyIncome: number,
  cardDues: number,
): WealthDimension {
  const totalEmi = liabilities.reduce((s, l) => s + Number(l.emi_amount || 0), 0)
  const loans = liabilities.reduce((s, l) => s + Number(l.outstanding_amount || 0), 0)
  // Same debt net worth counts: loans plus credit-card dues.
  const outstanding = loans + cardDues
  const duesNote = cardDues > 0 ? ` Card dues ${inr(cardDues)}.` : ""

  let score: number
  let detail: string
  let action: string | undefined

  if (outstanding <= 0) {
    score = 100
    detail = "No outstanding debt — excellent."
  } else if (totalEmi > 0 && monthlyIncome > 0) {
    // Only score by EMI ratio when EMIs are actually recorded — otherwise
    // outstanding debt with no EMI data scored a perfect 100 ("EMIs are 0%").
    const ratio = (totalEmi / monthlyIncome) * 100
    score = emiScoreFromRatio(ratio)
    detail = `EMIs are ${ratio.toFixed(0)}% of income.${duesNote}`
    if (cardDues > 0) {
      // Card dues carry no EMI, so an EMI-only score would ignore them.
      const dta = debtToAssets(outstanding, assets)
      if (dta.score < score) {
        score = dta.score
        detail = `EMIs are ${ratio.toFixed(0)}% of income; debt is ${dta.pct.toFixed(0)}% of assets.${duesNote}`
      }
    }
    action = score < 75 ? "Keep EMIs under ~30–40% of income; prepay high-interest loans and clear card dues." : undefined
  } else {
    const dta = debtToAssets(outstanding, assets)
    score = dta.score
    detail = `Debt is ${dta.pct.toFixed(0)}% of assets.${duesNote}`
    action = score < 75 ? "Reduce debt relative to assets; prioritise high-interest loans and card dues." : undefined
  }

  return { key: "debt", label: "Debt load", score: Math.round(score), status: statusFor(score), weight: 1, detail, action }
}

function savingsDimension(transactions: Transaction[], now: Date): WealthDimension {
  const sum = (rows: Transaction[]) => rows.reduce((s, t) => s + Number(t.amount), 0)
  const income = sum(recentCashflowRows(transactions, "income", now))
  const expense = sum(recentCashflowRows(transactions, "expense", now))
  const rate = income > 0 ? (income - expense) / income : 0
  const score = income > 0 ? clamp((rate / 0.3) * 100) : 0
  return {
    key: "savings",
    label: "Savings rate",
    score: Math.round(score),
    status: statusFor(score),
    weight: 1,
    detail: income > 0 ? `Saving ${(rate * 100).toFixed(0)}% of income (last 6 months).` : "Not enough income data yet.",
    action: score < 75 ? "Aim to save 20–30% of your income each month." : undefined,
  }
}

function goalsDimension(goals: Goal[], assets: Asset[]): WealthDimension {
  if (goals.length === 0) {
    return {
      key: "goals",
      label: "Goal progress",
      score: 40,
      status: statusFor(40),
      weight: 0.8,
      detail: "No goals set.",
      action: "Set a goal (retirement, home, fund) to track progress.",
    }
  }
  const assetById = new Map(assets.map((a) => [a.id, Number(a.current_value)]))
  const pcts = goals.map((g) => {
    const funded = g.linked_assets?.length
      ? g.linked_assets.reduce((s, id) => s + (assetById.get(id) ?? 0), 0)
      : Number(g.current_amount || 0)
    return g.target_amount > 0 ? Math.min(100, (funded / g.target_amount) * 100) : 0
  })
  const avg = pcts.reduce((s, p) => s + p, 0) / pcts.length
  return {
    key: "goals",
    label: "Goal progress",
    score: Math.round(avg),
    status: statusFor(avg),
    weight: 0.8,
    detail: `${goals.length} goal${goals.length > 1 ? "s" : ""}, avg ${avg.toFixed(0)}% funded.`,
    action: avg < 75 ? "Increase contributions or link assets to your goals." : undefined,
  }
}

export function computeWealthCheck(input: WealthInput): WealthCheckResult {
  const { assets, liabilities, transactions, goals, health, monthlyIncome, accounts, now = new Date() } = input
  const { cardDues, cashAndBank } = computeNetWorth({ assets: [], liabilities: [], accounts, transactions })
  const dimensions: WealthDimension[] = [
    allocationDimension(assets, cashAndBank),
    emergencyDimension(health, accounts, transactions, now),
    insuranceDimension(health, monthlyIncome),
    taxDimension(assets),
    debtDimension(liabilities, assets, monthlyIncome, cardDues),
    savingsDimension(transactions, now),
    goalsDimension(goals, assets),
  ]

  const totalWeight = dimensions.reduce((s, d) => s + d.weight, 0)
  const score = Math.round(dimensions.reduce((s, d) => s + d.score * d.weight, 0) / totalWeight)
  return { score, grade: gradeFor(score), dimensions }
}
