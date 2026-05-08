import { sanityClient, urlFor } from "@/lib/sanity"
import { auth } from "@clerk/nextjs/server"
import { clerkClient } from "@clerk/nextjs/server"
import Link from "next/link"
import Image from "next/image"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Blog",
  description: "Financial tips, market updates, and product news from FinBoom.",
}

type Post = {
  _id: string
  title: string
  slug: { current: string }
  category: string
  excerpt: string
  mainImage?: { asset: { _ref: string } }
  publishedAt: string
}

const CATEGORY_LABELS: Record<string, string> = {
  tips: "Financial Tips",
  market: "Market Updates",
  product: "Product Updates",
  guides: "Guides",
}

const CATEGORY_COLORS: Record<string, string> = {
  tips: "bg-accent/10 text-accent",
  market: "bg-accent/10 text-accent",
  product: "bg-accent/10 text-accent",
  guides: "bg-accent/10 text-accent",
}

async function getPosts(): Promise<Post[]> {
  return sanityClient.fetch(
    `*[_type == "post"] | order(publishedAt desc) {
      _id, title, slug, category, excerpt, mainImage, publishedAt
    }`
  )
}

export const revalidate = 60

export default async function BlogPage() {
  const posts = await getPosts()

  let isAdmin = false
  const { userId } = await auth()
  if (userId) {
    const client = await clerkClient()
    const user = await client.users.getUser(userId)
    isAdmin = (user.publicMetadata as { role?: string })?.role === "admin"
  }

  return (
    <div className="min-h-screen bg-white dark:bg-black">
      {/* Header */}
      <header>
        <nav className="sticky top-0 z-50 glass-elevated border-b border-black/[0.04] dark:border-white/[0.06]">
          <div className="max-w-[1200px] mx-auto px-6 lg:px-10 h-12 flex items-center justify-between">
            <Link href="/" className="text-[17px] font-semibold tracking-[-0.3px] text-[#1d1d1f] dark:text-white">
              FinBoom
            </Link>
            <div className="flex items-center gap-4">
              {isAdmin && (
                <Link
                  href="/blog/new"
                  className="text-sm font-medium px-3.5 py-1.5 rounded-xl border border-black/10 dark:border-white/10 text-[#1d1d1f] dark:text-white hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                >
                  + New Post
                </Link>
              )}
              <Link href="/" className="text-sm text-[#6e6e73] hover:text-[#1d1d1f] dark:hover:text-white transition-colors">
                Home
              </Link>
              <Link href="/dashboard" className="text-sm text-[#6e6e73] hover:text-[#1d1d1f] dark:hover:text-white transition-colors">
                Dashboard
              </Link>
            </div>
          </div>
        </nav>
      </header>

      <main className="max-w-[1200px] mx-auto px-6 lg:px-10 py-16">
        <div className="mb-12">
          <h1 className="text-4xl font-bold tracking-tight text-[#1d1d1f] dark:text-white font-serif">
            Blog
          </h1>
          <p className="mt-3 text-lg text-[#6e6e73] dark:text-[#98989d]">
            Financial tips, market insights, and product updates.
          </p>
        </div>

        {posts.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-[#86868b] dark:text-[#98989d] text-lg">No posts yet. Check back soon!</p>
          </div>
        ) : (
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {posts.map((post) => (
              <Link
                key={post._id}
                href={`/blog/${post.slug.current}`}
                className="group liquid-glass overflow-hidden"
              >
                {post.mainImage && (
                  <div className="relative h-48 overflow-hidden">
                    <Image
                      src={urlFor(post.mainImage).width(600).height(400).url()}
                      alt={post.title}
                      fill
                      className="object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  </div>
                )}
                <div className="p-5">
                  {post.category && (
                    <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium mb-3 ${CATEGORY_COLORS[post.category] || "bg-gray-100 text-gray-600"}`}>
                      {CATEGORY_LABELS[post.category] || post.category}
                    </span>
                  )}
                  <h2 className="text-lg font-semibold text-[#1d1d1f] dark:text-white group-hover:text-accent transition-colors line-clamp-2">
                    {post.title}
                  </h2>
                  {post.excerpt && (
                    <p className="mt-2 text-sm text-[#6e6e73] dark:text-[#98989d] line-clamp-2">
                      {post.excerpt}
                    </p>
                  )}
                  <time className="mt-3 block text-xs text-[#86868b] dark:text-[#636366] font-mono">
                    {new Date(post.publishedAt).toLocaleDateString("en-IN", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </time>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
