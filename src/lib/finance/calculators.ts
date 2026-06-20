// Pure, dependency-free financial math for the public /tools calculators.
// Everything here is deterministic and unit-testable; no React, no I/O.

export interface GrowthResult {
  invested: number
  futureValue: number
  gains: number
}

/**
 * SIP future value with contributions at the start of each month
 * (the convention AMCs use). `annualRatePct` is the expected return.
 */
export function sipFutureValue(
  monthly: number,
  annualRatePct: number,
  years: number
): GrowthResult {
  const n = Math.round(years * 12)
  const i = annualRatePct / 100 / 12
  const invested = monthly * n
  if (n <= 0 || monthly <= 0) return { invested: Math.max(0, invested), futureValue: 0, gains: 0 }

  let futureValue: number
  if (i === 0) {
    futureValue = monthly * n
  } else {
    futureValue = monthly * ((Math.pow(1 + i, n) - 1) / i) * (1 + i)
  }
  return roundResult({ invested, futureValue, gains: futureValue - invested })
}

/**
 * Step-up SIP: the monthly contribution rises by `stepUpPct` every 12 months.
 * Each year's contributions compound for the remaining tenure.
 */
export function stepUpSipFutureValue(
  startMonthly: number,
  annualRatePct: number,
  years: number,
  stepUpPct: number
): GrowthResult {
  const totalYears = Math.round(years)
  const i = annualRatePct / 100 / 12
  let futureValue = 0
  let invested = 0
  let monthly = startMonthly

  for (let year = 0; year < totalYears; year++) {
    for (let m = 0; m < 12; m++) {
      invested += monthly
      const monthsRemaining = (totalYears - year) * 12 - m
      futureValue += monthly * (i === 0 ? 1 : Math.pow(1 + i, monthsRemaining))
    }
    monthly *= 1 + stepUpPct / 100
  }
  return roundResult({ invested, futureValue, gains: futureValue - invested })
}

/** Lumpsum compounded annually. */
export function lumpsumFutureValue(
  principal: number,
  annualRatePct: number,
  years: number
): GrowthResult {
  const futureValue = principal * Math.pow(1 + annualRatePct / 100, years)
  return roundResult({ invested: principal, futureValue, gains: futureValue - principal })
}

/**
 * Fixed deposit maturity with `compoundingPerYear` (Indian FDs are usually
 * compounded quarterly = 4).
 */
export function fdMaturity(
  principal: number,
  annualRatePct: number,
  years: number,
  compoundingPerYear = 4
): GrowthResult {
  const f = Math.max(1, compoundingPerYear)
  const futureValue = principal * Math.pow(1 + annualRatePct / 100 / f, f * years)
  return roundResult({ invested: principal, futureValue, gains: futureValue - principal })
}

/**
 * Given a target corpus and date, the monthly SIP needed to reach it
 * (start-of-month convention).
 */
export function requiredMonthlySip(
  target: number,
  annualRatePct: number,
  years: number
): number {
  const n = Math.round(years * 12)
  const i = annualRatePct / 100 / 12
  if (n <= 0) return target
  if (i === 0) return target / n
  const factor = ((Math.pow(1 + i, n) - 1) / i) * (1 + i)
  return Math.round(target / factor)
}

export interface HraResult {
  exempt: number
  taxable: number
  components: { actualHra: number; rentMinus10: number; percentOfBasic: number }
}

/**
 * Annual HRA exemption u/s 10(13A) = min of:
 *  - actual HRA received
 *  - rent paid - 10% of basic salary
 *  - 50% (metro) / 40% (non-metro) of basic salary
 * All inputs are ANNUAL amounts.
 */
export function hraExemption(
  basicAnnual: number,
  hraReceivedAnnual: number,
  rentPaidAnnual: number,
  isMetro: boolean
): HraResult {
  const rentMinus10 = Math.max(0, rentPaidAnnual - 0.1 * basicAnnual)
  const percentOfBasic = (isMetro ? 0.5 : 0.4) * basicAnnual
  const exempt = Math.max(0, Math.min(hraReceivedAnnual, rentMinus10, percentOfBasic))
  return {
    exempt: Math.round(exempt),
    taxable: Math.round(Math.max(0, hraReceivedAnnual - exempt)),
    components: {
      actualHra: Math.round(hraReceivedAnnual),
      rentMinus10: Math.round(rentMinus10),
      percentOfBasic: Math.round(percentOfBasic),
    },
  }
}

// --- Income tax (FY 2025-26 / AY 2026-27) -----------------------------------

type Slab = { upTo: number; rate: number }

// New regime slabs after Budget 2025 (rebate makes <= 12L tax-free).
const NEW_REGIME_SLABS: Slab[] = [
  { upTo: 400000, rate: 0 },
  { upTo: 800000, rate: 0.05 },
  { upTo: 1200000, rate: 0.1 },
  { upTo: 1600000, rate: 0.15 },
  { upTo: 2000000, rate: 0.2 },
  { upTo: 2400000, rate: 0.25 },
  { upTo: Infinity, rate: 0.3 },
]

// Old regime slabs (individual < 60).
const OLD_REGIME_SLABS: Slab[] = [
  { upTo: 250000, rate: 0 },
  { upTo: 500000, rate: 0.05 },
  { upTo: 1000000, rate: 0.2 },
  { upTo: Infinity, rate: 0.3 },
]

const CESS = 0.04
const NEW_STANDARD_DEDUCTION = 75000
const OLD_STANDARD_DEDUCTION = 50000

