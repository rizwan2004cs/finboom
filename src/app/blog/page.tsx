import { auth, clerkClient } from "@clerk/nextjs/server"
import Link from "next/link"
import type { Metadata } from "next"
import { BlogCategoryFilter } from "./category-filter"
import { BlogSearchBox } from "./search-box"
import { BLOG_CATEGORY_LABELS } from "@/lib/blog/categories"
import {
  getListedPosts,
  FeaturedPostCard,
  PostCard,
} from "@/components/blog/post-cards"

export const metadata: Metadata = {
  title: "Blog",
  description: "Financial tips, market updates, and product news from FinBoom.",
  alternates: {
    canonical: "/blog",
    types: {
      "application/rss+xml": "/feed.xml",
    },
  },
}

export const revalidate = 60

export default async function BlogPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; q?: string }>
}) {
  const posts = await getListedPosts()
  const { category: activeCategory, q } = await searchParams
  const query = q?.trim().toLowerCase() ?? ""

  // Get unique categories from posts
  const categories = [...new Set(posts.map((p) => p.category).filter(Boolean))] as string[]

  // Filter posts by category, then by search query
  const categoryPosts = activeCategory
    ? posts.filter((p) => p.category === activeCategory)
    : posts
  const filteredPosts = query
    ? categoryPosts.filter(
        (p) =>
          p.title.toLowerCase().includes(query) ||
          (p.excerpt ?? "").toLowerCase().includes(query)
      )
    : categoryPosts

  // Feature the newest post with a large card on the unfiltered view.
  const featuredPost =
    !activeCategory && !query && filteredPosts.length > 0 ? filteredPosts[0] : null
  const gridPosts = featuredPost ? filteredPosts.slice(1) : filteredPosts

  let isAdmin = false
  const { userId } = await auth()
  if (userId) {
    try {
      const client = await clerkClient()
      const clerkUser = await client.users.getUser(userId)
      const role = (clerkUser.publicMetadata as { role?: string })?.role
      isAdmin = role === "admin" || role === "editor"
    } catch {
      // ignore — not admin
    }
  }

  return (
    <div className="min-h-screen bg-white dark:bg-black">
      {/* Header */}
      <header>
        <nav className="sticky top-0 z-50 glass-elevated border-b border-black/[0.04] dark:border-white/[0.06]">
          <div className="max-w-[1200px] mx-auto px-6 lg:px-10 h-14 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href="/dashboard" className="p-1.5 rounded-lg hover:bg-black/[0.05] dark:hover:bg-white/[0.08] transition-all" aria-label="Back to Dashboard">
                <svg className="w-5 h-5 text-[#1d1d1f] dark:text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" /></svg>
              </Link>
              <Link href="/" className="text-[22px] font-bold tracking-[-0.5px] text-[#1d1d1f] dark:text-white">
                FinBoom
              </Link>
            </div>
            <div className="flex items-center gap-2 sm:gap-4">
              {isAdmin && (
                <>
                  <Link
                    href="/blog/automation"
                    className="text-sm font-semibold px-3 sm:px-4 py-2 rounded-xl border border-black/10 dark:border-white/15 text-[#1d1d1f] dark:text-white hover:bg-black/[0.05] dark:hover:bg-white/[0.08] transition-all duration-200 whitespace-nowrap"
                  >
                    Automation
                  </Link>
                  <Link
                    href="/blog/new"
                    className="text-sm font-semibold px-3 sm:px-4 py-2 rounded-xl bg-[#1d1d1f] dark:bg-white text-white dark:text-[#1d1d1f] hover:shadow-lg hover:shadow-black/20 dark:hover:shadow-white/20 hover:-translate-y-0.5 active:scale-95 transition-all duration-200 whitespace-nowrap"
                  >
                    + New Post
                  </Link>
                </>
              )}
              <Link href="/tools" className="hidden sm:block text-[15px] font-medium text-[#1d1d1f] dark:text-white px-3 py-1.5 rounded-xl hover:bg-black/[0.05] dark:hover:bg-white/[0.08] active:scale-95 transition-all duration-200">
                Calculators
              </Link>
              <Link href="/" className="hidden sm:block text-[15px] font-medium text-[#1d1d1f] dark:text-white px-3 py-1.5 rounded-xl hover:bg-black/[0.05] dark:hover:bg-white/[0.08] active:scale-95 transition-all duration-200">
                Home
              </Link>
              <Link href="/dashboard" className="text-[15px] font-medium text-[#1d1d1f] dark:text-white px-3 py-1.5 rounded-xl hover:bg-black/[0.05] dark:hover:bg-white/[0.08] active:scale-95 transition-all duration-200 whitespace-nowrap">
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
          <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <BlogCategoryFilter
              categories={categories}
              labels={BLOG_CATEGORY_LABELS}
              active={activeCategory}
            />
            <BlogSearchBox initialQuery={q} />
          </div>
          {query && filteredPosts.length > 0 && (
            <p className="mt-4 text-sm text-[#6e6e73] dark:text-[#98989d]">
              {filteredPosts.length} {filteredPosts.length === 1 ? "post" : "posts"} matching
              {" "}&ldquo;{q}&rdquo;
            </p>
          )}
        </div>

        {filteredPosts.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-[#86868b] dark:text-[#98989d] text-lg">
              {query
                ? `No posts matching "${q}".`
                : activeCategory
                  ? "No posts in this category."
                  : "No posts yet. Check back soon!"}
            </p>
          </div>
        ) : (
          <>
            {featuredPost && <FeaturedPostCard post={featuredPost} />}

            <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
              {gridPosts.map((post) => (
                <PostCard key={post._id} post={post} />
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  )
}
