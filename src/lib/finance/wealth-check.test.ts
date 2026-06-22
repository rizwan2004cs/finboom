import { describe, it, expect } from "vitest"
import { computeWealthCheck, type WealthInput } from "./wealth-check"
import type { Asset, Liability, Transaction, Goal, HealthCheck } from "@/lib/types"

const meta = { user_id: "u", profile_id: "p", currency: "INR", created_at: "2024-01-01", updated_at: "2024-01-01" }

const mkAsset = (o: Partial<Asset> = {}): Asset => ({
  id: "a", name: "A", asset_class: "stocks", current_value: 0, invested_value: 0, ...meta, ...o,
})

const mkGoal = (o: Partial<Goal> = {}): Goal => ({
  id: "g", name: "G", target_amount: 0, current_amount: 0, target_date: "2030-01-01",
  inflation_rate: 6, linked_assets: [], ...meta, ...o,
})

const mkTxn = (o: Partial<Transaction> = {}): Transaction => ({
  id: "t", type: "income", category: "salary", amount: 0, date: "2024-01-01",
  user_id: "u", profile_id: "p", currency: "INR", created_at: "2024-01-01", ...o,
})

const emptyHealth: HealthCheck = {
  has_term_insurance: false, term_insurance_cover: 0,
  has_health_insurance: false, health_insurance_cover: 0,
  emergency_fund_months: 0, monthly_expenses: 0,
}

const emptyInput: WealthInput = {
  assets: [], liabilities: [], transactions: [], goals: [],
  health: emptyHealth, monthlyIncome: 0,
}

describe("computeWealthCheck", () => {
  it("always returns a bounded score, a grade, and seven dimensions", () => {
    const r = computeWealthCheck(emptyInput)
    expect(r.dimensions).toHaveLength(7)
    expect(r.score).toBeGreaterThanOrEqual(0)
    expect(r.score).toBeLessThanOrEqual(100)
    expect(typeof r.grade).toBe("string")
  })

  it("scores an empty profile as 'Needs work'", () => {
    const r = computeWealthCheck(emptyInput)
    expect(r.score).toBeLessThan(45)
    expect(r.grade).toBe("Needs work")
  })

  it("gives a full emergency-fund score at six months of cover", () => {
    const r = computeWealthCheck({
      ...emptyInput,
      health: { ...emptyHealth, emergency_fund_months: 6 },
    })
    const emergency = r.dimensions.find((d) => d.key === "emergency")
    expect(emergency?.score).toBe(100)
    expect(emergency?.status).toBe("strong")
  })

  it("rates a well-rounded profile far higher than an empty one", () => {
    const today = new Date().toISOString().slice(0, 10)
    const strong: WealthInput = {
      monthlyIncome: 100_000,
      assets: [
        mkAsset({ asset_class: "stocks", current_value: 250_000, invested_value: 200_000 }),
        mkAsset({ asset_class: "ppf", current_value: 250_000, invested_value: 250_000 }),
        mkAsset({ asset_class: "gold", current_value: 250_000, invested_value: 200_000 }),
        mkAsset({ asset_class: "elss", current_value: 250_000, invested_value: 150_000 }),
      ],
      liabilities: [] as Liability[],
      transactions: [
        mkTxn({ type: "income", amount: 100_000, date: today }),
        mkTxn({ id: "t2", type: "expense", category: "rent", amount: 40_000, date: today }),
      ],
      goals: [mkGoal({ target_amount: 100_000, current_amount: 90_000 })],
      health: {
        has_term_insurance: true, term_insurance_cover: 20_000_000,
        has_health_insurance: true, health_insurance_cover: 1_000_000,
        emergency_fund_months: 6, monthly_expenses: 40_000,
      },
    }
    const strongScore = computeWealthCheck(strong).score
    const emptyScore = computeWealthCheck(emptyInput).score
    expect(strongScore).toBeGreaterThan(75)
    expect(strongScore).toBeGreaterThan(emptyScore + 40)
  })
})