function taxFromSlabs(taxable: number, slabs: Slab[]): number {
  let tax = 0
  let lower = 0
  for (const slab of slabs) {
    if (taxable <= lower) break
    const upper = Math.min(taxable, slab.upTo)
    tax += (upper - lower) * slab.rate
    lower = slab.upTo
  }
  return tax
}

export interface RegimeBreakdown {
  regime: "old" | "new"
  taxableIncome: number
  baseTax: number
  rebate: number
  cess: number
  totalTax: number
}

export function computeNewRegimeTax(grossIncome: number, isSalaried = true): RegimeBreakdown {
  const taxable = Math.max(0, grossIncome - (isSalaried ? NEW_STANDARD_DEDUCTION : 0))
  const baseTax = taxFromSlabs(taxable, NEW_REGIME_SLABS)
  // 87A rebate: taxable income up to 12L pays no tax.
  const rebate = taxable <= 1200000 ? baseTax : 0
  const afterRebate = Math.max(0, baseTax - rebate)
  const cess = afterRebate * CESS
  return {
    regime: "new",
    taxableIncome: Math.round(taxable),
    baseTax: Math.round(baseTax),
    rebate: Math.round(rebate),
    cess: Math.round(cess),
    totalTax: Math.round(afterRebate + cess),
  }
}

export function computeOldRegimeTax(
  grossIncome: number,
  deductions: number,
  isSalaried = true
): RegimeBreakdown {
  const totalDeductions = deductions + (isSalaried ? OLD_STANDARD_DEDUCTION : 0)
  const taxable = Math.max(0, grossIncome - totalDeductions)
  const baseTax = taxFromSlabs(taxable, OLD_REGIME_SLABS)
  // 87A rebate: taxable income up to 5L pays no tax.
  const rebate = taxable <= 500000 ? baseTax : 0
  const afterRebate = Math.max(0, baseTax - rebate)
  const cess = afterRebate * CESS
  return {
    regime: "old",
    taxableIncome: Math.round(taxable),
    baseTax: Math.round(baseTax),
    rebate: Math.round(rebate),
    cess: Math.round(cess),
    totalTax: Math.round(afterRebate + cess),
  }
}

export interface RegimeComparison {
  old: RegimeBreakdown
  new: RegimeBreakdown
  cheaper: "old" | "new" | "equal"
  savings: number
}

export function compareRegimes(
  grossIncome: number,
  oldDeductions: number,
  isSalaried = true
): RegimeComparison {
  const oldR = computeOldRegimeTax(grossIncome, oldDeductions, isSalaried)
  const newR = computeNewRegimeTax(grossIncome, isSalaried)
  let cheaper: "old" | "new" | "equal" = "equal"
  if (oldR.totalTax < newR.totalTax) cheaper = "old"
  else if (newR.totalTax < oldR.totalTax) cheaper = "new"
  return { old: oldR, new: newR, cheaper, savings: Math.abs(oldR.totalTax - newR.totalTax) }
}

// --- XIRR -------------------------------------------------------------------

export interface CashFlow {
  date: Date
  amount: number // negative = outflow/invested, positive = inflow/redemption
}

const DAY_MS = 24 * 60 * 60 * 1000

function xnpv(rate: number, flows: CashFlow[], t0: number): number {
  return flows.reduce((sum, f) => {
    const years = (f.date.getTime() - t0) / (365 * DAY_MS)
    return sum + f.amount / Math.pow(1 + rate, years)
  }, 0)
}

/**
 * Annualized internal rate of return for irregular cash flows.
 * Returns a decimal (0.12 = 12%) or null if it can't converge / inputs invalid.
 * Requires at least one negative and one positive flow.
 */
export function xirr(flows: CashFlow[]): number | null {
  if (flows.length < 2) return null
  const hasNeg = flows.some((f) => f.amount < 0)
  const hasPos = flows.some((f) => f.amount > 0)
  if (!hasNeg || !hasPos) return null

  const sorted = [...flows].sort((a, b) => a.date.getTime() - b.date.getTime())
  const t0 = sorted[0].date.getTime()

  // Newton-Raphson with a numeric derivative.
  let rate = 0.1
  for (let iter = 0; iter < 100; iter++) {
    const npv = xnpv(rate, sorted, t0)
    const d = (xnpv(rate + 1e-6, sorted, t0) - npv) / 1e-6
    if (Math.abs(d) < 1e-10) break
    const next = rate - npv / d
    if (!Number.isFinite(next)) break
    if (Math.abs(next - rate) < 1e-7) return clampRate(next)
    rate = next
  }

  // Fallback: bisection over a wide bracket.
  let lo = -0.9999
  let hi = 100
  let fLo = xnpv(lo, sorted, t0)
  for (let iter = 0; iter < 200; iter++) {
    const mid = (lo + hi) / 2
    const fMid = xnpv(mid, sorted, t0)
    if (Math.abs(fMid) < 1e-6) return clampRate(mid)
    if (Math.sign(fMid) === Math.sign(fLo)) {
      lo = mid
      fLo = fMid
    } else {
      hi = mid
    }
  }
  return null
}

function clampRate(rate: number): number | null {
  if (!Number.isFinite(rate) || rate <= -1) return null
  return rate
}

function roundResult(r: GrowthResult): GrowthResult {
  return {
    invested: Math.round(r.invested),
    futureValue: Math.round(r.futureValue),
    gains: Math.round(r.futureValue - r.invested),
  }
}
