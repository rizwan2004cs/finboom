// Wealth Check — a single 0-100 score across the pillars of a healthy financial
// life. Every number is computed deterministically from the user's own data;
// nothing is invented. Powers the headline score on the health page.

import type { Asset, Goal, Liability, Transaction, HealthCheck } from "@/lib/types"
import { computeConcentration, computeTaxSaverTotal } from "./portfolio"

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

function allocationDimension(assets: Asset[]): WealthDimension {
  const conc = computeConcentration(assets)
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

function emergencyDimension(health: HealthCheck): WealthDimension {
  const months = Number(health.emergency_fund_months) || 0
  const score = clamp((months / 6) * 100)
  return {
    key: "emergency",
    label: "Emergency fund",
    score: Math.round(score),
    status: statusFor(score),
    weight: 1.2,
    detail: `${months} of 6 recommended months saved.`,
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

function debtDimension(
  liabilities: Liability[],
  assets: Asset[],
  monthlyIncome: number
): WealthDimension {
  const totalEmi = liabilities.reduce((s, l) => s + Number(l.emi_amount || 0), 0)
  const outstanding = liabilities.reduce((s, l) => s + Number(l.outstanding_amount || 0), 0)

  let score: number
  let detail: string
  let action: string | undefined

  if (outstanding <= 0) {
    score = 100
    detail = "No outstanding debt — excellent."
  } else if (monthlyIncome > 0) {
    const ratio = (totalEmi / monthlyIncome) * 100
    score = emiScoreFromRatio(ratio)
    detail = `EMIs are ${ratio.toFixed(0)}% of income.`
    action = score < 75 ? "Keep EMIs under ~30–40% of income; prepay high-interest loans." : undefined
  } else {
    const totalAssets = assets.reduce((s, a) => s + Number(a.current_value), 0)
    const dta = totalAssets > 0 ? (outstanding / totalAssets) * 100 : 100
    score = clamp(100 - dta)
    detail = `Debt is ${dta.toFixed(0)}% of assets.`
    action = score < 75 ? "Reduce debt relative to assets; prioritise high-interest loans." : undefined
  }

  return { key: "debt", label: "Debt load", score: Math.round(score), status: statusFor(score), weight: 1, detail, action }
}

function savingsDimension(transactions: Transaction[]): WealthDimension {
  const now = new Date()
  const windowStart = new Date(now.getFullYear(), now.getMonth() - 5, 1)
  const recent = transactions.filter((t) => new Date(t.date) >= windowStart)
  const income = recent.filter((t) => t.type === "income").reduce((s, t) => s + Number(t.amount), 0)
  const expense = recent.filter((t) => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0)
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
  const { assets, liabilities, transactions, goals, health, monthlyIncome } = input
  const dimensions: WealthDimension[] = [
    allocationDimension(assets),
    emergencyDimension(health),
    insuranceDimension(health, monthlyIncome),
    taxDimension(assets),
    debtDimension(liabilities, assets, monthlyIncome),
    savingsDimension(transactions),
    goalsDimension(goals, assets),
  ]

  const totalWeight = dimensions.reduce((s, d) => s + d.weight, 0)
  const score = Math.round(dimensions.reduce((s, d) => s + d.score * d.weight, 0) / totalWeight)
  return { score, grade: gradeFor(score), dimensions }
}
