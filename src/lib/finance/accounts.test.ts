import { describe, expect, it } from "vitest"
import type { Account, Transaction } from "@/lib/types"
import {
  accountBalance,
  accountLedger,
  cardAvailable,
  cardOutstanding,
  cashAndBankAccounts,
  formatLedgerBalance,
  isAccountMovement,
  nextBillDueDate,
  spendGuardError,
  summarizeCards,
  untrackedCardDues,
  withoutAccountMovements,
} from "./accounts"
import { sumCashflow } from "./monthly-cashflow"

function acc(overrides: Partial<Account> = {}): Account {
  return {
    id: "a1",
    user_id: "u1",
    profile_id: "p1",
    name: "Cash",
    type: "cash",
    opening_balance: 1000,
    opening_date: "2026-01-01",
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
    created_at: "2026-02-01T00:00:00Z",
    ...overrides,
  }
}

describe("isAccountMovement", () => {
  it("flags transfer and adjustment categories only", () => {
    expect(isAccountMovement(tx({ category: "transfer" }))).toBe(true)
    expect(isAccountMovement(tx({ category: "adjustment" }))).toBe(true)
    expect(isAccountMovement(tx({ category: "food" }))).toBe(false)
    expect(isAccountMovement(tx({ category: "salary" }))).toBe(false)
  })

  it("withoutAccountMovements strips only movements", () => {
    const list = [tx({ category: "transfer" }), tx({ category: "rent" }), tx({ category: "adjustment" })]
    expect(withoutAccountMovements(list).map((t) => t.category)).toEqual(["rent"])
  })
})

describe("accountBalance", () => {
  it("is opening balance when no transactions are tagged", () => {
    expect(accountBalance(acc(), [tx()])).toBe(1000)
  })

  it("adds income and subtracts expenses tagged with the account", () => {
    const txs = [
      tx({ account_id: "a1", type: "income", amount: 500 }),
      tx({ account_id: "a1", type: "expense", amount: 200 }),
      tx({ account_id: "other", type: "expense", amount: 999 }),
      tx({ type: "expense", amount: 50 }), // untagged
    ]
    expect(accountBalance(acc(), txs)).toBe(1300)
  })

  it("includes transfer legs and adjustments in the balance", () => {
    const txs = [
      tx({ account_id: "a1", type: "expense", amount: 300, category: "transfer", transfer_group_id: "g1" }),
      tx({ account_id: "a1", type: "income", amount: 40, category: "adjustment" }),
    ]
    expect(accountBalance(acc(), txs)).toBe(740)
  })

  it("can go negative", () => {
    const txs = [tx({ account_id: "a1", type: "expense", amount: 1500 })]
    expect(accountBalance(acc(), txs)).toBe(-500)
  })

  it("skips transactions dated before the opening as-of date (already in the opening balance)", () => {
    const txs = [
      tx({ account_id: "a1", type: "expense", amount: 400, date: "2025-12-30" }),
      tx({ account_id: "a1", type: "income", amount: 200, date: "2026-01-01" }), // same day counts
    ]
    expect(accountBalance(acc({ opening_date: "2026-01-01" }), txs)).toBe(1200)
  })
})

describe("accountLedger", () => {
  it("runs oldest→newest from the opening balance and returns newest first", () => {
    const txs = [
      tx({ id: "t2", account_id: "a1", type: "expense", amount: 200, date: "2026-02-02" }),
      tx({ id: "t1", account_id: "a1", type: "income", amount: 500, date: "2026-02-01" }),
      tx({ id: "tx-other", account_id: "b9", type: "income", amount: 1, date: "2026-02-01" }),
      tx({ id: "pre-opening", account_id: "a1", type: "expense", amount: 999, date: "2025-12-31" }),
    ]
    const rows = accountLedger(acc(), txs)
    expect(rows.map((r) => r.transaction.id)).toEqual(["t2", "t1"])
    // t1 first chronologically: 1000 + 500 = 1500, then t2: 1500 - 200 = 1300
    expect(rows.find((r) => r.transaction.id === "t1")?.balanceAfter).toBe(1500)
    expect(rows.find((r) => r.transaction.id === "t2")?.balanceAfter).toBe(1300)
  })

  it("orders same-day rows by created_at", () => {
    const txs = [
      tx({ id: "late", account_id: "a1", type: "expense", amount: 100, date: "2026-02-01", created_at: "2026-02-01T10:00:00Z" }),
      tx({ id: "early", account_id: "a1", type: "income", amount: 100, date: "2026-02-01", created_at: "2026-02-01T09:00:00Z" }),
    ]
    const rows = accountLedger(acc(), txs)
    expect(rows.map((r) => r.transaction.id)).toEqual(["late", "early"])
    expect(rows.find((r) => r.transaction.id === "early")?.balanceAfter).toBe(1100)
    expect(rows.find((r) => r.transaction.id === "late")?.balanceAfter).toBe(1000)
  })
})

describe("sumCashflow excludes account movements", () => {
  it("ignores transfer legs and adjustments in income/expense/surplus", () => {
    const txs = [
      tx({ type: "income", amount: 1000, category: "salary" }),
      tx({ type: "expense", amount: 400, category: "rent" }),
      tx({ type: "expense", amount: 300, category: "transfer", transfer_group_id: "g1" }),
      tx({ type: "income", amount: 300, category: "transfer", transfer_group_id: "g1" }),
      tx({ type: "income", amount: 50, category: "adjustment" }),
    ]
    expect(sumCashflow(txs)).toEqual({ income: 1000, expense: 400, surplus: 600 })
  })
})

