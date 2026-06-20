import {
  BLOG_CATEGORIES,
  DEFAULT_BLOG_CATEGORY,
  normalizeBlogCategory,
  type BlogCategory,
} from "@/lib/blog/categories"

// Picks the next category to publish so the running mix tracks the target
// weights (Guides stays the plurality). Chooses the category with the
// largest "expected share minus actual share" deficit over a recent window.
// Tie-break: the least-recently-used category.
export function pickTargetCategory(
  recentCategories: string[],
  windowSize = 12
): BlogCategory {
  const recent = recentCategories
    .slice(0, windowSize)
    .map((c) => normalizeBlogCategory(c))

  const totalWeight = BLOG_CATEGORIES.reduce((sum, c) => sum + c.weight, 0)
  const denom = recent.length || 1

  let best: BlogCategory = DEFAULT_BLOG_CATEGORY
  let bestDeficit = Number.NEGATIVE_INFINITY
  let bestLastUsedIndex = Number.NEGATIVE_INFINITY

  for (const cat of BLOG_CATEGORIES) {
    const expectedShare = cat.weight / totalWeight
    const actualShare = recent.filter((c) => c === cat.id).length / denom
    const deficit = expectedShare - actualShare

    // How recently was this category used? Lower index = more recent.
    // A larger "last used index" means older (or never used = window length).
    const firstIndex = recent.indexOf(cat.id)
    const lastUsedIndex = firstIndex === -1 ? recent.length : firstIndex

    if (
      deficit > bestDeficit ||
      (deficit === bestDeficit && lastUsedIndex > bestLastUsedIndex)
    ) {
      best = cat.id
      bestDeficit = deficit
      bestLastUsedIndex = lastUsedIndex
    }
  }

  return best
}
