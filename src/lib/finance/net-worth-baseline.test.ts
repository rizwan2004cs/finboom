import { describe, expect, it } from "vitest"
import { computeNetWorth, NET_WORTH_SNAPSHOT_META } from "./net-worth"
import {
  netWorthComparableTo,
  snapshotNetWorthComparableTo,
  snapshotUsesCurrentFormula,
  type BaselineSnapshot,
} from "./net-worth-baseline"

const oldRow: BaselineSnapshot = {
  net_worth: 300_000,
  asset_breakdown: { equity: 500_000 },
}

const newRow: BaselineSnapshot = {
  net_worth: 340_000,
  asset_breakdown: {
    equity: 500_000,
    [NET_WORTH_SNAPSHOT_META.cashAndBank]: 50_000,
    [NET_WORTH_SNAPSHOT_META.cardDues]: 10_000,
  },
}

const newRowNoCash: BaselineSnapshot = {
  net_worth: 300_000,
  asset_breakdown: { equity: 500_000, [NET_WORTH_SNAPSHOT_META.cashAndBank]: 0 },
}

// investments 500k, cash 80k, loans 200k, card dues 15k → net 365k
const wealth = computeNetWorth({
  assets: [{ current_value: 500_000 }],
  liabilities: [{ outstanding_amount: 200_000 }],
  accounts: [
    { id: "bank", type: "bank", opening_balance: 80_000, opening_date: "2024-01-01" },
    { id: "card", type: "credit_card", opening_balance: 0, opening_date: "2024-01-01" },
  ],
  transactions: [{ account_id: "card", type: "expense", amount: 15_000, date: "2024-02-01" }],
})

describe("snapshotUsesCurrentFormula", () => {
  it("is false for rows written before cash & bank were tracked", () => {
    expect(snapshotUsesCurrentFormula(oldRow)).toBe(false)
  })

  it("keys off presence, so a zero cash balance still counts as current", () => {
    expect(snapshotUsesCurrentFormula(newRow)).toBe(true)
    expect(snapshotUsesCurrentFormula(newRowNoCash)).toBe(true)
  })

  it("tolerates a missing breakdown", () => {
    expect(
      snapshotUsesCurrentFormula({ net_worth: 1, asset_breakdown: null as unknown as Record<string, number> }),
    ).toBe(false)
  })
})

describe("netWorthComparableTo", () => {
  it("returns the full formula against a current-formula baseline", () => {
    expect(wealth.netWorth).toBe(365_000)
    expect(netWorthComparableTo(wealth, newRow)).toBe(365_000)
    expect(netWorthComparableTo(wealth, newRowNoCash)).toBe(365_000)
  })

  it("returns the full formula when there is no baseline", () => {
    expect(netWorthComparableTo(wealth, null)).toBe(365_000)
    expect(netWorthComparableTo(wealth, undefined)).toBe(365_000)
  })

  it("falls back to investments − loans against an old-formula baseline", () => {
    expect(netWorthComparableTo(wealth, oldRow)).toBe(300_000)
  })
})

describe("snapshotNetWorthComparableTo", () => {
  it("leaves a row untouched when the baseline uses the current formula", () => {
    expect(snapshotNetWorthComparableTo(newRow, newRowNoCash)).toBe(340_000)
    expect(snapshotNetWorthComparableTo(oldRow, newRow)).toBe(300_000)
  })

  it("strips cash & bank and card dues from a new row diffed against an old one", () => {
    // 340k − 50k cash + 10k card dues = investments − loans
    expect(snapshotNetWorthComparableTo(newRow, oldRow)).toBe(300_000)
  })

  it("leaves old-vs-old and baseline-less comparisons alone", () => {
    expect(snapshotNetWorthComparableTo(oldRow, oldRow)).toBe(300_000)
    expect(snapshotNetWorthComparableTo(newRow, null)).toBe(340_000)
  })

  it("coerces numeric strings from Postgres", () => {
    const stringy = { ...newRow, net_worth: "340000" as unknown as number }
    expect(snapshotNetWorthComparableTo(stringy, oldRow)).toBe(300_000)
  })
})
