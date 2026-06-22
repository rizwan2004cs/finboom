import { describe, it, expect } from "vitest"
import { formatINR, formatINRCompact, formatPct } from "./format"

describe("formatINR", () => {
  it("uses the Indian grouping system", () => {
    expect(formatINR(1_234_567)).toBe("₹12,34,567")
  })

  it("honours the requested fraction digits", () => {
    expect(formatINR(1000.5, 2)).toBe("₹1,000.50")
  })

  it("returns ₹0 for non-finite input", () => {
    expect(formatINR(Number.NaN)).toBe("₹0")
  })
})

describe("formatINRCompact", () => {
  it("abbreviates crores", () => {
    expect(formatINRCompact(15_000_000)).toBe("₹1.50 Cr")
  })

  it("abbreviates lakhs", () => {
    expect(formatINRCompact(150_000)).toBe("₹1.50 L")
  })

  it("abbreviates thousands", () => {
    expect(formatINRCompact(1_500)).toBe("₹1.5K")
  })

  it("leaves small values ungrouped with a sign", () => {
    expect(formatINRCompact(999)).toBe("₹999")
    expect(formatINRCompact(-150_000)).toBe("-₹1.50 L")
  })
})

describe("formatPct", () => {
  it("rounds to one decimal by default", () => {
    expect(formatPct(12.345)).toBe("12.3%")
  })

  it("returns an em dash for non-finite input", () => {
    expect(formatPct(Number.POSITIVE_INFINITY)).toBe("—")
  })
})
