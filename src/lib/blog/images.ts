// Image sourcing for AI-generated blog posts.
//
// The writer agent never invents image URLs (older posts 404'd on
// hallucinated Unsplash/Pexels IDs). Instead it emits {{IMAGE: query}}
// tokens and an outline-level hero query. This module turns those
// queries into real, finance-relevant photo URLs.
//
// Provider order: Unsplash API (real, relevance-scored) -> Pexels API
// (relevance-scored) -> LoremFlickr (category-aware keywords, no key) ->
// Picsum (last-resort). Candidates are scored against the query so the most
// closely-related photo wins instead of just the first result.

export type ResolvedImage = {
  url: string
  alt: string
}

const IMAGE_TOKEN_REGEX = /\{\{\s*IMAGE\s*:\s*([^}]+?)\s*\}\}/gi

const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "for", "of", "to", "in", "on", "with",
  "your", "you", "how", "what", "why", "best", "top", "india", "indian",
])

function sanitizeQuery(raw: string): string {
  return raw
    .replace(/[^a-zA-Z0-9\s,]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80)
}

function queryTokens(query: string): string[] {
  return sanitizeQuery(query)
    .toLowerCase()
    .split(/[\s,]+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w))
}

// Overlap score between the query and a photo's text (alt/description/tags).
function relevanceScore(tokens: string[], text: string): number {
  if (!text) return 0
  const haystack = text.toLowerCase()
  let score = 0
  for (const t of tokens) {
    if (haystack.includes(t)) score += 1
  }
  return score
}

// Map a free-text query to a finance/India themed keyword set so the keyless
// fallback stays on-topic instead of returning a random photo.
const THEME_KEYWORDS: Array<{ match: RegExp; keywords: string }> = [
  { match: /tax|80c|itr|deduction|regime/i, keywords: "tax,documents,calculator" },
  { match: /gold|sgb|silver|bullion/i, keywords: "gold,jewellery,coins" },
  { match: /real estate|property|home|house|rent/i, keywords: "house,property,real-estate" },
  { match: /retire|pension|nps|ppf|epf|fire/i, keywords: "retirement,elderly,savings" },
  { match: /sip|mutual fund|fund|invest|portfolio/i, keywords: "investment,charts,finance" },
  { match: /stock|share|equity|market|nifty|sensex/i, keywords: "stock-market,trading,charts" },
  { match: /budget|expense|spend|save|saving/i, keywords: "budget,money,planning" },
  { match: /loan|emi|debt|credit/i, keywords: "loan,bank,money" },
  { match: /insurance|term|health cover/i, keywords: "insurance,family,protection" },
]

function fallbackKeywords(query: string): string {
  for (const theme of THEME_KEYWORDS) {
    if (theme.match.test(query)) return theme.keywords
  }
  const tokens = queryTokens(query).slice(0, 3)
  return tokens.length ? tokens.join(",") : "finance,money,india"
}

function loremFlickrUrl(query: string): string {
  return `https://loremflickr.com/1200/675/${encodeURIComponent(fallbackKeywords(query))}`
}

function picsumUrl(query: string): string {
  const seed = fallbackKeywords(query).split(",")[0] || "finance"
  return `https://picsum.photos/seed/${encodeURIComponent(seed)}/1200/675`
}

type UnsplashPhoto = {
  id: string
  alt_description?: string
  description?: string
  tags?: Array<{ title?: string }>
  urls?: { regular?: string; raw?: string }
}

async function searchUnsplash(query: string, usedIds: Set<string>): Promise<ResolvedImage | null> {
  const accessKey = process.env.UNSPLASH_ACCESS_KEY
  if (!accessKey) return null

  const url = new URL("https://api.unsplash.com/search/photos")
  url.searchParams.set("query", sanitizeQuery(query))
  url.searchParams.set("per_page", "15")
  url.searchParams.set("orientation", "landscape")
  url.searchParams.set("content_filter", "high")

  try {
    const response = await fetch(url, {
      headers: {
        Authorization: `Client-ID ${accessKey}`,
        "Accept-Version": "v1",
      },
    })
    if (!response.ok) return null
    const data = (await response.json()) as { results?: UnsplashPhoto[] }
    const results = (data.results ?? []).filter((p) => p.urls?.regular && !usedIds.has(p.id))
    if (results.length === 0) return null

    const tokens = queryTokens(query)
    const best = results
      .map((p) => {
        const tagText = (p.tags ?? []).map((t) => t.title ?? "").join(" ")
        const text = `${p.alt_description ?? ""} ${p.description ?? ""} ${tagText}`
        return { photo: p, score: relevanceScore(tokens, text) }
      })
      .sort((a, b) => b.score - a.score)[0]

    const photo = best.photo
    if (!photo.urls?.regular) return null
    usedIds.add(photo.id)
    const alt = (photo.alt_description || photo.description || sanitizeQuery(query)).trim()
    return { url: photo.urls.regular, alt }
  } catch {
    return null
  }
}

type PexelsPhoto = {
  id: number
  alt?: string
  src?: { large2x?: string; large?: string; landscape?: string }
}

