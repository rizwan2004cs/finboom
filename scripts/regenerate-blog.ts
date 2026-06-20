/**
 * Regenerate / generate FinBoom blog posts in the new "visual-first" format
 * (key-takeaways brief + bold section gists + multiple mermaid diagrams/tables).
 *
 * Reuses the exact production pipeline (ai-generation -> markdown-to-portable-text
 * -> Sanity), so output matches the daily automation.
 *
 * Requires (read from .env.local or the shell):
 *   - One AI key: GEMINI_API_KEY | GROQ_API_KEY | OPENAI_API_KEY
 *   - SANITY_EDITOR_TOKEN  (write token)
 *   - NEXT_PUBLIC_SANITY_PROJECT_ID, NEXT_PUBLIC_SANITY_DATASET (defaults exist)
 *   - UNSPLASH_ACCESS_KEY (optional, for hero/inline images)
 *
 * Usage:
 *   tsx scripts/regenerate-blog.ts new "Best ELSS funds for 2026"
 *   tsx scripts/regenerate-blog.ts new            # auto-pick a fresh topic
 *   tsx scripts/regenerate-blog.ts update 3       # regenerate 3 newest auto posts
 *   tsx scripts/regenerate-blog.ts update all     # regenerate every auto post
 *   tsx scripts/regenerate-blog.ts update <slug-a> <slug-b>
 *   tsx scripts/regenerate-blog.ts delete <slug>  # delete post(s) by slug
 *   tsx scripts/regenerate-blog.ts                # default: update 1 + new 1
 */
import process from "node:process"

// Load .env.local before anything reads process.env at call time.
try {
  process.loadEnvFile(".env.local")
} catch {
  // Fine if it doesn't exist; rely on the shell environment instead.
}

import { sanityClient } from "@/lib/sanity"
import {
  generateBlogFromTopic,
  generateTopicFallbacks,
  type GeneratedBlogPost,
} from "@/lib/blog/ai-generation"
import { markdownToPortableText, slugify } from "@/lib/blog/markdown-to-portable-text"
import { uploadHeroImageToSanity } from "@/lib/blog/sanity-image"
import type { BlogCategory } from "@/lib/blog/categories"

const PROJECT_ID = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || "ra4szzqu"
const DATASET = process.env.NEXT_PUBLIC_SANITY_DATASET || "production"
const TOKEN = process.env.SANITY_EDITOR_TOKEN

type AutoPost = {
  _id: string
  title: string
  slug?: string
  category?: string
  sourceTopic?: string
}

function assertEnv() {
  const missing: string[] = []
  const hasAiKey =
    process.env.GEMINI_API_KEY || process.env.GROQ_API_KEY || process.env.OPENAI_API_KEY
  if (!hasAiKey) missing.push("one of GEMINI_API_KEY | GROQ_API_KEY | OPENAI_API_KEY")
  if (!TOKEN) missing.push("SANITY_EDITOR_TOKEN")
  if (missing.length > 0) {
    console.error(`Missing required env: ${missing.join(", ")}.`)
    console.error("Add them to .env.local (or export them) and re-run.")
    process.exit(1)
  }
}

