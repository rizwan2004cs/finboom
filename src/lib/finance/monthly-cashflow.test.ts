import { describe, it, expect } from "vitest"
import {
  monthKeyFromDate,
  sumCashflow,
  sipsDueRestOfMonth,
  sumLiquidAssets,
  buildSnapshotBreakdown,
  isSnapshotMetaKey,
  sipStatusForMonth,
  sipExpenseDescription,
  availableAfterUnpaidSips,
} from "./monthly-cashflow"
import type { Asset, Sip, SipPayment, Transaction } from "@/lib/types"

describe("monthKeyFromDate", () => {
  it("formats as YYYY-MM", () => {
    expect(monthKeyFromDate(new Date(2026, 5, 15))).toBe("2026-06")
  })
})

describe("sumCashflow", () => {
  it("computes income minus expense", () => {
    const txs = [
      { type: "income", amount: 50000 } as Transaction,
      { type: "expense", amount: 20000 } as Transaction,
      { type: "expense", amount: 10000 } as Transaction,
    ]
    expect(sumCashflow(txs)).toEqual({ income: 50000, expense: 30000, surplus: 20000 })
  })
})

describe("sipsDueRestOfMonth", () => {
  it("includes only active SIPs on or after today", () => {
    const sips = [
      { active: true, sip_day: 5, amount: 1000 } as Sip,
      { active: true, sip_day: 25, amount: 2000 } as Sip,
      { active: false, sip_day: 10, amount: 500 } as Sip,
    ]
    const now = new Date(2026, 5, 15)
    expect(sipsDueRestOfMonth(sips, now)).toEqual({ amount: 2000, count: 1, nextDay: 25 })
  })
})

describe("sumLiquidAssets", () => {
  it("sums cash and savings only", () => {
    const assets = [
      { asset_class: "cash", current_value: 5000 } as Asset,
      { asset_class: "savings_account", current_value: 15000 } as Asset,
      { asset_class: "mutual_funds", current_value: 100000 } as Asset,
    ]
    expect(sumLiquidAssets(assets)).toBe(20000)
  })
})

describe("buildSnapshotBreakdown", () => {
  it("embeds monthly metrics with _ prefix keys", () => {
    const now = new Date(2026, 5, 20)
    const breakdown = buildSnapshotBreakdown(
      [{ asset_class: "cash", current_value: 10000 } as Asset],
      [
        { type: "income", amount: 40000, date: "2026-06-01" } as Transaction,
        { type: "expense", amount: 15000, date: "2026-06-10" } as Transaction,
      ],
      [{ active: true, sip_day: 25, amount: 3000 } as Sip],
      now,
    )
    expect(breakdown.cash).toBe(10000)
    expect(breakdown._monthly_income).toBe(40000)
    expect(breakdown._monthly_expense).toBe(15000)
    expect(breakdown._monthly_surplus).toBe(25000)
    expect(breakdown._sips_remainder).toBe(3000)
    expect(breakdown._liquid_after_sips).toBe(7000)
    expect(breakdown._available_this_month).toBe(22000)
  })
})

describe("isSnapshotMetaKey", () => {
  it("flags underscore-prefixed keys", () => {
    expect(isSnapshotMetaKey("_monthly_income")).toBe(true)
    expect(isSnapshotMetaKey("mutual_funds")).toBe(false)
  })
})