async function searchPexels(query: string, usedIds: Set<string>): Promise<ResolvedImage | null> {
  const apiKey = process.env.PEXELS_API_KEY
  if (!apiKey) return null

  const url = new URL("https://api.pexels.com/v1/search")
  url.searchParams.set("query", sanitizeQuery(query))
  url.searchParams.set("per_page", "15")
  url.searchParams.set("orientation", "landscape")

  try {
    const response = await fetch(url, { headers: { Authorization: apiKey } })
    if (!response.ok) return null
    const data = (await response.json()) as { photos?: PexelsPhoto[] }
    const photos = (data.photos ?? []).filter(
      (p) => (p.src?.large2x || p.src?.large) && !usedIds.has(`pexels-${p.id}`)
    )
    if (photos.length === 0) return null

    const tokens = queryTokens(query)
    const best = photos
      .map((p) => ({ photo: p, score: relevanceScore(tokens, p.alt ?? "") }))
      .sort((a, b) => b.score - a.score)[0]

    const photo = best.photo
    const src = photo.src?.large2x || photo.src?.large || photo.src?.landscape
    if (!src) return null

    usedIds.add(`pexels-${photo.id}`)
    return { url: src, alt: (photo.alt || sanitizeQuery(query)).trim() }
  } catch {
    return null
  }
}

export type ImageResolver = { resolve: (query: string) => Promise<ResolvedImage> }

// A per-generation fetcher keeps track of already-used photos so the hero
// and inline images don't repeat within a single post. Share one resolver
// across the hero + inline passes to keep them distinct.
export function createImageResolver(): ImageResolver {
  const usedIds = new Set<string>()
  const usedUrls = new Set<string>()

  async function resolve(query: string): Promise<ResolvedImage> {
    const cleaned = sanitizeQuery(query) || "personal finance india"

    const fromApi = (await searchUnsplash(cleaned, usedIds)) ?? (await searchPexels(cleaned, usedIds))
    if (fromApi && !usedUrls.has(fromApi.url)) {
      usedUrls.add(fromApi.url)
      return fromApi
    }
    if (fromApi) return fromApi

    // Keyless fallbacks - vary the URL so repeats stay distinct.
    const flickr = loremFlickrUrl(cleaned)
    if (!usedUrls.has(flickr)) {
      usedUrls.add(flickr)
      return { url: flickr, alt: cleaned }
    }
    return { url: picsumUrl(cleaned), alt: cleaned }
  }

  return { resolve }
}

const IMAGE_LINE_REGEX = /^!\[.*\]\(.+\)$/

function countImageLines(markdown: string): number {
  return [...markdown.matchAll(/^!\[.*\]\(.+\)$/gm)].length
}

function sectionAlreadyHasImage(lines: string[], startIndex: number): boolean {
  for (let j = startIndex; j < lines.length && !/^##\s+/.test(lines[j]); j++) {
    if (IMAGE_LINE_REGEX.test(lines[j].trim())) return true
  }
  return false
}

// Walks the draft and, for the earliest image-less sections, inserts an
// on-topic image after the heading until `minImages` is reached.
async function topUpSectionImages(
  markdown: string,
  minImages: number,
  resolver: ImageResolver,
  topic: string
): Promise<string> {
  let currentCount = countImageLines(markdown)
  if (currentCount >= minImages) return markdown

  const lines = markdown.split("\n")
  const output: string[] = []
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    output.push(line)

    const heading = /^##\s+(.+)/.exec(line)
    const needsMore = currentCount < minImages
    if (heading && needsMore && !sectionAlreadyHasImage(lines, i + 1)) {
      const image = await resolver.resolve(`${topic} ${heading[1]}`.trim())
      output.push("", `![${image.alt}](${image.url})`)
      currentCount += 1
    }
  }
  return output.join("\n")
}

// Replaces every {{IMAGE: query}} token in the markdown with a real
// markdown image. If the draft has fewer than `minImages` inline images,
// extra images are inserted after the earliest section headings (queried as
// "topic - heading" so they stay on-topic).
export async function injectInlineImages(
  markdown: string,
  minImages = 3,
  resolver: ImageResolver = createImageResolver(),
  topic = ""
): Promise<string> {
  const tokenQueries = [...markdown.matchAll(IMAGE_TOKEN_REGEX)].map((m) => m[1])

  const resolvedByToken: string[] = []
  for (const query of tokenQueries) {
    const image = await resolver.resolve(query)
    resolvedByToken.push(`![${image.alt}](${image.url})`)
  }

  let tokenIndex = 0
  const replaced = markdown.replace(IMAGE_TOKEN_REGEX, () => resolvedByToken[tokenIndex++] ?? "")

  return topUpSectionImages(replaced, minImages, resolver, topic)
}

// Hero image for the post (uploaded to Sanity as mainImage by the caller).
export async function resolveHeroImage(
  query: string,
  resolver: ImageResolver = createImageResolver()
): Promise<ResolvedImage> {
  return resolver.resolve(query)
}