async function sanityMutate(mutations: unknown[]): Promise<unknown> {
  const res = await fetch(
    `https://${PROJECT_ID}.api.sanity.io/v2024-01-01/data/mutate/${DATASET}?returnIds=true`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${TOKEN}`,
      },
      body: JSON.stringify({ mutations }),
    }
  )
  const data = await res.json()
  if (!res.ok) {
    throw new Error(data?.error?.description || `Sanity mutation failed (${res.status}).`)
  }
  return data
}

function uniqueSlug(title: string, taken: Set<string>): string {
  const base = slugify(title) || `blog-${new Date().toISOString().slice(0, 10)}`
  if (!taken.has(base)) return base
  const dated = `${base}-${new Date().toISOString().slice(0, 10)}`
  if (!taken.has(dated)) return dated
  let n = 2
  while (taken.has(`${dated}-${n}`)) n += 1
  return `${dated}-${n}`
}

async function buildPostFields(generated: GeneratedBlogPost) {
  const body = markdownToPortableText(generated.content)
  const mainImage = generated.heroImageUrl
    ? await uploadHeroImageToSanity(generated.heroImageUrl)
    : null
  return { body, mainImage }
}

async function generateNew(topicArg: string | undefined) {
  const existing = await sanityClient.fetch<{ slug?: string; title: string }[]>(
    `*[_type == "post"]{ "slug": slug.current, title }`
  )
  const takenSlugs = new Set(existing.map((p) => p.slug).filter(Boolean) as string[])

  let topic = topicArg?.trim()
  if (!topic) {
    const fallbacks = await generateTopicFallbacks(existing.map((p) => p.title))
    topic = fallbacks[0]
    if (!topic) throw new Error("Could not auto-pick a topic; pass one explicitly.")
    console.log(`Auto-picked topic: "${topic}"`)
  }

  console.log(`Generating new post: "${topic}" ...`)
  const generated = await generateBlogFromTopic(topic)
  const { body, mainImage } = await buildPostFields(generated)
  const slug = uniqueSlug(generated.title, takenSlugs)

  const post = {
    _type: "post",
    title: generated.title,
    slug: { _type: "slug", current: slug },
    category: generated.category,
    excerpt: generated.excerpt,
    ...(generated.metaTitle && { metaTitle: generated.metaTitle }),
    ...(generated.metaDescription && { metaDescription: generated.metaDescription }),
    ...(generated.keywords.length > 0 && { keywords: generated.keywords }),
    publishedAt: new Date().toISOString(),
    body,
    autoGenerated: true,
    sourceTopic: topic,
    topicSource: "manual_regen",
    ...(mainImage && { mainImage }),
  }

  await sanityMutate([{ create: post }])
  console.log(`  Published: /blog/${slug} (${body.length} blocks)`) 
}

async function fetchAutoPosts(slugs: string[], count: number): Promise<AutoPost[]> {
  if (slugs.length > 0) {
    return sanityClient.fetch<AutoPost[]>(
      `*[_type == "post" && slug.current in $slugs]{
        _id, title, "slug": slug.current, category, sourceTopic
      }`,
      { slugs }
    )
  }
  const all = await sanityClient.fetch<AutoPost[]>(
    `*[_type == "post" && autoGenerated == true] | order(publishedAt desc){
      _id, title, "slug": slug.current, category, sourceTopic
    }`
  )
  return all.slice(0, count)
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

async function updateExisting(slugs: string[], count: number) {
  const posts = await fetchAutoPosts(slugs, count)
  if (posts.length === 0) {
    console.log("No matching auto-generated posts to update.")
    return
  }
  console.log(`Updating ${posts.length} existing post(s) to the visual-first format ...`)

  let done = 0
  for (const post of posts) {
    const topic = post.sourceTopic?.trim() || post.title
    try {
      console.log(`- "${post.title}" (from topic: "${topic}")`)
      const generated = await generateBlogFromTopic(topic, {
        targetCategory: post.category as BlogCategory | undefined,
      })
      const { body, mainImage } = await buildPostFields(generated)
      const set: Record<string, unknown> = { body }
      // Refresh hero only if we actually got a new image; never blank an existing one.
      if (mainImage) set.mainImage = mainImage
      await sanityMutate([{ patch: { id: post._id, set } }])
      console.log(`  Updated (${body.length} blocks).`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`  Skipped "${post.title}": ${msg}`)
    }
    done += 1
    // Be gentle on free-tier AI rate limits between posts.
    if (done < posts.length) await sleep(1500)
  }
}

function requireToken() {
  if (!TOKEN) {
    console.error("Missing required env: SANITY_EDITOR_TOKEN.")
    console.error("Add it to .env.local (e.g. `vercel env pull`) or export it, then re-run.")
    process.exit(1)
  }
}

async function deletePosts(slugs: string[]) {
  if (slugs.length === 0) {
    console.log("Usage: tsx scripts/regenerate-blog.ts delete <slug> [<slug> ...]")
    return
  }
  const posts = await sanityClient.fetch<AutoPost[]>(
    `*[_type == "post" && slug.current in $slugs]{ _id, title, "slug": slug.current }`,
    { slugs }
  )
  if (posts.length === 0) {
    console.log(`No posts found for: ${slugs.join(", ")}`)
    return
  }
  for (const post of posts) {
    await sanityMutate([{ delete: { id: post._id } }])
    console.log(`Deleted: "${post.title}" (/blog/${post.slug})`)
  }
}

function parseArgs() {
  const [, , mode, ...rest] = process.argv
  return { mode, rest }
}

async function main() {
  const { mode, rest } = parseArgs()

  // Delete only needs the Sanity write token, not an AI key.
  if (mode === "delete") {
    requireToken()
    await deletePosts(rest)
    return
  }

  assertEnv()

  if (mode === "new") {
    await generateNew(rest.join(" "))
    return
  }

  if (mode === "update") {
    const first = rest[0]?.toLowerCase()
    const asCount = Number(rest[0])
    if (first === "all") {
      await updateExisting([], Number.POSITIVE_INFINITY)
    } else if (rest.length === 1 && Number.isInteger(asCount) && asCount > 0) {
      await updateExisting([], asCount)
    } else if (rest.length > 0) {
      await updateExisting(rest, rest.length)
    } else {
      await updateExisting([], 1)
    }
    return
  }

  if (mode && mode !== "default") {
    console.log("Usage: tsx scripts/regenerate-blog.ts [new <topic> | update <count|all|slugs...> | delete <slugs...>]")
    return
  }

  // Default: refresh the newest auto post + publish one fresh post.
  await updateExisting([], 1)
  await generateNew(undefined)
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
