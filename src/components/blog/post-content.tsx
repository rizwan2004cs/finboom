import { sanityClient, urlFor } from "@/lib/sanity"
import { PortableText } from "@portabletext/react"
import Image from "next/image"
import MermaidDiagram from "@/components/mermaid-diagram"
import { ZoomableImage } from "@/app/blog/[slug]/zoomable-image"
import { SafeExternalImage } from "@/app/blog/[slug]/safe-external-image"

// Shared blog-post rendering: Sanity fetchers, reading-time helpers, and the
// PortableText component map. Used by BOTH the public /blog/[slug] page and
// the in-app /dashboard/blog/[slug] reader so the article body renders
// identically in either shell.

export type Post = {
  _id: string
  title: string
  slug: { current: string }
  category: string
  excerpt: string
  metaTitle?: string
  metaDescription?: string
  keywords?: string[]
  mainImage?: { asset: { _ref: string } }
  body: Array<Record<string, unknown>>
  publishedAt: string
  updatedAt?: string
}

export async function getPost(slug: string): Promise<Post | null> {
  return sanityClient.fetch(
    `*[_type == "post" && slug.current == $slug][0] {
      _id, title, slug, category, excerpt, metaTitle, metaDescription, keywords,
      mainImage, body, publishedAt, "updatedAt": _updatedAt
    }`,
    { slug }
  )
}

export type RelatedPost = {
  title: string
  slug: string
  excerpt?: string
  publishedAt: string
  category?: string
}

export async function getRelatedPosts(
  slug: string,
  category: string | undefined
): Promise<RelatedPost[]> {
  // Same-category posts first, then newest others to fill up to 3.
  return sanityClient.fetch(
    `*[_type == "post" && slug.current != $slug] {
      title, "slug": slug.current, excerpt, publishedAt, category,
      "sameCategory": category == $category
    } | order(sameCategory desc, publishedAt desc)[0...3]`,
    { slug, category: category ?? "" }
  )
}

export function countBodyWords(body: Array<Record<string, unknown>>): number {
  let words = 0
  for (const block of body) {
    if (block._type !== "block" || !Array.isArray(block.children)) continue
    for (const child of block.children as Array<{ text?: string }>) {
      if (child.text) words += child.text.split(/\s+/).filter(Boolean).length
    }
  }
  return words
}

// Average adult reading speed ~200 wpm.
export function estimateReadingMinutes(body: Array<Record<string, unknown>>): number {
  return Math.max(1, Math.round(countBodyWords(body) / 200))
}

