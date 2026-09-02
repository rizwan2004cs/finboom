// Deterministic portfolio metrics computed purely from the user's own data.
// No AI, no external calls — this is the reliable Layer-1 engine behind the
// concentration analytics and the Wealth Check score.

import { ASSET_CLASSES } from "@/lib/constants"

export type MacroBucket = "equity" | "debt" | "gold" | "real_estate" | "cash" | "other"

const MACRO_MAP: Record<string, MacroBucket> = {
  stocks: "equity",
  mutual_funds: "equity",
  elss: "equity",
  us_stocks: "equity",
  international: "equity",
  crypto: "equity",
  fixed_deposits: "debt",
  ppf: "debt",
  epf: "debt",
  nps: "debt",
  ssy: "debt",
  recurring_deposit: "debt",
  bonds: "debt",
  ulip: "debt",
  lic: "debt",
  gold: "gold",
  silver: "gold",
  sgb: "gold",
  real_estate: "real_estate",
  savings_account: "cash",
  cash: "cash",
  other: "other",
}

export const MACRO_LABELS: Record<MacroBucket, string> = {
  equity: "Equity",
  debt: "Debt",
  gold: "Gold",
  real_estate: "Real estate",
  cash: "Cash",
  other: "Other",
}

export const MACRO_COLORS: Record<MacroBucket, string> = {
  equity: "bg-emerald-500",
  debt: "bg-sky-500",
  gold: "bg-amber-500",
  real_estate: "bg-violet-500",
  cash: "bg-slate-400",
  other: "bg-slate-300",
}

// Asset classes that can be sold/redeemed within a few days.
const LIQUID_CLASSES = new Set([
  "stocks",
  "mutual_funds",
  "savings_account",
  "cash",
  "us_stocks",
  "international",
  "crypto",
  "gold",
  "silver",
  "bonds",
])

// Asset classes that count toward Section 80C / tax-advantaged savings.
const TAX_SAVER_CLASSES = new Set(["elss", "ppf", "epf", "nps", "ssy", "lic", "ulip"])

export function getMacroBucket(assetClass: string): MacroBucket {
  return MACRO_MAP[assetClass] ?? "other"
}

export interface AssetLike {
  name: string
  asset_class: string
  current_value: number
  invested_value: number
}

const classLabel = (id: string) => ASSET_CLASSES.find((c) => c.id === id)?.label ?? id

export interface AllocationSlice {
  id: string
  label: string
  value: number
  pct: number
}

export function computeClassAllocation(assets: AssetLike[]): AllocationSlice[] {
  const total = assets.reduce((s, a) => s + Number(a.current_value), 0)
  if (total <= 0) return []
  const byClass = new Map<string, number>()
  for (const a of assets) {
    byClass.set(a.asset_class, (byClass.get(a.asset_class) ?? 0) + Number(a.current_value))
  }
  return [...byClass.entries()]
    .map(([id, value]) => ({ id, label: classLabel(id), value, pct: (value / total) * 100 }))
    .sort((a, b) => b.value - a.value)
}

export interface MacroSlice {
  bucket: MacroBucket
  label: string
  value: number
  pct: number
}

export function computeMacroAllocation(assets: AssetLike[]): MacroSlice[] {
  const total = assets.reduce((s, a) => s + Number(a.current_value), 0)
  if (total <= 0) return []
  const byBucket = new Map<MacroBucket, number>()
  for (const a of assets) {
    const bucket = getMacroBucket(a.asset_class)
    byBucket.set(bucket, (byBucket.get(bucket) ?? 0) + Number(a.current_value))
  }
  return [...byBucket.entries()]
    .map(([bucket, value]) => ({ bucket, label: MACRO_LABELS[bucket], value, pct: (value / total) * 100 }))
    .sort((a, b) => b.value - a.value)
}

export interface ConcentrationResult {
  total: number
  topHolding?: { name: string; pct: number }
  topClass?: { label: string; pct: number }
  hhi: number
  diversificationScore: number
  liquidPct: number
  equityPct: number
  debtPct: number
  warnings: string[]
}

