import { describe, expect, it } from "vitest"
import type { Account, Transaction } from "@/lib/types"
import { ADJUSTMENT_CATEGORY, CREDIT_CARD_BILL_CATEGORY, TRANSFER_CATEGORY } from "@/lib/constants"
import {
  FUTURE_DATE_ERROR,
  isValidCategoryFor,
  spendGuardFor,
  transactionDateError,
} from "./transaction-guard"

function acc(overrides: Partial<Account> = {}): Account {
  return {
    id: "a1",
    user_id: "u1",
    profile_id: "p1",
    name: "HDFC",
    type: "bank",
    opening_balance: 1000,
    opening_date: "2026-01-10",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  }
}

function tx(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: Math.random().toString(36).slice(2),
    user_id: "u1",
    profile_id: "p1",
    type: "expense",
    category: "food",
    amount: 100,
    currency: "INR",
    date: "2026-02-01",
    account_id: "a1",
    created_at: "2026-02-01T00:00:00Z",
    ...overrides,
  }
}

const TODAY = "2026-03-15"

describe("transactionDateError", () => {
  it("accepts today and earlier dates", () => {
    expect(transactionDateError(TODAY, undefined, TODAY)).toBeNull()
    expect(transactionDateError("2026-03-01", undefined, TODAY)).toBeNull()
  })

  it("rejects future dates", () => {
    expect(transactionDateError("2026-03-16", undefined, TODAY)).toBe(FUTURE_DATE_ERROR)
  })

  it("rejects malformed and impossible dates", () => {
    expect(transactionDateError("", undefined, TODAY)).toBe(FUTURE_DATE_ERROR)
    expect(transactionDateError("15/03/2026", undefined, TODAY)).toBe(FUTURE_DATE_ERROR)
    expect(transactionDateError("2026-02-30", undefined, TODAY)).toBe(FUTURE_DATE_ERROR)
  })

  it("rejects dates before the account's opening date", () => {
    const err = transactionDateError("2026-01-09", acc(), TODAY)
    expect(err).toBe(
      'HDFC tracks its balance from 2026-01-10 — pick a later date or "Not tracked".',
    )
  })

  it("accepts the opening date itself", () => {
    expect(transactionDateError("2026-01-10", acc(), TODAY)).toBeNull()
  })

  it("ignores the account when null", () => {
    expect(transactionDateError("2025-01-01", null, TODAY)).toBeNull()
  })

  it("reports the future error before the opening-date error", () => {
    expect(transactionDateError("2026-04-01", acc({ opening_date: "2026-05-01" }), TODAY)).toBe(
      FUTURE_DATE_ERROR,
    )
  })

  it("defaults today to the local calendar date", () => {
    expect(transactionDateError("2000-01-01")).toBeNull()
    expect(transactionDateError("2999-01-01")).toBe(FUTURE_DATE_ERROR)
  })
})

describe("spendGuardFor", () => {
  it("allows a spend within the account balance", () => {
    const all = [tx({ amount: 300 })]
    expect(spendGuardFor(acc(), all, 700)).toBeNull()
  })

  it("rejects a spend that would overdraw a cash/bank account", () => {
    const all = [tx({ amount: 300 })]
    expect(spendGuardFor(acc(), all, 701)).toBe(
      'HDFC has only ₹700 — this would overdraw it. Pick another account or "Not tracked".',
    )
  })

  it("excludes the row being edited from the balance", () => {
    const editing = tx({ id: "edit-me", amount: 800 })
    const all = [editing, tx({ amount: 100 })]
    // Without exclusion the balance is 100, so 500 would be rejected.
    expect(spendGuardFor(acc(), all, 500)).not.toBeNull()
    // Excluding its own old contribution the balance is 900.
    expect(spendGuardFor(acc(), all, 500, "edit-me")).toBeNull()
    expect(spendGuardFor(acc(), all, 901, "edit-me")).not.toBeNull()
  })

  it("ignores transactions on other accounts and before the opening date", () => {
    const all = [
      tx({ account_id: "other", amount: 5000 }),
      tx({ date: "2026-01-01", amount: 5000 }),
    ]
    expect(spendGuardFor(acc(), all, 1000)).toBeNull()
  })

  it("uses the credit limit for cards and treats no limit as unlimited", () => {
    const card = acc({ id: "c1", name: "Visa", type: "credit_card", opening_balance: -2000, credit_limit: 10000 })
    const all = [tx({ account_id: "c1", amount: 3000 })]
    // Balance −5000 → 5000 available.
    expect(spendGuardFor(card, all, 5000)).toBeNull()
    expect(spendGuardFor(card, all, 5001)).toMatch(/credit left/)
    expect(spendGuardFor(acc({ ...card, credit_limit: null }), all, 1_000_000)).toBeNull()
  })

  it("rounds the spend to paise before comparing", () => {
    expect(spendGuardFor(acc(), [], 1000.004)).toBeNull()
  })
})

describe("isValidCategoryFor", () => {
  it("accepts income ids only for income", () => {
    expect(isValidCategoryFor("income", "salary")).toBe(true)
    expect(isValidCategoryFor("income", "other")).toBe(true)
    expect(isValidCategoryFor("income", "food")).toBe(false)
  })

  it("accepts expense ids only for expense", () => {
    expect(isValidCategoryFor("expense", "food")).toBe(true)
    expect(isValidCategoryFor("expense", "emi")).toBe(true)
    expect(isValidCategoryFor("expense", "salary")).toBe(false)
  })

  it("never accepts transfer, adjustment or credit_card_bill", () => {
    for (const type of ["income", "expense"] as const) {
      expect(isValidCategoryFor(type, TRANSFER_CATEGORY)).toBe(false)
      expect(isValidCategoryFor(type, ADJUSTMENT_CATEGORY)).toBe(false)
      expect(isValidCategoryFor(type, CREDIT_CARD_BILL_CATEGORY)).toBe(false)
    }
  })

  it("rejects unknown ids and empty strings", () => {
    expect(isValidCategoryFor("expense", "")).toBe(false)
    expect(isValidCategoryFor("expense", "Food")).toBe(false)
    expect(isValidCategoryFor("income", "bonus")).toBe(false)
  })
})
