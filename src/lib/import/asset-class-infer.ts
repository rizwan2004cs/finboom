import { ASSET_CLASSES, type AssetClassId } from "@/lib/constants"

// Infers one of the 22 asset classes for a holding from whatever signals the
// statement provides: an explicit category column, the ISIN prefix, name
// keywords, and folio/NAV presence (both strong mutual-fund tells).

const NAME_KEYWORD_RULES: Array<{ match: RegExp; cls: AssetClassId }> = [
  { match: /\belss\b|tax\s?saver/i, cls: "elss" },
  { match: /\bnps\b|national pension/i, cls: "nps" },
  { match: /\bppf\b|public provident/i, cls: "ppf" },
  { match: /\bepf\b|provident fund|\bpf\b/i, cls: "epf" },
  { match: /sukanya|\bssy\b/i, cls: "ssy" },
  { match: /sovereign gold|\bsgb\b/i, cls: "sgb" },
  { match: /\bsilver\b/i, cls: "silver" },
  { match: /\bgold\b/i, cls: "gold" },
  { match: /sovereign|g-?sec|gilt|\bsdl\b|t-?bill|debenture|\bbond\b/i, cls: "bonds" },
  { match: /recurring deposit|\brd\b/i, cls: "recurring_deposit" },
  { match: /fixed deposit|\bfd\b/i, cls: "fixed_deposits" },
  { match: /\bulip\b/i, cls: "ulip" },
  { match: /\blic\b|insurance|policy|assurance/i, cls: "lic" },
  { match: /crypto|bitcoin|ethereum|\bbtc\b|\beth\b|\busdt\b/i, cls: "crypto" },
  { match: /real estate|property|apartment|\bflat\b|\bplot\b/i, cls: "real_estate" },
  { match: /\bus\s?stock|nasdaq|nyse/i, cls: "us_stocks" },
  { match: /etf|mutual|\bmf\b|\bfund\b/i, cls: "mutual_funds" },
  { match: /savings account/i, cls: "savings_account" },
]

// Matches an explicit "category"/"type" cell to a known asset class id.
export function normalizeAssetClass(text: string | undefined): AssetClassId | null {
  if (!text) return null
  const lower = text.toLowerCase().trim()
  if (!lower) return null
  const byId = ASSET_CLASSES.find((c) => c.id === lower)
  if (byId) return byId.id
  const byLabel = ASSET_CLASSES.find(
    (c) => c.label.toLowerCase() === lower || c.label.toLowerCase().includes(lower)
  )
  return byLabel ? byLabel.id : null
}

function fromIsin(isin: string | undefined): AssetClassId | null {
  if (!isin) return null
  const code = isin.toUpperCase().trim()
  if (code.startsWith("INF")) return "mutual_funds"
  if (code.startsWith("INE")) return "stocks"
  if (code.startsWith("IN0") || code.startsWith("IN9")) return "bonds"
  if (code.startsWith("US")) return "us_stocks"
  return null
}

function fromName(name: string | undefined): AssetClassId | null {
  if (!name) return null
  for (const rule of NAME_KEYWORD_RULES) {
    if (rule.match.test(name)) return rule.cls
  }
  return null
}

export function inferAssetClass(input: {
  name?: string
  isin?: string
  classText?: string
  hasFolio?: boolean
  hasNav?: boolean
}): AssetClassId {
  // 1. Trust an explicit category column when it maps to a known class.
  const explicit = normalizeAssetClass(input.classText)
  if (explicit) return explicit

  // 2. ISIN prefix is the most reliable machine signal.
  const byIsin = fromIsin(input.isin)
  if (byIsin) return byIsin

  // 3. Name keywords.
  const byName = fromName(input.name)
  if (byName) return byName

  // 4. Folio number / NAV are strong mutual-fund tells.
  if (input.hasFolio || input.hasNav) return "mutual_funds"

  // 5. Default to stocks (the most common equity holding).
  return "stocks"
}
