import { sanityClient, urlFor } from "@/lib/sanity"
import Image from "next/image"
import Link from "next/link"
import { notFound } from "next/navigation"
import type { Metadata } from "next"
import { ShareButton } from "./share-button"
import { BLOG_CATEGORY_LABELS } from "@/lib/blog/categories"
import { SITE_URL, SITE_NAME, absoluteUrl } from "@/lib/site"
import {
  getPost,
  getRelatedPosts,
  countBodyWords,
  PostBody,
} from "@/components/blog/post-content"

// Re-exported for the /blog/preview page, which renders drafts with the same
// component map.
export { portableTextComponents } from "@/components/blog/post-content"

const CATEGORY_LABELS = BLOG_CATEGORY_LABELS

export async function generateStaticParams() {
  const posts = await sanityClient.fetch<{ slug: { current: string } }[]>(
    `*[_type == "post"]{ slug }`
  )
  return posts.map((post) => ({ slug: post.slug.current }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const post = await getPost(slug)
  if (!post) return { title: "Post Not Found" }

  const seoTitle = post.metaTitle?.trim() || post.title
  const seoDescription =
    post.metaDescription?.trim() || post.excerpt || `Read "${post.title}" on FinBoom Blog`
  const ogImage = post.mainImage
    ? [urlFor(post.mainImage).width(1200).height(630).url()]
    : undefined

  return {
    title: seoTitle,
    description: seoDescription,
    ...(post.keywords?.length ? { keywords: post.keywords } : {}),
    alternates: {
      canonical: `/blog/${post.slug.current}`,
    },
    openGraph: {
      title: seoTitle,
      description: seoDescription,
      type: "article",
      publishedTime: post.publishedAt,
      ...(post.updatedAt ? { modifiedTime: post.updatedAt } : {}),
      url: `/blog/${post.slug.current}`,
      ...(ogImage ? { images: ogImage } : {}),
    },
    twitter: {
      card: ogImage ? "summary_large_image" : "summary",
      title: seoTitle,
      description: seoDescription,
      ...(ogImage ? { images: ogImage } : {}),
    },
  }
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const post = await getPost(slug)

  if (!post) notFound()

  const relatedPosts = await getRelatedPosts(slug, post.category)
  const wordCount = countBodyWords(post.body)
  const readingMinutes = Math.max(1, Math.round(wordCount / 200))
  const postUrl = absoluteUrl(`/blog/${post.slug.current}`)

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.metaDescription?.trim() || post.excerpt,
    datePublished: post.publishedAt,
    dateModified: post.updatedAt || post.publishedAt,
    url: postUrl,
    mainEntityOfPage: postUrl,
    inLanguage: "en-IN",
    wordCount,
    ...(post.category && { articleSection: CATEGORY_LABELS[post.category] || post.category }),
    ...(post.keywords?.length && { keywords: post.keywords.join(", ") }),
    ...(post.mainImage && {
      image: urlFor(post.mainImage).width(1200).height(630).url(),
    }),
    author: {
      "@type": "Organization",
      name: SITE_NAME,
      url: SITE_URL,
    },
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
      url: SITE_URL,
    },
  }

  return (
    <div className="min-h-screen bg-white dark:bg-black">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <header>
        <nav className="sticky top-0 z-50 glass-elevated border-b border-black/[0.04] dark:border-white/[0.06]">
          <div className="max-w-[1200px] mx-auto px-6 lg:px-10 h-14 flex items-center justify-between">
            <Link href="/" className="text-[22px] font-bold tracking-[-0.5px] text-[#1d1d1f] dark:text-white">
              FinBoom
            </Link>
            <div className="flex items-center gap-2">
              <ShareButton title={post.title} text={post.excerpt} />
              <Link href="/blog" className="text-[15px] font-medium text-[#1d1d1f] dark:text-white px-3 py-1.5 rounded-xl hover:bg-black/[0.05] dark:hover:bg-white/[0.08] active:scale-95 transition-all duration-200">
                Blog
              </Link>
            </div>
          </div>
        </nav>
      </header>

      <article className="max-w-[720px] mx-auto px-6 py-16">
        {/* Category + Date */}
        <div className="flex items-center gap-3 mb-6">
          {post.category && (
            <span className="text-xs font-medium text-accent uppercase tracking-wider font-mono">
              {CATEGORY_LABELS[post.category] || post.category}
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

        {/* Title */}
        <div className="relative">
          <Link
            href="/blog"
            className="absolute -left-12 top-2 w-8 h-8 rounded-full flex items-center justify-center bg-black/[0.04] dark:bg-white/[0.06] hover:bg-black/[0.08] dark:hover:bg-white/[0.1] transition-colors max-lg:hidden"
            aria-label="Back to blog"
          >
            <svg className="w-4 h-4 text-[#1d1d1f] dark:text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <Link
            href="/blog"
            className="lg:hidden mb-4 inline-flex items-center gap-1.5 text-sm text-[#6e6e73] hover:text-[#1d1d1f] dark:hover:text-white transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </Link>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-[#1d1d1f] dark:text-white leading-tight font-serif">
            {post.title}
          </h1>
        </div>

        {post.excerpt && (
          <p className="mt-4 text-lg text-[#6e6e73] dark:text-[#98989d]">
            {post.excerpt}
          </p>
        )}

        {/* Hero image */}
        {post.mainImage && (
          <div className="mt-8 rounded-xl overflow-hidden">
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

        {/* Body */}
        <PostBody body={post.body} />

        {/* Related posts */}
        {relatedPosts.length > 0 && (
          <section className="mt-16 pt-8 border-t border-black/[0.06] dark:border-white/[0.06]">
            <h2 className="text-xl font-bold text-[#1d1d1f] dark:text-white font-serif">
              Keep Reading
            </h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-3">
              {relatedPosts.map((related) => (
                <Link
                  key={related.slug}
                  href={`/blog/${related.slug}`}
                  className="group rounded-2xl border border-black/10 dark:border-white/10 p-4 transition-all duration-200 hover:border-black/20 dark:hover:border-white/20 hover:-translate-y-0.5"
                >
                  {related.category && (
                    <span className="text-[10px] font-medium text-accent uppercase tracking-wider font-mono">
                      {CATEGORY_LABELS[related.category] || related.category}
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

        {/* Back to blog */}
        <div className="mt-12 pt-8 border-t border-black/[0.06] dark:border-white/[0.06]">
          <Link
            href="/blog"
            className="text-sm text-accent hover:opacity-80 transition-opacity font-medium"
          >
            ← Back to all posts
          </Link>
        </div>
      </article>
    </div>
  )
}
