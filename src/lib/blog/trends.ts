import type { BlogCategory } from "@/lib/blog/categories"

// Lightweight trend/keyword discovery for the blog pipeline.
//
// Priority: Google autocomplete suggestions (keyless, India) -> a curated
// seasonal keyword bank (always works). Every network call is time-boxed and
// failure-tolerant so it can never block the daily post.

// Indian financial calendar: month index (0-11) -> high-search seasonal angles.
const SEASONAL_KEYWORDS: Record<number, string[]> = {
  0: ["tax saving investments", "80C deductions", "ELSS funds"], // Jan
  1: ["union budget impact", "income tax changes", "tax planning"], // Feb
  2: ["last minute tax saving", "financial year end", "capital gains harvesting"], // Mar
  3: ["new financial year planning", "salary restructuring", "investment plan"], // Apr
  4: ["form 16", "advance tax", "mutual fund SIP"], // May
  5: ["monsoon savings plan", "emergency fund", "SIP step up"], // Jun
  6: ["ITR filing", "income tax return", "tax refund"], // Jul
  7: ["independence day stocks", "long term investing", "portfolio review"], // Aug
  8: ["advance tax second installment", "festive savings", "gold investment"], // Sep
  9: ["diwali muhurat trading", "festive bonus investing", "sovereign gold bond"], // Oct
  10: ["year end portfolio rebalancing", "tax loss harvesting", "NPS investment"], // Nov
  11: ["year end financial checklist", "new year money goals", "tax saving deadline"], // Dec
}

// Category-specific seed phrases used to query autocomplete and as fallbacks.
const CATEGORY_SEEDS: Record<BlogCategory, string[]> = {
  guides: ["how to invest in india", "personal finance guide india"],
  investing: ["best mutual funds", "stock market for beginners india", "SIP investment"],
  tips: ["money saving tips india", "how to save money"],
  taxes: ["income tax saving", "how to save tax in india", "80C investment options"],
  retirement: ["retirement planning india", "NPS vs PPF", "FIRE india"],
  news: ["rbi policy", "union budget", "sensex nifty today"],
  market: ["stock market basics", "what is nifty 50", "share market india"],
  product: ["net worth tracker", "expense tracker app india"],
}

export function getSeasonalKeywords(date = new Date()): string[] {
  return SEASONAL_KEYWORDS[date.getMonth()] ?? []
}

export function getCurrentSeasonContext(date = new Date()): string {
  const month = date.toLocaleDateString("en-IN", { month: "long" })
  const seasonal = getSeasonalKeywords(date)
  if (seasonal.length === 0) return month
  return `${month} (timely angles: ${seasonal.join(", ")})`
}

async function fetchAutocomplete(seed: string, timeoutMs = 2500): Promise<string[]> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const url = new URL("https://suggestqueries.google.com/complete/search")
    url.searchParams.set("client", "chrome")
    url.searchParams.set("hl", "en")
    url.searchParams.set("gl", "in")
    url.searchParams.set("q", seed)

    const res = await fetch(url, { signal: controller.signal })
    if (!res.ok) return []
    const data = (await res.json()) as unknown
    // Chrome client returns: [query, [suggestions...], ...]
    if (Array.isArray(data) && Array.isArray(data[1])) {
      return (data[1] as unknown[]).filter((s): s is string => typeof s === "string")
    }
    return []
  } catch {
    return []
  } finally {
    clearTimeout(timer)
  }
}

// Returns a small, de-duplicated set of keyword ideas for a category, blending
// live autocomplete suggestions with the seasonal bank. Always returns
// something usable even if the network is unavailable.
export async function getKeywordIdeas(
  category: BlogCategory,
  date = new Date(),
  max = 8
): Promise<string[]> {
  const seeds = CATEGORY_SEEDS[category] ?? []
  const seasonal = getSeasonalKeywords(date)

  const ideas = new Set<string>(seasonal)

  // Query autocomplete for the first seed only (keeps it fast + polite).
  if (seeds[0]) {
    const suggestions = await fetchAutocomplete(seeds[0])
    for (const s of suggestions.slice(0, 6)) ideas.add(s.toLowerCase())
  }

  // Always include the static seeds so we never return empty.
  for (const s of seeds) ideas.add(s)

  return Array.from(ideas).slice(0, max)
}
