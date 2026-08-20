import Image from "next/image"
import Link from "next/link"
import { sanityClient, urlFor } from "@/lib/sanity"
import { BLOG_CATEGORY_LABELS, BLOG_CATEGORY_GRADIENTS } from "@/lib/blog/categories"

// Shared blog listing pieces (Sanity fetcher + cards), used by the public
// /blog page and the in-app /dashboard/blog page. `hrefBase` decides which
// shell a card links back into.

export type ListedPost = {
  _id: string
  title: string
  slug: { current: string }
  category?: string
  excerpt?: string
  mainImage?: { asset: { _ref: string } }
  publishedAt: string
}

export async function getListedPosts(): Promise<ListedPost[]> {
  return sanityClient.fetch(
    `*[_type == "post"] | order(publishedAt desc) {
      _id, title, slug, category, excerpt, mainImage, publishedAt
    }`
  )
}

export const CATEGORY_BADGE_CLASS = "bg-accent/10 text-accent"

export function CardArtwork({ post, tall = false }: { post: ListedPost; tall?: boolean }) {
  const height = tall ? "h-full min-h-[220px]" : "h-48"
  // Round the artwork wrapper itself (matching the card's radius) instead of
  // relying on the card's overflow clipping — the card animates a 3D
  // transform on hover, and browsers drop an ancestor's rounded clipping for
  // a frame when the scaled image gets promoted to its own layer, flashing
  // sharp corners. The featured (tall) card's artwork sits on top on mobile
  // but fills the left column on md, so its rounded edge moves with it.
  const rounding = tall
    ? "rounded-t-[var(--radius)] md:rounded-tr-none md:rounded-l-[var(--radius)]"
    : "rounded-t-[var(--radius)]"
  if (post.mainImage) {
    return (
      <div className={`relative ${height} overflow-hidden ${rounding}`}>
        <Image
          src={urlFor(post.mainImage).width(600).height(400).url()}
          alt={post.title}
          fill
          className="object-cover transition-transform duration-500 group-hover:scale-105 will-change-transform"
        />
      </div>
    )
  }
  return (
    <div
      className={`relative ${height} overflow-hidden ${rounding} bg-gradient-to-br ${
        BLOG_CATEGORY_GRADIENTS[post.category ?? ""] || "from-slate-500/20 via-slate-400/10 to-transparent"
      }`}
    >
      <span
        aria-hidden
        className="absolute -bottom-5 left-4 select-none font-serif text-[110px] font-bold leading-none text-black/[0.08] dark:text-white/[0.08] transition-transform duration-500 group-hover:scale-105 will-change-transform"
      >
        {post.title.charAt(0)}
      </span>
    </div>
  )
}

export function FeaturedPostCard({ post, hrefBase = "/blog" }: { post: ListedPost; hrefBase?: string }) {
  return (
    <Link
      href={`${hrefBase}/${post.slug.current}`}
      className="group liquid-glass mb-10 grid overflow-hidden md:grid-cols-2"
    >
      <CardArtwork post={post} tall />
      <div className="flex flex-col justify-center p-6 md:p-8">
        <div className="flex items-center gap-2.5">
          <span className="inline-block rounded-full bg-accent px-2.5 py-0.5 text-xs font-semibold text-white">
            Latest
          </span>
          {post.category && (
            <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${CATEGORY_BADGE_CLASS}`}>
              {BLOG_CATEGORY_LABELS[post.category] || post.category}
            </span>
          )}
        </div>
        <h2 className="mt-4 font-serif text-2xl md:text-3xl font-bold leading-tight text-[#1d1d1f] dark:text-white group-hover:text-accent transition-colors">
          {post.title}
        </h2>
        {post.excerpt && (
          <p className="mt-3 text-[15px] text-[#6e6e73] dark:text-[#98989d] line-clamp-3">
            {post.excerpt}
          </p>
        )}
        <time className="mt-4 block text-xs text-[#86868b] dark:text-[#636366] font-mono">
          {new Date(post.publishedAt).toLocaleDateString("en-IN", {
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </time>
      </div>
    </Link>
  )
}

export function PostCard({ post, hrefBase = "/blog" }: { post: ListedPost; hrefBase?: string }) {
  return (
    <Link
      href={`${hrefBase}/${post.slug.current}`}
      className="group liquid-glass overflow-hidden"
    >
      <CardArtwork post={post} />
      <div className="p-5">
        {post.category && (
          <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium mb-3 ${CATEGORY_BADGE_CLASS}`}>
            {BLOG_CATEGORY_LABELS[post.category] || post.category}
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
  )
}
