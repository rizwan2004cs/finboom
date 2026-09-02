import { describe, expect, it } from "vitest"
import type { PartyTransaction } from "@/lib/types"
import {
  entriesDueInWindow,
  entryOutstanding,
  isEntryOpen,
  outstandingByEntry,
  overdueEntries,
  partyNetBalances,
  receivableDueInWindow,
} from "./parties"

let seq = 0
function ptx(overrides: Partial<PartyTransaction> = {}): PartyTransaction {
  seq++
  return {
    id: `t${seq}`,
    user_id: "u1",
    party_id: "p1",
    type: "lent",
    amount: 100,
    currency: "INR",
    date: `2026-01-${String(seq).padStart(2, "0")}`,
    created_at: "2026-01-01T00:00:00Z",
    ...overrides,
  }
}

describe("partyNetBalances", () => {
  it("nets lent/received_back and borrowed/paid_back per party", () => {
    const txs = [
      ptx({ party_id: "a", type: "lent", amount: 1000 }),
      ptx({ party_id: "a", type: "received_back", amount: 300 }),
      ptx({ party_id: "b", type: "borrowed", amount: 500 }),
      ptx({ party_id: "b", type: "paid_back", amount: 200 }),
      ptx({ party_id: "c", type: "lent", amount: 50 }),
      ptx({ party_id: "c", type: "received_back", amount: 50 }),
    ]
    const map = partyNetBalances(txs)
    expect(map.get("a")).toBe(700)
    expect(map.get("b")).toBe(-300)
    expect(map.get("c")).toBe(0)
    expect(map.size).toBe(3)
  })

  it("coerces string amounts from the DB", () => {
    const txs = [ptx({ amount: "250" as unknown as number })]
    expect(partyNetBalances(txs).get("p1")).toBe(250)
  })
})

describe("outstandingByEntry", () => {
  it("applies a targeted repayment to its linked entry, not the newest one", () => {
    const a = ptx({ id: "A", type: "lent", amount: 1000, date: "2026-01-01" })
    const b = ptx({ id: "B", type: "lent", amount: 500, date: "2026-01-10" })
    const repay = ptx({ type: "received_back", amount: 500, date: "2026-01-15", settles_transaction_id: "A" })
    const map = outstandingByEntry([a, b, repay])
    expect(map.get("A")).toBe(500)
    expect(map.get("B")).toBe(500)
  })

  it("closes the targeted entry and pushes the overflow into the LIFO pool", () => {
    const a = ptx({ id: "A", type: "lent", amount: 1000, date: "2026-01-01" })
    const b = ptx({ id: "B", type: "lent", amount: 500, date: "2026-01-10" })
    const c = ptx({ id: "C", type: "lent", amount: 300, date: "2026-01-20" })
    const repay = ptx({ type: "received_back", amount: 1200, date: "2026-01-25", settles_transaction_id: "A" })
    const map = outstandingByEntry([a, b, c, repay])
    expect(map.get("A")).toBe(0)
    expect(map.get("C")).toBe(100) // 200 overflow hits newest first
    expect(map.get("B")).toBe(500)
  })

  it("allocates unlinked repayments LIFO (newest obligation first)", () => {
    const a = ptx({ id: "A", type: "lent", amount: 1000, date: "2026-01-01" })
    const b = ptx({ id: "B", type: "lent", amount: 500, date: "2026-01-10" })
    const repay = ptx({ type: "received_back", amount: 700, date: "2026-01-15" })
    const map = outstandingByEntry([a, b, repay])
    expect(map.get("B")).toBe(0)
    expect(map.get("A")).toBe(800)
  })

  it("treats a link to an unknown or wrong-direction entry as unlinked", () => {
    const a = ptx({ id: "A", type: "lent", amount: 1000, date: "2026-01-01" })
    const b = ptx({ id: "B", type: "lent", amount: 500, date: "2026-01-10" })
    const repay = ptx({ type: "received_back", amount: 200, date: "2026-01-15", settles_transaction_id: "missing" })
    const map = outstandingByEntry([a, b, repay])
    expect(map.get("B")).toBe(300)
    expect(map.get("A")).toBe(1000)
  })

  it("keeps lent/received_back and borrowed/paid_back pools separate", () => {
    const lent = ptx({ id: "L", type: "lent", amount: 1000, date: "2026-01-01" })
    const borrowed = ptx({ id: "Bo", type: "borrowed", amount: 400, date: "2026-01-05" })
    const paidBack = ptx({ type: "paid_back", amount: 400, date: "2026-01-06" })
    const received = ptx({ type: "received_back", amount: 100, date: "2026-01-07" })
    const map = outstandingByEntry([lent, borrowed, paidBack, received])
    expect(map.get("L")).toBe(900)
    expect(map.get("Bo")).toBe(0)
    expect(map.size).toBe(2) // repayments never get an outstanding row
  })

  it("never lets one party's repayment settle another party's entry", () => {
    const a = ptx({ id: "A", party_id: "p1", type: "lent", amount: 1000, date: "2026-01-01" })
    const b = ptx({ id: "B", party_id: "p2", type: "lent", amount: 500, date: "2026-01-02" })
    const repay = ptx({ party_id: "p2", type: "received_back", amount: 800, date: "2026-01-03", settles_transaction_id: "A" })
    const map = outstandingByEntry([a, b, repay])
    expect(map.get("A")).toBe(1000)
    expect(map.get("B")).toBe(0)
  })

  it("overpayment leaves every entry at zero, never negative", () => {
    const a = ptx({ id: "A", type: "lent", amount: 100, date: "2026-01-01" })
    const repay = ptx({ type: "received_back", amount: 250, date: "2026-01-02" })
    expect(outstandingByEntry([a, repay]).get("A")).toBe(0)
  })
})

