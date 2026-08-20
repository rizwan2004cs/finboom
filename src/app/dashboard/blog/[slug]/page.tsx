import Image from "next/image"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ChevronLeft } from "lucide-react"
import { urlFor } from "@/lib/sanity"
import { ShareButton } from "@/app/blog/[slug]/share-button"
import { BLOG_CATEGORY_LABELS } from "@/lib/blog/categories"
import {
  getPost,
  getRelatedPosts,
  estimateReadingMinutes,
  PostBody,
} from "@/components/blog/post-content"

// In-app post reader: identical article rendering to the public
// /blog/[slug] page, inside the dashboard shell.

export const revalidate = 60

export default async function DashboardBlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const post = await getPost(slug)
  if (!post) notFound()

  const relatedPosts = await getRelatedPosts(slug, post.category)
  const readingMinutes = estimateReadingMinutes(post.body)

  return (
    <div className="max-w-[760px] mx-auto">
      <div className="flex items-center justify-between gap-2">
        <Link
          href="/dashboard/blog"
          className="inline-flex items-center gap-1 text-sm text-[#6e6e73] dark:text-[#98989d] hover:text-[#1d1d1f] dark:hover:text-white transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          Blog
        </Link>
        <ShareButton title={post.title} text={post.excerpt} />
      </div>

      <article className="mt-4">
        <div className="flex items-center gap-3 mb-4">
          {post.category && (
            <span className="text-xs font-medium text-accent uppercase tracking-wider font-mono">
              {BLOG_CATEGORY_LABELS[post.category] || post.category}
            </span>
          )}
          <span className="text-[#86868b] dark:text-[#636366]">·</span>
          <time className="text-xs text-[#86868b] dark:text-[#636366] font-mono">
            {new Date(post.publishedAt).toLocaleDateString("en-IN", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </time>
          <span className="text-[#86868b] dark:text-[#636366]">·</span>
          <span className="text-xs text-[#86868b] dark:text-[#636366] font-mono">
            {readingMinutes} min read
          </span>
        </div>

        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-[#1d1d1f] dark:text-white leading-tight">
          {post.title}
        </h1>

        {post.excerpt && (
          <p className="mt-3 text-[15px] text-[#6e6e73] dark:text-[#98989d]">{post.excerpt}</p>
        )}

        {post.mainImage && (
          <div className="mt-6 rounded-xl overflow-hidden">
            <Image
              src={urlFor(post.mainImage).width(1440).height(810).url()}
              alt={post.title}
              width={1440}
              height={810}
              className="w-full"
              priority
            />
          </div>
        )}

        <PostBody body={post.body} />

        {relatedPosts.length > 0 && (
          <section className="mt-12 pt-6 border-t border-black/[0.06] dark:border-white/[0.06]">
            <h2 className="text-lg font-bold text-[#1d1d1f] dark:text-white">Keep Reading</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              {relatedPosts.map((related) => (
                <Link
                  key={related.slug}
                  href={`/dashboard/blog/${related.slug}`}
                  className="group liquid-glass p-4"
                >
                  {related.category && (
                    <span className="text-[10px] font-medium text-accent uppercase tracking-wider font-mono">
                      {BLOG_CATEGORY_LABELS[related.category] || related.category}
                    </span>
                  )}
                  <p className="mt-1.5 text-[15px] font-semibold leading-snug text-[#1d1d1f] dark:text-white group-hover:text-accent transition-colors line-clamp-3">
                    {related.title}
                  </p>
                  <time className="mt-2 block text-xs text-[#86868b] dark:text-[#636366] font-mono">
                    {new Date(related.publishedAt).toLocaleDateString("en-IN", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </time>
                </Link>
              ))}
            </div>
          </section>
        )}
      </article>
    </div>
  )
}
