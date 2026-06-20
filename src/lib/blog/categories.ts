// Single source of truth for blog categories. Used by the public blog UI,
// the AI generation pipeline, the topic balancer, and the manual editor.
//
// `weight` drives the target publishing mix (Guides stays the plurality);
// the category-balancer compares recent posts against these weights.

export type BlogCategory =
  | "guides"
  | "tips"
  | "investing"
  | "taxes"
  | "retirement"
  | "market"
  | "news"
  | "product"

export interface BlogCategoryDef {
  id: BlogCategory
  label: string
  description: string
  // Tailwind gradient used for the card artwork fallback.
  gradient: string
  // Relative target share of the publishing mix.
  weight: number
}

export const BLOG_CATEGORIES: readonly BlogCategoryDef[] = [
  {
    id: "guides",
    label: "Guides",
    description: "In-depth how-to guides and explainers for Indian investors.",
    gradient: "from-sky-500/25 via-indigo-500/15 to-transparent",
    weight: 24,
  },
  {
    id: "investing",
    label: "Investing",
    description: "Stocks, mutual funds, SIPs, and portfolio strategy.",
    gradient: "from-indigo-500/25 via-violet-500/15 to-transparent",
    weight: 16,
  },
  {
    id: "tips",
    label: "Financial Tips",
    description: "Quick, actionable money habits and saving tactics.",
    gradient: "from-emerald-500/25 via-teal-500/15 to-transparent",
    weight: 14,
  },
  {
    id: "taxes",
    label: "Taxes",
    description: "Income tax, 80C, capital gains, and tax-saving for India.",
    gradient: "from-rose-500/25 via-pink-500/15 to-transparent",
    weight: 12,
  },
  {
    id: "retirement",
    label: "Retirement",
    description: "EPF, NPS, PPF, FIRE, and long-term retirement planning.",
    gradient: "from-amber-500/25 via-yellow-500/15 to-transparent",
    weight: 10,
  },
  {
    id: "news",
    label: "News",
    description: "Budget, RBI, and policy explainers - educational, not advice.",
    gradient: "from-cyan-500/25 via-sky-500/15 to-transparent",
    weight: 10,
  },
  {
    id: "market",
    label: "Market",
    description: "Market concepts and seasonal context, explained simply.",
    gradient: "from-orange-500/25 via-amber-500/15 to-transparent",
    weight: 8,
  },
  {
    id: "product",
    label: "Product Updates",
    description: "New FinBoom features, how-tos, and changelog.",
    gradient: "from-fuchsia-500/25 via-purple-500/15 to-transparent",
    weight: 6,
  },
]

export const DEFAULT_BLOG_CATEGORY: BlogCategory = "guides"

export const BLOG_CATEGORY_IDS: readonly BlogCategory[] = BLOG_CATEGORIES.map(
  (c) => c.id
)

export const BLOG_CATEGORY_LABELS: Record<string, string> = Object.fromEntries(
  BLOG_CATEGORIES.map((c) => [c.id, c.label])
)

export const BLOG_CATEGORY_GRADIENTS: Record<string, string> =
  Object.fromEntries(BLOG_CATEGORIES.map((c) => [c.id, c.gradient]))

export function isBlogCategory(value: unknown): value is BlogCategory {
  return typeof value === "string" && BLOG_CATEGORY_IDS.includes(value as BlogCategory)
}

// Coerce arbitrary model output / stored values to a valid category.
// Falls back to the run's target category (or Guides) instead of silently
// collapsing everything to Guides.
export function normalizeBlogCategory(
  value: unknown,
  fallback: BlogCategory = DEFAULT_BLOG_CATEGORY
): BlogCategory {
  if (isBlogCategory(value)) return value
  if (typeof value === "string") {
    const lower = value.toLowerCase().trim()
    const byId = BLOG_CATEGORIES.find((c) => c.id === lower)
    if (byId) return byId.id
    const byLabel = BLOG_CATEGORIES.find((c) => c.label.toLowerCase() === lower)
    if (byLabel) return byLabel.id
  }
  return fallback
}
