import { BlogCategoryFilter } from "@/app/blog/category-filter"
import { BlogSearchBox } from "@/app/blog/search-box"
import { BLOG_CATEGORY_LABELS } from "@/lib/blog/categories"
import {
  getListedPosts,
  FeaturedPostCard,
  PostCard,
} from "@/components/blog/post-cards"

// In-app blog listing: the same posts and cards as the public /blog page,
// rendered inside the dashboard shell so reading the blog doesn't feel like
// leaving the app. The public /blog stays as the SEO-indexed surface
// (/dashboard is disallowed in robots.ts).

export const revalidate = 60

export default async function DashboardBlogPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; q?: string }>
}) {
  const posts = await getListedPosts()
  const { category: activeCategory, q } = await searchParams
  const query = q?.trim().toLowerCase() ?? ""

  const categories = [...new Set(posts.map((p) => p.category).filter(Boolean))] as string[]

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

  const featuredPost =
    !activeCategory && !query && filteredPosts.length > 0 ? filteredPosts[0] : null
  const gridPosts = featuredPost ? filteredPosts.slice(1) : filteredPosts

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-[#1d1d1f] dark:text-white">Blog</h1>
        <p className="text-sm text-[#86868b]">Financial tips, market insights, and product updates</p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <BlogCategoryFilter
          categories={categories}
          labels={BLOG_CATEGORY_LABELS}
          active={activeCategory}
          basePath="/dashboard/blog"
        />
        <BlogSearchBox initialQuery={q} basePath="/dashboard/blog" />
      </div>

      {filteredPosts.length === 0 ? (
        <p className="text-center py-16 text-[#86868b]">
          {query
            ? `No posts matching "${q}".`
            : activeCategory
              ? "No posts in this category."
              : "No posts yet. Check back soon!"}
        </p>
      ) : (
        <>
          {featuredPost && <FeaturedPostCard post={featuredPost} hrefBase="/dashboard/blog" />}
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {gridPosts.map((post) => (
              <PostCard key={post._id} post={post} hrefBase="/dashboard/blog" />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
