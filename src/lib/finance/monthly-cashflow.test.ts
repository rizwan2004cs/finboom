import { describe, it, expect } from "vitest"
import {
  monthKeyFromDate,
  sumCashflow,
  sipsDueRestOfMonth,
  sumLiquidAssets,
  buildSnapshotBreakdown,
  isSnapshotMetaKey,
  sipStatusForMonth,
} from "./monthly-cashflow"
import type { Asset, Sip, Transaction } from "@/lib/types"

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
    const payments = [{ sip_id: "a", month: "2026-07" } as import("@/lib/types").SipPayment]
    const status = sipStatusForMonth(sips, payments, "2026-07")
    expect(status.unpaid).toHaveLength(1)
    expect(status.unpaid[0].id).toBe("b")
    expect(status.unpaidAmount).toBe(2000)
    expect(status.paidAmount).toBe(1000)
  })
})
