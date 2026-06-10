export function normalizeTopic(value: string): string {
  return value
    .toLowerCase()
    .replace(/[`~]/g, "")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "for", "of", "to", "in", "on", "at", "is",
  "are", "be", "being", "your", "you", "it", "its", "how", "what", "why",
  "when", "which", "vs", "versus", "with", "not", "can", "should", "every",
  "more", "most", "this", "that", "guide", "explained", "complete",
])

function meaningfulTokens(value: string): Set<string> {
  return new Set(
    normalizeTopic(value)
      .split(" ")
      .filter((word) => word.length > 2 && !STOPWORDS.has(word))
  )
}

// Overlap ratio of meaningful words (0..1). "Rich vs Financially Free"
// and "The Difference Between Being Rich and Being Financially Free"
// score ~0.6+ despite different exact titles.
export function topicSimilarity(a: string, b: string): number {
  const tokensA = meaningfulTokens(a)
  const tokensB = meaningfulTokens(b)
  if (tokensA.size === 0 || tokensB.size === 0) return 0
  let common = 0
  for (const token of tokensA) {
    if (tokensB.has(token)) common += 1
  }
  return common / Math.min(tokensA.size, tokensB.size)
}

export function isTooSimilar(candidate: string, existingTitles: string[], threshold = 0.6): boolean {
  return existingTitles.some((title) => topicSimilarity(candidate, title) >= threshold)
}