export const portableTextComponents = {
  types: {
    image: ({ value }: { value: { alt?: string } }) => {
      const src = urlFor(value).width(1200).url()
      return (
        <ZoomableImage src={src} alt={value.alt || ""}>
          <div className="my-8 rounded-xl overflow-hidden">
            <Image
              src={src}
              alt={value.alt || ""}
              width={1200}
              height={675}
              className="w-full"
            />
          </div>
        </ZoomableImage>
      )
    },
    externalImage: ({ value }: { value: { url: string; alt?: string } }) => (
      <SafeExternalImage url={value.url} alt={value.alt || ""} />
    ),
    mermaid: ({ value }: { value: { code: string } }) => (
      <MermaidDiagram code={value.code} zoomable />
    ),
    callout: ({ value }: { value: { items?: string[] } }) => {
      const items = value.items ?? []
      if (items.length === 0) return null
      return (
        <aside className="my-8 rounded-2xl border border-accent/20 bg-accent/[0.05] p-5 md:p-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-accent mb-3">
            Key takeaways
          </p>
          <ul className="space-y-2.5">
            {items.map((item) => (
              <li key={item} className="flex items-start gap-2.5 text-[15px] leading-relaxed text-[#1d1d1f] dark:text-white">
                <svg className="w-5 h-5 mt-0.5 shrink-0 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </aside>
      )
    },
    table: ({ value }: { value: { rows: Array<{ isHeader: boolean; cells: Array<{ text: string }> }> } }) => (
      <div className="my-6 overflow-x-auto rounded-xl border border-black/[0.08] dark:border-white/[0.08]">
        <table className="w-full text-sm">
          {value.rows.filter(r => r.isHeader).length > 0 && (
            <thead>
              {value.rows.filter(r => r.isHeader).map((row, ri) => (
                <tr key={ri} className="bg-[#f5f5f7] dark:bg-[#1c1c1e]">
                  {row.cells.map((cell, ci) => (
                    <th key={ci} className="px-4 py-2.5 text-left font-semibold text-[#1d1d1f] dark:text-white border-b border-black/[0.08] dark:border-white/[0.08]">
                      {cell.text}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
          )}
          <tbody>
            {value.rows.filter(r => !r.isHeader).map((row, ri) => (
              <tr key={ri} className="border-b last:border-b-0 border-black/[0.06] dark:border-white/[0.06]">
                {row.cells.map((cell, ci) => (
                  <td key={ci} className="px-4 py-2.5 text-[#1d1d1f]/80 dark:text-[#f5f5f7]/80">
                    {cell.text}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    ),
  },
  block: {
    h2: ({ children }: { children?: React.ReactNode }) => (
      <h2 className="text-2xl font-bold mt-10 mb-4 text-[#1d1d1f] dark:text-white font-serif">
        {children}
      </h2>
    ),
    h3: ({ children }: { children?: React.ReactNode }) => (
      <h3 className="text-xl font-semibold mt-8 mb-3 text-[#1d1d1f] dark:text-white">
        {children}
      </h3>
    ),
    normal: ({ children }: { children?: React.ReactNode }) => (
      <p className="mb-4 text-[#1d1d1f]/80 dark:text-[#f5f5f7]/80 leading-relaxed">
        {children}
      </p>
    ),
    blockquote: ({ children }: { children?: React.ReactNode }) => (
      <blockquote className="border-l-3 border-accent pl-4 my-6 text-[#6e6e73] dark:text-[#98989d] italic">
        {children}
      </blockquote>
    ),
  },
  marks: {
    link: ({
      children,
      value,
    }: {
      children: React.ReactNode
      value?: { href: string }
    }) => (
      <a
        href={value?.href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-accent underline underline-offset-2 hover:opacity-80"
      >
        {children}
      </a>
    ),
    code: ({ children }: { children?: React.ReactNode }) => (
      <code className="px-1.5 py-0.5 rounded bg-[#f5f5f7] dark:bg-[#1c1c1e] font-mono text-sm">
        {children}
      </code>
    ),
  },
  list: {
    bullet: ({ children }: { children?: React.ReactNode }) => (
      <ul className="pl-0 mb-4 space-y-2 text-[#1d1d1f]/80 dark:text-[#f5f5f7]/80 list-none">
        {children}
      </ul>
    ),
    number: ({ children }: { children?: React.ReactNode }) => (
      <ol className="list-decimal pl-6 mb-4 space-y-1 text-[#1d1d1f]/80 dark:text-[#f5f5f7]/80">
        {children}
      </ol>
    ),
  },
  listItem: {
    bullet: ({ children }: { children?: React.ReactNode }) => {
      const text = String(children ?? "");
      const hasCheck = text.includes("✅");
      if (hasCheck) {
        return (
          <li className="flex items-start gap-2.5">
            <svg className="w-5 h-5 mt-0.5 shrink-0 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{text.replace(/\s*✅\s*/g, "")}</span>
          </li>
        );
      }
      return <li className="flex items-start gap-2.5"><span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-current shrink-0" /><span>{children}</span></li>;
    },
  },
}

export function PostBody({ body }: { body: Array<Record<string, unknown>> }) {
  return (
    <div className="mt-10 prose-lg">
      {/* @ts-expect-error - PortableText component typing is complex */}
      <PortableText value={body} components={portableTextComponents} />
    </div>
  )
}
