// Image sourcing for AI-generated blog posts.
//
// The writer agent never invents image URLs (older posts 404'd on
// hallucinated Unsplash/Pexels IDs). Instead it emits {{IMAGE: query}}
// tokens and an outline-level hero query. This module turns those
// queries into real, finance-relevant photo URLs.
//
// Provider order: Unsplash API (real, keyword-matched photos) -> Pexels
// API -> LoremFlickr (keyword-based, no key) -> Picsum (last-resort).

export type ResolvedImage = {
  url: string
  alt: string
}

const IMAGE_TOKEN_REGEX = /\{\{\s*IMAGE\s*:\s*([^}]+?)\s*\}\}/gi

function sanitizeQuery(raw: string): string {
  return raw
    .replace(/[^a-zA-Z0-9\s,]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80)
}

function keywordSlug(query: string): string {
  return sanitizeQuery(query)
    .toLowerCase()
    .split(/[\s,]+/)
    .filter(Boolean)
    .slice(0, 3)
    .join(",")
}

// Keyless fallbacks. LoremFlickr returns a real Flickr photo matching the
// keywords; Picsum is a random (but always-available) safety net.
function loremFlickrUrl(query: string): string {
  const keywords = keywordSlug(query) || "finance,money"
  return `https://loremflickr.com/1200/675/${encodeURIComponent(keywords)}`
}

function picsumUrl(query: string): string {
  const seed = keywordSlug(query).split(",")[0] || "finance"
  return `https://picsum.photos/seed/${encodeURIComponent(seed)}/1200/675`
}

type UnsplashPhoto = {
  id: string
  alt_description?: string
  description?: string
  urls?: { regular?: string; raw?: string }
}

async function searchUnsplash(query: string, usedIds: Set<string>): Promise<ResolvedImage | null> {
  const accessKey = process.env.UNSPLASH_ACCESS_KEY
  if (!accessKey) return null

  const url = new URL("https://api.unsplash.com/search/photos")
  url.searchParams.set("query", sanitizeQuery(query))
  url.searchParams.set("per_page", "8")
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
    const results = data.results ?? []

    const photo = results.find((p) => p.urls?.regular && !usedIds.has(p.id)) ?? results[0]
    if (!photo?.urls?.regular) return null

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
  url.searchParams.set("per_page", "8")
  url.searchParams.set("orientation", "landscape")

  try {
    const response = await fetch(url, { headers: { Authorization: apiKey } })
    if (!response.ok) return null
    const data = (await response.json()) as { photos?: PexelsPhoto[] }
    const photos = data.photos ?? []

    const photo =
      photos.find((p) => (p.src?.large2x || p.src?.large) && !usedIds.has(`pexels-${p.id}`)) ??
      photos[0]
    const src = photo?.src?.large2x || photo?.src?.large || photo?.src?.landscape
    if (!src) return null

    usedIds.add(`pexels-${photo.id}`)
    return { url: src, alt: (photo.alt || sanitizeQuery(query)).trim() }
  } catch {
    return null
  }
}

// A per-generation fetcher keeps track of already-used photos so the hero
// and inline images don't repeat within a single post.
export function createImageResolver() {
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

// Replaces every {{IMAGE: query}} token in the markdown with a real
// markdown image. Tokens that can't be resolved are dropped. If the draft
// has fewer than `minImages` inline images, extra images are inserted
// after the earliest section headings so every post stays illustrated.
export async function injectInlineImages(
  markdown: string,
  minImages = 3
): Promise<string> {
  const resolver = createImageResolver()

  const tokenQueries: string[] = []
  for (const match of markdown.matchAll(IMAGE_TOKEN_REGEX)) {
    tokenQueries.push(match[1])
  }

  const resolvedByToken: string[] = []
  for (const query of tokenQueries) {
    const image = await resolver.resolve(query)
    resolvedByToken.push(`![${image.alt}](${image.url})`)
  }

  let tokenIndex = 0
  let result = markdown.replace(IMAGE_TOKEN_REGEX, () => resolvedByToken[tokenIndex++] ?? "")

  // Top up illustrations if the writer under-used image tokens. Only add an
  // image to a section that doesn't already contain one.
  const isImageLine = (line: string) => /^!\[.*\]\(.+\)$/.test(line.trim())
  let currentCount = (result.match(/^!\[.*\]\(.+\)$/gm) ?? []).length
  if (currentCount < minImages) {
    const lines = result.split("\n")
    const output: string[] = []
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      output.push(line)
      const heading = line.match(/^##\s+(.+)/)
      if (!heading || currentCount >= minImages) continue

      // Does this section (until the next ## heading) already have an image?
      let sectionHasImage = false
      for (let j = i + 1; j < lines.length && !/^##\s+/.test(lines[j]); j++) {
        if (isImageLine(lines[j])) {
          sectionHasImage = true
          break
        }
      }
      if (!sectionHasImage) {
        const image = await resolver.resolve(heading[1])
        output.push("")
        output.push(`![${image.alt}](${image.url})`)
        currentCount += 1
      }
    }
    result = output.join("\n")
  }

  return result
}

// Hero image for the post (uploaded to Sanity as mainImage by the caller).
export async function resolveHeroImage(query: string): Promise<ResolvedImage> {
  const resolver = createImageResolver()
  return resolver.resolve(query)
}