describe("isEntryOpen / entryOutstanding", () => {
  it("is open only for obligations with a remainder", () => {
    const a = ptx({ id: "A", type: "lent", amount: 100, date: "2026-01-01" })
    const repay = ptx({ type: "received_back", amount: 100, date: "2026-01-02", settles_transaction_id: "A" })
    const map = outstandingByEntry([a, repay])
    expect(isEntryOpen(a, map)).toBe(false)
    expect(isEntryOpen(repay, map)).toBe(false)
    expect(entryOutstanding(repay, map)).toBe(0)
  })

  it("falls back to the full amount for an obligation missing from the map", () => {
    const orphan = ptx({ id: "X", type: "borrowed", amount: 320 })
    expect(entryOutstanding(orphan, new Map())).toBe(320)
    expect(isEntryOpen(orphan, new Map())).toBe(true)
  })
})

describe("receivableDueInWindow", () => {
  const today = "2026-03-01"
  const plus30 = "2026-03-31"

  it("finding 24: targeted repayment shrinks only the due-dated entry", () => {
    // lent A ₹1000 due in 10d, lent B ₹500 no due, received_back ₹500 settles A
    const a = ptx({ id: "A", type: "lent", amount: 1000, date: "2026-02-01", due_date: "2026-03-11" })
    const b = ptx({ id: "B", type: "lent", amount: 500, date: "2026-02-10" })
    const repay = ptx({ type: "received_back", amount: 500, date: "2026-02-20", settles_transaction_id: "A" })
    expect(receivableDueInWindow([a, b, repay], today, plus30)).toBe(500)
  })

  it("ignores borrowed entries, undated entries and dates outside the window", () => {
    const txs = [
      ptx({ type: "lent", amount: 100, due_date: "2026-03-05" }),
      ptx({ type: "lent", amount: 200, due_date: "2026-02-28" }), // overdue, not upcoming
      ptx({ type: "lent", amount: 300, due_date: "2026-04-01" }), // beyond window
      ptx({ type: "lent", amount: 400 }), // no due date
      ptx({ type: "borrowed", amount: 500, due_date: "2026-03-10" }), // payable
    ]
    expect(receivableDueInWindow(txs, today, plus30)).toBe(100)
  })

  it("includes entries due on the window edges and excludes settled ones", () => {
    const a = ptx({ id: "A", type: "lent", amount: 100, date: "2026-02-01", due_date: today })
    const b = ptx({ id: "B", type: "lent", amount: 200, date: "2026-02-02", due_date: plus30 })
    const repay = ptx({ type: "received_back", amount: 200, date: "2026-02-03" }) // LIFO closes B
    expect(receivableDueInWindow([a, b, repay], today, plus30)).toBe(100)
  })
})

describe("entriesDueInWindow / overdueEntries", () => {
  it("returns open obligations of either direction in the window", () => {
    const lent = ptx({ id: "L", type: "lent", amount: 100, due_date: "2026-03-05" })
    const borrowed = ptx({ id: "Bo", type: "borrowed", amount: 100, due_date: "2026-03-06" })
    const ids = entriesDueInWindow([lent, borrowed], "2026-03-01", "2026-03-31").map(t => t.id)
    expect(ids).toEqual(["L", "Bo"])
  })

  it("lists only still-open entries past their due date", () => {
    const settled = ptx({ id: "S", type: "lent", amount: 100, date: "2026-01-01", due_date: "2026-02-01" })
    const open = ptx({ id: "O", type: "lent", amount: 100, date: "2026-01-02", due_date: "2026-02-15" })
    const dueToday = ptx({ id: "T", type: "borrowed", amount: 100, date: "2026-01-03", due_date: "2026-03-01" })
    const repay = ptx({ type: "received_back", amount: 100, date: "2026-02-05", settles_transaction_id: "S" })
    const ids = overdueEntries([settled, open, dueToday, repay], "2026-03-01").map(t => t.id)
    expect(ids).toEqual(["O"])
  })

  it("accepts a precomputed outstanding map", () => {
    const a = ptx({ id: "A", type: "lent", amount: 100, due_date: "2026-01-01" })
    const map = new Map([["A", 0]])
    expect(overdueEntries([a], "2026-03-01", map)).toEqual([])
  })
})

describe("receivableDueInWindow cap", () => {
  it("never exceeds what the party nets owe you", async () => {
    const { receivableDueInWindow } = await import("./parties")
    const txs = [
      { id: "l1", party_id: "p1", type: "lent", amount: 1000, date: "2026-09-01", due_date: "2026-09-10" },
      { id: "b1", party_id: "p1", type: "borrowed", amount: 800, date: "2026-09-02" },
    ] as Parameters<typeof receivableDueInWindow>[0]
    expect(receivableDueInWindow(txs, "2026-09-01", "2026-09-30")).toBe(200)
  })
})
