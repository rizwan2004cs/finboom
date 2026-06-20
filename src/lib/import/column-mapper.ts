import { looksNumeric } from "@/lib/import/parse-amount"

// Predictive column -> field mapping. Replaces the old per-broker branches:
// any statement (stocks, mutual funds, unknown) is classified column-by-column
// using a scored header-synonym dictionary plus value heuristics, then a
// greedy assignment picks the single best column per field.

export type ImportField =
  | "name"
  | "isin"
  | "folio"
  | "units"
  | "price_nav"
  | "avg_price"
  | "invested_value"
  | "current_value"
  | "asset_class"
  | "currency"
  | "none"

export type ColumnMapping = Record<string, ImportField>

export const IMPORT_FIELD_LABELS: Record<ImportField, string> = {
  name: "Name",
  isin: "ISIN",
  folio: "Folio no.",
  units: "Units / Qty",
  price_nav: "Price / NAV",
  avg_price: "Avg buy price",
  invested_value: "Invested value",
  current_value: "Current value",
  asset_class: "Asset class",
  currency: "Currency",
  none: "Ignore",
}

// Ordered by specificity - longer/more-specific synonyms first.
const FIELD_SYNONYMS: Partial<Record<ImportField, string[]>> = {
  isin: ["isin"],
  folio: ["folio"],
  current_value: [
    "current value", "present value", "market value", "closing value",
    "cur. val", "current val", "market val", "valuation", "mkt value",
  ],
  invested_value: [
    "invested value", "buy value", "cost value", "total cost", "amount invested",
    "purchase value", "invested amount", "book cost", "investment", "invested",
  ],
  avg_price: [
    "average buy price", "avg. cost", "avg cost", "average price", "avg price",
    "buy price", "buy avg", "purchase price", "average",
  ],
  price_nav: [
    "closing price", "current price", "market price", "last price",
    "nav", "ltp", "price", "rate",
  ],
  units: [
    "no. of units", "closing units", "balance units", "quantity available",
    "quantity", "units", "qty", "shares", "unit",
  ],
  asset_class: [
    "asset class", "instrument type", "asset type", "sub category",
    "category", "type",
  ],
  currency: ["currency", "ccy"],
  name: [
    "stock name", "scheme name", "fund name", "security name", "company name",
    "instrument", "particulars", "security", "company", "scrip", "holding",
    "stock", "scheme", "name",
  ],
}

const NUMERIC_FIELDS = new Set<ImportField>([
  "units", "price_nav", "avg_price", "invested_value", "current_value",
])

const ISIN_REGEX = /^[A-Z]{2}[A-Z0-9]{9}\d$/i

function headerScore(header: string, synonyms: string[]): number {
  const h = header.toLowerCase().trim()
  let best = 0
  for (const syn of synonyms) {
    if (h === syn) best = Math.max(best, 100)
    else if (h.includes(syn)) best = Math.max(best, 50 + syn.length)
  }
  return best
}

function sampleValues(rows: Record<string, unknown>[], header: string, n = 12): unknown[] {
  const out: unknown[] = []
  for (const row of rows) {
    const v = row[header]
    if (v != null && String(v).trim() !== "") out.push(v)
    if (out.length >= n) break
  }
  return out
}

function numericRatio(values: unknown[]): number {
  if (values.length === 0) return 0
  return values.filter(looksNumeric).length / values.length
}

function isinRatio(values: unknown[]): number {
  if (values.length === 0) return 0
  return values.filter((v) => ISIN_REGEX.test(String(v).trim())).length / values.length
}

type Candidate = { header: string; field: ImportField; score: number }

function scoreColumn(
  header: string,
  rows: Record<string, unknown>[]
): Candidate[] {
  const values = sampleValues(rows, header)
  const numeric = numericRatio(values)
  const candidates: Candidate[] = []

  for (const field of Object.keys(FIELD_SYNONYMS) as ImportField[]) {
    const synonyms = FIELD_SYNONYMS[field]
    if (!synonyms) continue
    let score = headerScore(header, synonyms)
    if (score === 0) continue

    // Value heuristics: gate numeric vs text fields.
    if (NUMERIC_FIELDS.has(field)) {
      if (numeric < 0.4) score *= 0.2 // header says number, values disagree
      else score += numeric * 10
    }
    if (field === "name" && numeric > 0.6) score *= 0.3 // names aren't numbers

    candidates.push({ header, field, score })
  }

  // Pure value-based signals that don't need a matching header.
  const isin = isinRatio(values)
  if (isin > 0.5) candidates.push({ header, field: "isin", score: 120 })

  return candidates
}

export type MappingResult = {
  mapping: ColumnMapping
  confidence: number
}

// Greedy bipartite assignment: highest-scoring (header, field) pairs win, each
// field and header used at most once. Unassigned headers map to "none".
export function buildColumnMapping(
  headers: string[],
  rows: Record<string, unknown>[]
): MappingResult {
  const allCandidates: Candidate[] = []
  for (const header of headers) {
    allCandidates.push(...scoreColumn(header, rows))
  }
  allCandidates.sort((a, b) => b.score - a.score)

  const mapping: ColumnMapping = {}
  for (const header of headers) mapping[header] = "none"
  const usedFields = new Set<ImportField>()
  const usedHeaders = new Set<string>()
  let assignedScoreTotal = 0
  let assignedCount = 0

  for (const cand of allCandidates) {
    if (usedHeaders.has(cand.header) || usedFields.has(cand.field)) continue
    mapping[cand.header] = cand.field
    usedHeaders.add(cand.header)
    usedFields.add(cand.field)
    assignedScoreTotal += Math.min(cand.score, 100)
    assignedCount += 1
  }

  // Confidence: presence of a name + a usable value signal, blended with the
  // average strength of the assigned headers.
  const hasName = usedFields.has("name")
  const hasValueSignal =
    usedFields.has("current_value") ||
    usedFields.has("invested_value") ||
    (usedFields.has("units") && (usedFields.has("price_nav") || usedFields.has("avg_price")))
  const avgStrength = assignedCount > 0 ? assignedScoreTotal / assignedCount / 100 : 0

  let confidence = 0
  if (hasName) confidence += 0.4
  if (hasValueSignal) confidence += 0.4
  confidence += avgStrength * 0.2

  return { mapping, confidence: Math.min(1, Number(confidence.toFixed(2))) }
}

// Returns the header currently assigned to a given field (or undefined).
export function headerForField(
  mapping: ColumnMapping,
  field: ImportField
): string | undefined {
  return Object.keys(mapping).find((h) => mapping[h] === field)
}
