import { describe, it, expect } from "vitest"
import {
  getMacroBucket,
  computeClassAllocation,
  computeMacroAllocation,
  computeConcentration,
  computeReturns,
  computeTaxSaverTotal,
  type AssetLike,
} from "./portfolio"

const asset = (over: Partial<AssetLike>): AssetLike => ({
  name: "X",
  asset_class: "stocks",
  current_value: 100,
  invested_value: 100,
  ...over,
})

describe("getMacroBucket", () => {
  it("maps asset classes into macro buckets", () => {
    expect(getMacroBucket("stocks")).toBe("equity")
    expect(getMacroBucket("ppf")).toBe("debt")
    expect(getMacroBucket("gold")).toBe("gold")
    expect(getMacroBucket("real_estate")).toBe("real_estate")
    expect(getMacroBucket("savings_account")).toBe("cash")
  })

  it("falls back to 'other' for unknown classes", () => {
    expect(getMacroBucket("dogecoin_to_the_moon")).toBe("other")
  })
})

describe("computeClassAllocation", () => {
  it("returns percentages that sum to 100", () => {
    const slices = computeClassAllocation([
      asset({ asset_class: "stocks", current_value: 300 }),
      asset({ asset_class: "gold", current_value: 100 }),
    ])
    const sum = slices.reduce((s, x) => s + x.pct, 0)
    expect(sum).toBeCloseTo(100, 6)
    expect(slices[0].pct).toBe(75) // sorted desc, stocks is largest
  })

  it("returns an empty array when there is no value", () => {
    expect(computeClassAllocation([])).toEqual([])
  })
})

describe("computeMacroAllocation", () => {
  it("aggregates classes into macro buckets", () => {
    const macro = computeMacroAllocation([
      asset({ asset_class: "stocks", current_value: 100 }),
      asset({ asset_class: "mutual_funds", current_value: 100 }),
      asset({ asset_class: "ppf", current_value: 200 }),
    ])
    const equity = macro.find((m) => m.bucket === "equity")
    expect(equity?.pct).toBe(50)
  })
})

describe("computeConcentration", () => {
  it("returns zeroed metrics for an empty portfolio", () => {
    const c = computeConcentration([])
    expect(c.total).toBe(0)
    expect(c.warnings).toEqual([])
  })

  it("warns when a single holding dominates", () => {
    const c = computeConcentration([
      asset({ name: "Reliance", asset_class: "stocks", current_value: 800 }),
      asset({ name: "Gold", asset_class: "gold", current_value: 200 }),
    ])
    expect(c.topHolding?.name).toBe("Reliance")
    expect(c.topHolding?.pct).toBe(80)
    expect(c.warnings.some((w) => w.includes("Reliance"))).toBe(true)
  })

  it("scores a diversified portfolio higher than a concentrated one", () => {
    const concentrated = computeConcentration([asset({ asset_class: "stocks", current_value: 1000 })])
    const diversified = computeConcentration([
      asset({ asset_class: "stocks", current_value: 250 }),
      asset({ asset_class: "ppf", current_value: 250 }),
      asset({ asset_class: "gold", current_value: 250 }),
      asset({ asset_class: "real_estate", current_value: 250 }),
    ])
    expect(diversified.diversificationScore).toBeGreaterThan(concentrated.diversificationScore)
  })
})

describe("computeReturns", () => {
  it("computes gain and gain percentage", () => {
    const r = computeReturns([asset({ current_value: 120, invested_value: 100 })])
    expect(r.gain).toBe(20)
    expect(r.gainPct).toBeCloseTo(20, 6)
  })

  it("avoids dividing by zero when nothing is invested", () => {
    expect(computeReturns([asset({ current_value: 0, invested_value: 0 })]).gainPct).toBe(0)
  })
})

describe("computeTaxSaverTotal", () => {
  it("only counts 80C-eligible classes", () => {
    const total = computeTaxSaverTotal([
      asset({ asset_class: "elss", invested_value: 50_000 }),
      asset({ asset_class: "ppf", invested_value: 100_000 }),
      asset({ asset_class: "stocks", invested_value: 999_999 }),
    ])
    expect(total).toBe(150_000)
  })
})

describe("computeConcentration with cash & bank", () => {
  it("counts account balances as liquid and in the total", () => {
    const assets = [
      { name: "Nifty", asset_class: "mutual_fund", current_value: 90000 },
      { name: "Flat", asset_class: "real_estate", current_value: 10000 },
    ] as Parameters<typeof computeConcentration>[0]
    const without = computeConcentration(assets)
    const withCash = computeConcentration(assets, 100000)
    expect(without.liquidPct).toBe(0)
    expect(withCash.total).toBe(200000)
    expect(withCash.liquidPct).toBe(50)
    expect(withCash.warnings.some((w) => w.includes("quickly accessible"))).toBe(false)
    // negative (overdrawn) cash adds nothing
    expect(computeConcentration(assets, -500).total).toBe(100000)
  })
})
