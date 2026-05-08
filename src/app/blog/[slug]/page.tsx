import { sanityClient, urlFor } from "@/lib/sanity"
import { PortableText } from "@portabletext/react"
import Image from "next/image"
import Link from "next/link"
import { notFound } from "next/navigation"
import type { Metadata } from "next"
import MermaidDiagram from "@/components/mermaid-diagram"

type Post = {
  _id: string
  title: string
  slug: { current: string }
  category: string
  excerpt: string
  mainImage?: { asset: { _ref: string } }
  body: Array<Record<string, unknown>>
  publishedAt: string
}

const CATEGORY_LABELS: Record<string, string> = {
  tips: "Financial Tips",
  market: "Market Updates",
  product: "Product Updates",
  guides: "Guides",
}

async function getPost(slug: string): Promise<Post | null> {
  return sanityClient.fetch(
    `*[_type == "post" && slug.current == $slug][0] {
      _id, title, slug, category, excerpt, mainImage, body, publishedAt
    }`,
    { slug }
  )
}

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

  return {
    title: post.title,
    description: post.excerpt || `Read "${post.title}" on FinBoom Blog`,
    openGraph: {
      title: post.title,
      description: post.excerpt,
      type: "article",
      publishedTime: post.publishedAt,
      ...(post.mainImage && {
        images: [urlFor(post.mainImage).width(1200).height(630).url()],
      }),
    },
  }
}

const portableTextComponents = {
  types: {
    image: ({ value }: { value: { alt?: string } }) => (
      <div className="my-8 rounded-xl overflow-hidden">
        <Image
          src={urlFor(value).width(1200).url()}
          alt={value.alt || ""}
          width={1200}
          height={675}
          className="w-full"
        />
      </div>
    ),
    externalImage: ({ value }: { value: { url: string; alt?: string } }) => (
      <div className="my-8 rounded-xl overflow-hidden">
        <img
          src={value.url}
          alt={value.alt || ""}
          className="w-full rounded-xl"
          loading="lazy"
        />
      </div>
    ),
    mermaid: ({ value }: { value: { code: string } }) => (
      <MermaidDiagram code={value.code} />
    ),
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
      const hasCheck = text.includes("\u2705");
      if (hasCheck) {
        return (
          <li className="flex items-start gap-2.5">
            <svg className="w-5 h-5 mt-0.5 shrink-0 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{text.replace(/\s*\u2705\s*/g, "")}</span>
          </li>
        );
      }
      return <li className="flex items-start gap-2.5"><span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-current shrink-0" /><span>{children}</span></li>;
    },
  },
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const post = await getPost(slug)

  if (!post) notFound()

  return (
    <div className="min-h-screen bg-white dark:bg-black">
      <header>
        <nav className="sticky top-0 z-50 glass-elevated border-b border-black/[0.04] dark:border-white/[0.06]">
          <div className="max-w-[1200px] mx-auto px-6 lg:px-10 h-14 flex items-center justify-between">
            <Link href="/" className="text-[22px] font-bold tracking-[-0.5px] text-[#1d1d1f] dark:text-white">
              FinBoom
            </Link>
            <div className="flex items-center gap-4">
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
        <div className="mt-10 prose-lg">
          {/* @ts-expect-error - PortableText component typing is complex */}
          <PortableText value={post.body} components={portableTextComponents} />
        </div>

        {/* Back to blog */}
        <div className="mt-16 pt-8 border-t border-black/[0.06] dark:border-white/[0.06]">
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
