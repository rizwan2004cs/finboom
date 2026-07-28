import { describe, it, expect } from "vitest"
import { parseAmount, looksNumeric } from "./parse-amount"

describe("parseAmount", () => {
  it("parses Indian lakh-style grouping with a currency symbol", () => {
    expect(parseAmount("₹1,23,456.78")).toBe(123456.78)
  })

  it("treats parentheses as a negative figure", () => {
    expect(parseAmount("(1,234)")).toBe(-1234)
  })

  it("honours DR/CR accounting markers", () => {
    expect(parseAmount("1,234DR")).toBe(-1234)
    expect(parseAmount("1,234CR")).toBe(1234)
  })

  it("strips currency codes and percent signs", () => {
    expect(parseAmount("Rs 2,000")).toBe(2000)
    expect(parseAmount("12.5%")).toBe(12.5)
  })

  it("collapses extra decimal points onto the first one", () => {
    expect(parseAmount("1.2.3")).toBe(1.23)
  })

  it("returns 0 for blank/placeholder/garbage tokens", () => {
    for (const v of ["", "-", "—", "NA", "n/a", "nil", "abc"]) {
      expect(parseAmount(v)).toBe(0)
    }
  })

  it("passes finite numbers through and rejects non-finite ones", () => {
    expect(parseAmount(42)).toBe(42)
    expect(parseAmount(Number.NaN)).toBe(0)
    expect(parseAmount(Number.POSITIVE_INFINITY)).toBe(0)
    expect(parseAmount(null)).toBe(0)
  })

  it("expands crore suffixes", () => {
    expect(parseAmount("1.2 Cr")).toBe(12000000)
    expect(parseAmount("1.2 Crore")).toBe(12000000)
    expect(parseAmount("2 crores")).toBe(20000000)
    expect(parseAmount("1.2crore")).toBe(12000000)
  })

  it("expands lakh suffixes", () => {
    expect(parseAmount("45 Lakh")).toBe(4500000)
    expect(parseAmount("1.5 lac")).toBe(150000)
    expect(parseAmount("2 L")).toBe(200000)
    expect(parseAmount("3 lakhs")).toBe(300000)
  })

  it("keeps no-space cr as a plain credit marker, not crore", () => {
    expect(parseAmount("1,234cr")).toBe(1234)
    expect(parseAmount("1,234dr")).toBe(-1234)
  })
})

describe("looksNumeric", () => {
  it("recognises numeric-looking cells", () => {
    expect(looksNumeric("₹1,234")).toBe(true)
    expect(looksNumeric(1000)).toBe(true)
  })

  it("rejects text and blanks", () => {
    expect(looksNumeric("hello")).toBe(false)
    expect(looksNumeric("")).toBe(false)
    expect(looksNumeric("NA")).toBe(false)
  })
})