/** `extraLiquid` = cash & bank account balances (tracked as accounts, not
 *  assets) so the liquidity check doesn't ignore money sitting in the bank. */
export function computeConcentration(assets: AssetLike[], extraLiquid = 0): ConcentrationResult {
  const liquidExtra = Math.max(0, extraLiquid)
  // Concentration (top holding, classes, HHI, equity/debt) is a question about
  // the INVESTED portfolio, so it uses the assets-only total; only liquidity
  // asks "of everything I hold, how much is quickly accessible".
  const invested = assets.reduce((s, a) => s + Number(a.current_value), 0)
  const total = invested + liquidExtra
  if (total <= 0 || assets.length === 0 || invested <= 0) {
    // Nothing invested: no concentration to measure; cash alone is 100% liquid.
    return { total: Math.max(0, total), hhi: 0, diversificationScore: 0, liquidPct: total > 0 ? 100 : 0, equityPct: 0, debtPct: 0, warnings: [] }
  }

  const sortedHoldings = [...assets].sort((a, b) => Number(b.current_value) - Number(a.current_value))
  const top = sortedHoldings[0]
  const topHolding = { name: top.name, pct: (Number(top.current_value) / invested) * 100 }

  const classes = computeClassAllocation(assets)
  const topClass = classes[0] ? { label: classes[0].label, pct: classes[0].pct } : undefined

  // Herfindahl-Hirschman Index over asset classes (0..10000).
  const hhi = classes.reduce((s, c) => s + Math.pow(c.pct / 100, 2), 0) * 10000
  const diversificationScore = Math.round(Math.max(0, Math.min(100, 100 - hhi / 100)))

  const macro = computeMacroAllocation(assets)
  const equityPct = macro.find((m) => m.bucket === "equity")?.pct ?? 0
  const debtPct = macro.find((m) => m.bucket === "debt")?.pct ?? 0
  const liquidValue = assets
    .filter((a) => LIQUID_CLASSES.has(a.asset_class))
    .reduce((s, a) => s + Number(a.current_value), 0) + liquidExtra
  const liquidPct = (liquidValue / total) * 100

  const warnings: string[] = []
  if (topHolding.pct > 25 && assets.length > 1) {
    warnings.push(
      `${topHolding.name} is ${topHolding.pct.toFixed(0)}% of your portfolio — a large single-holding bet. Consider trimming or diversifying.`
    )
  }
  if (topClass && topClass.pct > 60) {
    warnings.push(
      `${topClass.pct.toFixed(0)}% sits in ${topClass.label}. Spreading across asset classes lowers risk.`
    )
  }
  if (equityPct > 85) {
    warnings.push(
      `Your portfolio is ${equityPct.toFixed(0)}% equity — high growth, high volatility. A little debt adds stability.`
    )
  }
  if (debtPct > 85) {
    warnings.push(
      `${debtPct.toFixed(0)}% is in debt/fixed-income — safe, but may not beat inflation long term. Some equity aids growth.`
    )
  }
  if (liquidPct < 10 && total > 0) {
    warnings.push(
      `Only ${liquidPct.toFixed(0)}% of assets are quickly accessible. Keep an emergency buffer in liquid instruments.`
    )
  }

  return {
    total,
    topHolding,
    topClass,
    hhi,
    diversificationScore,
    liquidPct,
    equityPct,
    debtPct,
    warnings,
  }
}

export interface ReturnsResult {
  invested: number
  current: number
  gain: number
  gainPct: number
}

export function computeReturns(assets: AssetLike[]): ReturnsResult {
  const current = assets.reduce((s, a) => s + Number(a.current_value), 0)
  const invested = assets.reduce((s, a) => s + Number(a.invested_value), 0)
  const gain = current - invested
  return { invested, current, gain, gainPct: invested > 0 ? (gain / invested) * 100 : 0 }
}

export function computeTaxSaverTotal(assets: AssetLike[]): number {
  return assets
    .filter((a) => TAX_SAVER_CLASSES.has(a.asset_class))
    .reduce((s, a) => s + Number(a.invested_value || a.current_value), 0)
}
