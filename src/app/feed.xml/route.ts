import { sanityClient } from "@/lib/sanity"
import { SITE_URL } from "@/lib/site"

export const revalidate = 3600

const BASE_URL = SITE_URL

type FeedPost = {
  title: string
  slug: string
  excerpt?: string
  publishedAt: string
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
}

// GET /feed.xml - RSS 2.0 feed of the latest blog posts.
export async function GET() {
  let posts: FeedPost[] = []
  try {
    posts = await sanityClient.fetch(
      `*[_type == "post" && defined(slug.current)] | order(publishedAt desc)[0...30] {
        title, "slug": slug.current, excerpt, publishedAt
      }`
    )
  } catch {
    posts = []
  }

  const items = posts
    .map(
      (post) => `    <item>
      <title>${escapeXml(post.title)}</title>
      <link>${BASE_URL}/blog/${post.slug}</link>
      <guid>${BASE_URL}/blog/${post.slug}</guid>
      <pubDate>${new Date(post.publishedAt).toUTCString()}</pubDate>
      <description>${escapeXml(post.excerpt ?? "")}</description>
    </item>`
    )
    .join("\n")

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>FinBoom Blog</title>
    <link>${BASE_URL}/blog</link>
    <atom:link href="${BASE_URL}/feed.xml" rel="self" type="application/rss+xml"/>
    <description>Financial tips, market insights, and wealth-building guides for Indian investors.</description>
    <language>en-in</language>
${items}
  </channel>
</rss>`

  return new Response(xml, {
    headers: { "Content-Type": "application/rss+xml; charset=utf-8" },
  })
}
