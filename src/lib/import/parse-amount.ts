// Robust number normalization for messy real-world financial exports.
//
// Handles: rupee/dollar symbols, "INR"/"Rs"/"USD" prefixes, Indian lakh-style
// commas (1,23,456.78), unicode/no-break spaces, parentheses-negatives
// ((1,234) = -1234), trailing CR/DR markers, percent signs, and
// dash/NA/blank placeholders. Returns 0 for anything non-numeric so a single
// bad cell never produces NaN (which the old importer silently dropped).

const BLANK_TOKENS = new Set(["", "-", "--", "—", "na", "n/a", "nil", "null", "none", "."])

export function parseAmount(value: unknown): number {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0
  }
  if (value == null) return 0

  let str = String(value)
    // Normalise unicode/no-break spaces to plain spaces (dropped fully below).
    .replace(/[\u00a0\u2007\u202f]/g, " ")
    .trim()
    .toLowerCase()

  // Indian magnitude suffixes: "1.2 Cr" / "3 Crore" \u2192 \u00d71e7, "45 Lakh" /
  // "2 L" / "1.5 lac" \u2192 \u00d71e5. Detected BEFORE whitespace is stripped \u2014 a bare
  // "1,234cr" with no space keeps its accounting credit-marker meaning below.
  let multiplier = 1
  if (/\d\s*crores?\.?$/.test(str) || /\d\s+cr\.?$/.test(str)) {
    multiplier = 1e7
    str = str.replace(/\s*(?:crores?|cr)\.?$/, "")
  } else if (/\d\s*(?:lakhs?|lacs?)\.?$/.test(str) || /\d\s+l\.?$/.test(str)) {
    multiplier = 1e5
    str = str.replace(/\s*(?:lakhs?|lacs?|l)\.?$/, "")
  }

  // Now drop all remaining whitespace.
  str = str.replace(/\s/g, "")

  if (BLANK_TOKENS.has(str)) return 0

  // Parentheses denote a negative figure: (1,234.56) -> -1234.56
  let negative = false
  if (str.startsWith("(") && str.endsWith(")")) {
    negative = true
    str = str.slice(1, -1)
  }

  // Trailing accounting markers: 1,234dr (debit) is negative, cr is positive.
  if (str.endsWith("dr")) {
    negative = true
    str = str.slice(0, -2)
  } else if (str.endsWith("cr")) {
    // Ambiguous (could be "crore"); treat as a plain credit marker only when
    // it directly follows digits with no space - "1,234cr".
    str = str.slice(0, -2)
  }

  // Strip currency symbols / codes and stray characters, keep digits, sign,
  // decimal point, and the (already-removed) grouping commas.
  str = str
    .replaceAll(/(inr|rs\.?|usd|eur|gbp)/g, "")
    .replaceAll(/[₹$€£%]/g, "")
    .replaceAll(",", "")

  // A leading minus survives; everything else non-numeric is dropped.
  if (str.startsWith("-")) {
    negative = true
    str = str.slice(1)
  }
  str = str.replace(/[^0-9.]/g, "")

  // Guard against multiple dots ("1.2.3") - keep the first.
  const firstDot = str.indexOf(".")
  if (firstDot !== -1) {
    str = str.slice(0, firstDot + 1) + str.slice(firstDot + 1).replaceAll(".", "")
  }

  if (str === "" || str === ".") return 0
  const parsed = Number.parseFloat(str)
  if (!Number.isFinite(parsed)) return 0
  return (negative ? -parsed : parsed) * multiplier
}

// True when a cell plausibly holds a number (used by the column mapper to
// score numeric vs text columns).
export function looksNumeric(value: unknown): boolean {
  if (typeof value === "number") return Number.isFinite(value)
  if (value == null) return false
  const str = String(value).replace(/[\u00a0\u2007\u202f\s]/g, "").trim()
  if (!str || BLANK_TOKENS.has(str.toLowerCase())) return false
  return /\d/.test(str) && /^[-(]?[₹$€£]?\s?(inr|rs\.?|usd)?[\d,.\s()%a-z]*$/i.test(str)
}