describe("credit cards", () => {
  const card = acc({ id: "c1", name: "Regalia", type: "credit_card", opening_balance: -5000, credit_limit: 100000, bill_due_day: 15 })
  const bank = acc({ id: "b1", name: "HDFC", type: "bank", opening_balance: 20000 })

  it("derives outstanding from a negative balance and available from the limit", () => {
    const txs = [
      { id: "t1", account_id: "c1", type: "expense", amount: 3000, date: "2026-02-01" } as Transaction,
      { id: "t2", account_id: "c1", type: "income", amount: 8000, date: "2026-02-10", category: "transfer" } as Transaction,
      { id: "t3", account_id: "c1", type: "expense", amount: 1500, date: "2026-02-12" } as Transaction,
    ]
    const balance = accountBalance(card, txs) // -5000 -3000 +8000 -1500 = -1500
    expect(balance).toBe(-1500)
    expect(cardOutstanding(balance)).toBe(1500)
    expect(cardOutstanding(200)).toBe(0)
    expect(cardAvailable(card, balance)).toBe(98500)
    expect(cardAvailable(acc({ type: "credit_card", credit_limit: null }), -100)).toBeNull()
  })

  it("splits cash/bank from cards and totals dues", () => {
    expect(cashAndBankAccounts([card, bank]).map((a) => a.id)).toEqual(["b1"])
    const summary = summarizeCards([card, bank], [], new Date(2026, 1, 10))
    expect(summary.cards).toHaveLength(1)
    expect(summary.totalOutstanding).toBe(5000)
    expect(summary.nextDue?.dueDate).toBe("2026-02-15")
    expect(summary.nextDue?.daysToDue).toBe(5)
  })

  it("rolls the due date to next month once it has passed and clamps to month length", () => {
    expect(nextBillDueDate({ bill_due_day: 15 }, new Date(2026, 1, 20))).toBe("2026-03-15")
    expect(nextBillDueDate({ bill_due_day: 31 }, new Date(2026, 1, 1))).toBe("2026-02-28")
    expect(nextBillDueDate({ bill_due_day: null }, new Date(2026, 1, 1))).toBeNull()
  })

  it("guards cash against overdraft and cards against the limit", () => {
    expect(spendGuardError(bank, 1000, 1500)).toMatch(/overdraw/)
    expect(spendGuardError(bank, 1000, 1000)).toBeNull()
    expect(spendGuardError(card, -99000, 500)).toBeNull()
    expect(spendGuardError(card, -99000, 1500)).toMatch(/exceed/)
    expect(spendGuardError(acc({ type: "credit_card", credit_limit: null }), -500000, 1)).toBeNull()
  })
})

describe("computeNetWorth", () => {
  it("adds cash & bank to assets and card dues to liabilities, one formula everywhere", async () => {
    const { computeNetWorth } = await import("./net-worth")
    const accounts = [
      acc({ id: "b1", type: "bank", opening_balance: 0 }),
      acc({ id: "c1", type: "credit_card", opening_balance: -6353 }),
    ]
    const txs = [
      { id: "t1", account_id: "b1", type: "income", amount: 59000, date: "2026-09-01" } as Transaction,
    ]
    const w = computeNetWorth({
      assets: [{ current_value: 133629 }],
      liabilities: [],
      accounts,
      transactions: txs,
    })
    expect(w.investments).toBe(133629)
    expect(w.cashAndBank).toBe(59000)
    expect(w.cardDues).toBe(6353)
    expect(w.totalAssets).toBe(192629)
    expect(w.totalLiabilities).toBe(6353)
    expect(w.netWorth).toBe(186276)
  })
})

describe("untrackedCardDues", () => {
  const card = acc({ id: "c1", type: "credit_card", opening_balance: -6353, opening_date: "2026-09-01" })
  it("is the opening outstanding until bill payments clear it", () => {
    expect(untrackedCardDues(card, [])).toBe(6353)
    const partPaid = [
      { account_id: "c1", type: "income", category: "transfer", amount: 2000, date: "2026-09-02" } as Transaction,
      // a swipe on the card doesn't change what's untracked
      { account_id: "c1", type: "expense", category: "food", amount: 500, date: "2026-09-02" } as Transaction,
    ]
    expect(untrackedCardDues(card, partPaid)).toBe(4353)
    const fullyPaid = [
      { account_id: "c1", type: "income", category: "transfer", amount: 6353, date: "2026-09-02" } as Transaction,
    ]
    expect(untrackedCardDues(card, fullyPaid)).toBe(0)
  })
  it("is zero for cash/bank accounts and cards opened with no dues", () => {
    expect(untrackedCardDues(acc({ type: "bank", opening_balance: 500 }), [])).toBe(0)
    expect(untrackedCardDues(acc({ type: "credit_card", opening_balance: 0 }), [])).toBe(0)
  })
})

describe("formatLedgerBalance", () => {
  const fmt = (n: number) => `₹${n.toLocaleString("en-IN")}`
  it("reads a card's negative balance as dues and positive as credit", () => {
    expect(formatLedgerBalance(true, -6353, fmt)).toBe("₹6,353 due")
    expect(formatLedgerBalance(true, 250, fmt)).toBe("₹250 credit")
    expect(formatLedgerBalance(true, 0, fmt)).toBe("No dues")
  })
  it("formats cash/bank balances as-is, sign included", () => {
    expect(formatLedgerBalance(false, 59000, fmt)).toBe("₹59,000")
    expect(formatLedgerBalance(false, -120, fmt)).toBe("₹-120")
    expect(formatLedgerBalance(false, 0, fmt)).toBe("₹0")
  })
})
