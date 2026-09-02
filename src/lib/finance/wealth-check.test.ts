import { describe, it, expect } from "vitest"
import {
  averageMonthlyCashflow,
  computeWealthCheck,
  emergencyFundMonths,
  sixMonthWindowKey,
  type WealthInput,
} from "./wealth-check"
import type { Account, Asset, Liability, Transaction, Goal, HealthCheck } from "@/lib/types"
import { TRANSFER_CATEGORY } from "@/lib/constants"

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

const mkLiability = (o: Partial<Liability> = {}): Liability => ({
  id: "l", name: "Loan", liability_type: "personal_loan", outstanding_amount: 0,
  emi_amount: 0, interest_rate: 10, ...meta, ...o,
} as Liability)

const mkAccount = (o: Partial<Account> = {}): Account => ({
  id: "acc", user_id: "u", profile_id: "p", name: "Bank", type: "bank",
  opening_balance: 0, opening_date: "2024-01-01", created_at: "2024-01-01", updated_at: "2024-01-01", ...o,
})

const dim = (input: WealthInput, key: string) => computeWealthCheck(input).dimensions.find((d) => d.key === key)!

// Fixed reference date so month windows are deterministic.
const NOW = new Date(2026, 8, 15) // 15 Sep 2026

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

  describe("debt load with card dues", () => {
    it("does not score 100 when the only debt is on a credit card", () => {
      const card = mkAccount({ id: "card", type: "credit_card", opening_balance: -80_000 })
      const debt = dim({ ...emptyInput, liabilities: [], accounts: [card] }, "debt")
      expect(debt.score).not.toBe(100)
      expect(debt.score).toBe(0) // no assets → debt is 100% of assets
      expect(debt.detail).toContain("Card dues ₹80,000")
    })

    it("scores card dues against assets in the debt-to-assets branch", () => {
      const card = mkAccount({ id: "card", type: "credit_card", opening_balance: -80_000 })
      const debt = dim({
        ...emptyInput,
        accounts: [card],
        assets: [mkAsset({ current_value: 400_000 })],
      }, "debt")
      expect(debt.score).toBe(80) // 80k / 400k = 20%
    })

    it("derives card dues from the ledger, not just the opening balance", () => {
      const card = mkAccount({ id: "card", type: "credit_card", opening_balance: 0, opening_date: "2026-01-01" })
      const debt = dim({
        ...emptyInput,
        accounts: [card],
        transactions: [mkTxn({ type: "expense", category: "shopping", amount: 50_000, date: "2026-09-01", account_id: "card" })],
        assets: [mkAsset({ current_value: 100_000 })],
      }, "debt")
      expect(debt.score).toBe(50)
    })

    it("still reports no debt when a card is paid off", () => {
      const card = mkAccount({ id: "card", type: "credit_card", opening_balance: 0 })
      expect(dim({ ...emptyInput, accounts: [card] }, "debt").score).toBe(100)
    })

    it("in the EMI branch takes the lower of the EMI and debt-to-assets scores when cards carry dues", () => {
      const loan = mkLiability({ outstanding_amount: 200_000, emi_amount: 10_000 })
      const card = mkAccount({ id: "card", type: "credit_card", opening_balance: -80_000 })
      const base: WealthInput = {
        ...emptyInput,
        monthlyIncome: 100_000,
        liabilities: [loan],
        assets: [mkAsset({ current_value: 400_000 })],
      }
      // EMI ratio 10% → 100; no card dues → EMI score wins.
      expect(dim(base, "debt").score).toBe(100)
      // With dues: (200k + 80k) / 400k = 70% → 30, lower than the EMI score.
      const withCard = dim({ ...base, accounts: [card] }, "debt")
      expect(withCard.score).toBe(30)
      expect(withCard.detail).toContain("70% of assets")
    })

    it("keeps the EMI score when it is already the lower one", () => {
      const loan = mkLiability({ outstanding_amount: 100_000, emi_amount: 50_000 })
      const card = mkAccount({ id: "card", type: "credit_card", opening_balance: -10_000 })
      const debt = dim({
        ...emptyInput,
        monthlyIncome: 100_000,
        liabilities: [loan],
        accounts: [card],
        assets: [mkAsset({ current_value: 10_000_000 })],
      }, "debt")
      expect(debt.score).toBe(25) // EMI ratio 50% → 25; DTA ≈ 1% → 99
    })
  })

  describe("emergency fund", () => {
    const health: HealthCheck = { ...emptyHealth, monthly_expenses: 40_000, emergency_fund_months: 1 }

    it("derives months from cash & bank when accounts exist, ignoring the typed value", () => {
      const bank = mkAccount({ opening_balance: 240_000 })
      const fund = emergencyFundMonths({ health, accounts: [bank] })
      expect(fund).toEqual({ months: 6, source: "derived", cashAndBank: 240_000, monthlyExpense: 40_000 })
      const emergency = dim({ ...emptyInput, health, accounts: [bank] }, "emergency")
      expect(emergency.score).toBe(100)
      expect(emergency.detail).toContain("₹2,40,000")
    })

    it("excludes credit cards from the cash & bank pool", () => {
      const bank = mkAccount({ opening_balance: 120_000 })
      const card = mkAccount({ id: "card", type: "credit_card", opening_balance: -50_000 })
      expect(emergencyFundMonths({ health, accounts: [bank, card] }).months).toBe(3)
    })

    it("keeps the typed value when it is larger than what accounts show (FDs etc.)", () => {
      const bank = mkAccount({ opening_balance: 40_000 }) // 1 month
      const typed: HealthCheck = { ...health, emergency_fund_months: 4 }
      expect(emergencyFundMonths({ health: typed, accounts: [bank] })).toMatchObject({ months: 4, source: "manual" })
    })

    it("does not zero the score for an empty auto-seeded Cash account", () => {
      const cash = mkAccount({ id: "cash", type: "cash", opening_balance: 0 })
      const typed: HealthCheck = { ...health, emergency_fund_months: 3 }
      expect(emergencyFundMonths({ health: typed, accounts: [cash] })).toMatchObject({ months: 3, source: "manual" })
    })

    it("falls back to the typed value when the profile has no accounts", () => {
      expect(emergencyFundMonths({ health, accounts: [] })).toMatchObject({ months: 1, source: "manual" })
      expect(dim({ ...emptyInput, health }, "emergency").detail).toBe("1 of 6 recommended months saved.")
    })

    it("uses the 6-month average expense when monthly expenses are not typed", () => {
      const bank = mkAccount({ opening_balance: 90_000 })
      const transactions = [
        mkTxn({ id: "e1", type: "expense", category: "rent", amount: 40_000, date: "2026-09-01" }),
        mkTxn({ id: "e2", type: "expense", category: "rent", amount: 20_000, date: "2026-08-01" }),
        mkTxn({ id: "e3", type: "expense", category: "rent", amount: 999_999, date: "2026-03-31" }), // outside window
        mkTxn({ id: "x", type: "expense", category: TRANSFER_CATEGORY, amount: 500_000, date: "2026-09-02" }),
      ]
      const fund = emergencyFundMonths({ health: { ...health, monthly_expenses: 0 }, accounts: [bank], transactions, now: NOW })
      expect(fund.monthlyExpense).toBe(30_000)
      expect(fund.months).toBe(3)
      expect(fund.source).toBe("derived")
    })

    it("falls back to the typed months when accounts exist but expenses are unknown", () => {
      const bank = mkAccount({ opening_balance: 90_000 })
      const fund = emergencyFundMonths({ health: { ...health, monthly_expenses: 0 }, accounts: [bank], now: NOW })
      expect(fund).toMatchObject({ months: 1, source: "manual", cashAndBank: 90_000 })
    })

    it("falls back to the typed value when cash is overdrawn, and to zero when nothing is typed", () => {
      const bank = mkAccount({ opening_balance: -5_000 })
      expect(emergencyFundMonths({ health, accounts: [bank] })).toMatchObject({ months: 1, source: "manual" })
      const nothingTyped: HealthCheck = { ...health, emergency_fund_months: 0 }
      expect(emergencyFundMonths({ health: nothingTyped, accounts: [bank] }).months).toBe(0)
    })
  })

  describe("month windows", () => {
    it("starts the 6-month window on the first of the month five months back", () => {
      expect(sixMonthWindowKey(NOW)).toBe("2026-04")
      expect(sixMonthWindowKey(new Date(2026, 1, 3))).toBe("2025-09")
    })

    it("buckets by ISO month string, so the 1st of the window month is included", () => {
      const transactions = [
        mkTxn({ id: "i1", amount: 50_000, date: "2026-04-01" }),
        mkTxn({ id: "i2", amount: 50_000, date: "2026-03-31" }),
      ]
      expect(averageMonthlyCashflow(transactions, "income", NOW)).toBe(50_000)
      const savings = dim({
        ...emptyInput,
        now: NOW,
        transactions: [...transactions, mkTxn({ id: "e", type: "expense", category: "rent", amount: 35_000, date: "2026-09-10" })],
      }, "savings")
      expect(savings.detail).toContain("Saving 30%")
    })
  })
})