describe("sipStatusForMonth", () => {
  it("splits paid and unpaid active SIPs for the month", () => {
    const sips = [
      { id: "a", active: true, amount: 1000 } as Sip,
      { id: "b", active: true, amount: 2000 } as Sip,
      { id: "c", active: false, amount: 500 } as Sip,
    ]
    const payments = [{ sip_id: "a", month: "2026-07", transaction_id: "t1" } as SipPayment]
    const status = sipStatusForMonth(sips, payments, "2026-07")
    expect(status.unpaid).toHaveLength(1)
    expect(status.unpaid[0].id).toBe("b")
    expect(status.unpaidAmount).toBe(2000)
    expect(status.paidAmount).toBe(1000)
  })

  it("keeps skipped SIPs out of unpaid and out of the due amount", () => {
    const sips = [
      { id: "a", active: true, amount: 1000 } as Sip,
      { id: "b", active: true, amount: 2000 } as Sip,
    ]
    const payments = [
      { sip_id: "a", month: "2026-07", status: "skipped" } as SipPayment,
    ]
    const status = sipStatusForMonth(sips, payments, "2026-07")
    expect(status.skipped.map((s) => s.id)).toEqual(["a"])
    expect(status.paid).toHaveLength(0)
    expect(status.unpaid.map((s) => s.id)).toEqual(["b"])
    expect(status.unpaidAmount).toBe(2000)
    expect(availableAfterUnpaidSips([], sips, payments, "2026-07")).toBe(-2000)
  })

  it("treats matching investment expenses as paid when no sip_payment row", () => {
    const sips = [{ id: "a", active: true, amount: 1000, fund_name: "ABC Fund" } as Sip]
    const txs = [
      {
        type: "expense",
        category: "investment",
        amount: 1000,
        date: "2026-07-05",
        description: "SIP: ABC Fund",
      } as Transaction,
    ]
    const status = sipStatusForMonth(sips, [], "2026-07", txs)
    expect(status.unpaid).toHaveLength(0)
    expect(status.paid).toHaveLength(1)
  })

  it("heals an orphaned paid row (transaction_id null) whose expense is gone", () => {
    const sips = [{ id: "a", active: true, amount: 1000, fund_name: "ABC Fund" } as Sip]
    const orphan = { sip_id: "a", month: "2026-07", transaction_id: null } as SipPayment
    // Expense deleted → FK nulled transaction_id → SIP is due again.
    const gone = sipStatusForMonth(sips, [orphan], "2026-07", [])
    expect(gone.paidIds.has("a")).toBe(false)
    expect(gone.unpaid.map((s) => s.id)).toEqual(["a"])
    expect(gone.unpaidAmount).toBe(1000)
    // Expense still present in the month → row stands.
    const present = sipStatusForMonth(sips, [orphan], "2026-07", [
      { type: "expense", category: "investment", amount: 1000, date: "2026-07-05", description: "SIP: ABC Fund" } as Transaction,
    ])
    expect(present.paidIds.has("a")).toBe(true)
    expect(present.unpaid).toHaveLength(0)
    // Expense in another month doesn't count for July.
    const otherMonth = sipStatusForMonth(sips, [orphan], "2026-07", [
      { type: "expense", category: "investment", amount: 1000, date: "2026-08-05", description: "SIP: ABC Fund" } as Transaction,
    ])
    expect(otherMonth.unpaid).toHaveLength(1)
  })

  it("keeps a linked paid row as paid even without transactions", () => {
    const sips = [{ id: "a", active: true, amount: 1000, fund_name: "ABC Fund" } as Sip]
    const linked = { sip_id: "a", month: "2026-07", transaction_id: "t1" } as SipPayment
    expect(sipStatusForMonth(sips, [linked], "2026-07").paidIds.has("a")).toBe(true)
  })
})

describe("sipExpenseDescription", () => {
  it("prefers the fund name and falls back to the SIP name", () => {
    expect(sipExpenseDescription({ name: "Monthly", fund_name: "ABC Fund" })).toBe("SIP: ABC Fund")
    expect(sipExpenseDescription({ name: "Monthly" })).toBe("SIP: Monthly")
  })
})

describe("availableAfterUnpaidSips", () => {
  it("subtracts unpaid SIP total from surplus", () => {
    const txs = [
      { type: "income", amount: 50000, date: "2026-07-01" } as Transaction,
      { type: "expense", amount: 10000, date: "2026-07-05" } as Transaction,
    ]
    const sips = [{ id: "a", active: true, amount: 6000 } as Sip]
    const left = availableAfterUnpaidSips(txs, sips, [], "2026-07")
    expect(left).toBe(34000)
  })
})

describe("sipStatusForMonth legacy rows", () => {
  it("keeps pre-link payment rows (no transaction_id, created before 2026-07-05) as paid", () => {
    const sips = [{ id: "a", active: true, amount: 1000, fund_name: "ABC" } as Sip]
    const legacy = [{ sip_id: "a", month: "2026-06", created_at: "2026-06-05T00:00:00Z" } as import("@/lib/types").SipPayment]
    expect(sipStatusForMonth(sips, legacy, "2026-06").paid.map((s) => s.id)).toEqual(["a"])
    const orphan = [{ sip_id: "a", month: "2026-09", created_at: "2026-09-05T00:00:00Z" } as import("@/lib/types").SipPayment]
    expect(sipStatusForMonth(sips, orphan, "2026-09").unpaid.map((s) => s.id)).toEqual(["a"])
  })
})
