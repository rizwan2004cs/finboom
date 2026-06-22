import { describe, it, expect } from "vitest"
import {
  sipFutureValue,
  stepUpSipFutureValue,
  lumpsumFutureValue,
  fdMaturity,
  requiredMonthlySip,
  hraExemption,
  computeNewRegimeTax,
  computeOldRegimeTax,
  compareRegimes,
  xirr,
} from "./calculators"

describe("sipFutureValue", () => {
  it("totals the invested amount correctly", () => {
    const r = sipFutureValue(10_000, 12, 10)
    expect(r.invested).toBe(1_200_000)
  })

  it("grows the corpus above the invested amount at a positive rate", () => {
    const r = sipFutureValue(10_000, 12, 10)
    // Start-of-month SIP @12% for 10y is ~₹23.2L.
    expect(r.futureValue).toBeGreaterThan(2_300_000)
    expect(r.futureValue).toBeLessThan(2_350_000)
    expect(r.gains).toBe(r.futureValue - r.invested)
  })

  it("returns invested == futureValue when the rate is zero", () => {
    const r = sipFutureValue(5_000, 0, 2)
    expect(r.futureValue).toBe(120_000)
    expect(r.invested).toBe(120_000)
    expect(r.gains).toBe(0)
  })

  it("guards against non-positive inputs", () => {
    expect(sipFutureValue(0, 12, 10).futureValue).toBe(0)
    expect(sipFutureValue(10_000, 12, 0).futureValue).toBe(0)
  })
})

describe("requiredMonthlySip", () => {
  it("is the inverse of sipFutureValue", () => {
    const target = 10_000_000
    const monthly = requiredMonthlySip(target, 12, 15)
    const achieved = sipFutureValue(monthly, 12, 15).futureValue
    // Within 0.1% of the target after rounding the monthly figure.
    expect(Math.abs(achieved - target) / target).toBeLessThan(0.001)
  })
})

describe("stepUpSipFutureValue", () => {
  it("beats a flat SIP of the same starting amount", () => {
    const flat = sipFutureValue(10_000, 12, 10).futureValue
    const stepped = stepUpSipFutureValue(10_000, 12, 10, 10).futureValue
    expect(stepped).toBeGreaterThan(flat)
  })
})

describe("lumpsumFutureValue", () => {
  it("compounds annually", () => {
    expect(lumpsumFutureValue(100_000, 10, 10).futureValue).toBe(259_374)
  })
})

describe("fdMaturity", () => {
  it("compounds quarterly by default", () => {
    expect(fdMaturity(100_000, 8, 5).futureValue).toBe(148_595)
  })
})

describe("hraExemption", () => {
  it("takes the minimum of the three statutory limits (metro)", () => {
    const r = hraExemption(600_000, 300_000, 240_000, true)
    // rent - 10% basic = 240000 - 60000 = 180000 is the binding limit.
    expect(r.exempt).toBe(180_000)
    expect(r.taxable).toBe(120_000)
  })

  it("uses 40% of basic for non-metro", () => {
    const r = hraExemption(600_000, 300_000, 300_000, false)
    expect(r.components.percentOfBasic).toBe(240_000)
  })
})

describe("income tax (FY 2025-26)", () => {
  it("makes income up to ₹12L tax-free under the new regime", () => {
    expect(computeNewRegimeTax(1_200_000, true).totalTax).toBe(0)
  })

  it("computes new-regime tax for ₹20L salaried", () => {
    const r = computeNewRegimeTax(2_000_000, true)
    expect(r.taxableIncome).toBe(1_925_000)
    expect(r.totalTax).toBe(192_400)
  })

  it("computes old-regime tax for ₹10L salaried with no extra deductions", () => {
    const r = computeOldRegimeTax(1_000_000, 0, true)
    expect(r.taxableIncome).toBe(950_000)
    expect(r.totalTax).toBe(106_600)
  })

  it("reports which regime is cheaper", () => {
    const c = compareRegimes(2_000_000, 0, true)
    expect(c.cheaper).toBe("new")
    expect(c.savings).toBe(Math.abs(c.old.totalTax - c.new.totalTax))
  })
})

describe("xirr", () => {
  it("returns ~10% for a one-year ~10% gain", () => {
    const rate = xirr([
      { date: new Date("2020-01-01"), amount: -1000 },
      { date: new Date("2021-01-01"), amount: 1100 },
    ])
    expect(rate).not.toBeNull()
    expect(rate ?? 0).toBeCloseTo(0.1, 2)
  })

  it("returns null without both an inflow and an outflow", () => {
    expect(xirr([{ date: new Date("2020-01-01"), amount: -1000 }])).toBeNull()
    expect(
      xirr([
        { date: new Date("2020-01-01"), amount: 100 },
        { date: new Date("2021-01-01"), amount: 200 },
      ])
    ).toBeNull()
  })
})
