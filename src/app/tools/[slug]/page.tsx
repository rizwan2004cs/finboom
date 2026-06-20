import Link from "next/link"
import { notFound } from "next/navigation"
import type { Metadata } from "next"
import { TOOLS, TOOL_SLUGS, getTool } from "@/lib/tools"
import { absoluteUrl, SITE_NAME } from "@/lib/site"
import { CalculatorIsland } from "@/components/tools/calculator-island"
import { CategoryIcon } from "@/components/category-icon"

export const dynamicParams = false

export function generateStaticParams() {
  return TOOL_SLUGS.map((slug) => ({ slug }))
}

export async function generateMetadata({
  params,
}: Readonly<{
  params: Promise<{ slug: string }>
}>): Promise<Metadata> {
  const { slug } = await params
  const tool = getTool(slug)
  if (!tool) return {}
  return {
    title: tool.title,
    description: tool.description,
    keywords: tool.keywords,
    alternates: { canonical: `/tools/${tool.slug}` },
    openGraph: {
      title: `${tool.title} — ${SITE_NAME}`,
      description: tool.description,
      url: absoluteUrl(`/tools/${tool.slug}`),
      type: "website",
    },
  }
}

export default async function ToolPage({ params }: Readonly<{ params: Promise<{ slug: string }> }>) {
  const { slug } = await params
  const tool = getTool(slug)
  if (!tool) notFound()

  const related = TOOLS.filter((t) => t.slug !== tool.slug).slice(0, 3)

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebApplication",
        name: tool.title,
        description: tool.description,
        url: absoluteUrl(`/tools/${tool.slug}`),
        applicationCategory: "FinanceApplication",
        operatingSystem: "Any",
        offers: { "@type": "Offer", price: "0", priceCurrency: "INR" },
      },
      {
        "@type": "FAQPage",
        mainEntity: tool.faqs.map((f) => ({
          "@type": "Question",
          name: f.q,
          acceptedAnswer: { "@type": "Answer", text: f.a },
        })),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Tools", item: absoluteUrl("/tools") },
          { "@type": "ListItem", position: 2, name: tool.title, item: absoluteUrl(`/tools/${tool.slug}`) },
        ],
      },
    ],
  }

  return (
    <main className="max-w-[1200px] mx-auto px-6 lg:px-10 py-12">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <nav className="mb-6 text-sm text-[#86868b] dark:text-[#98989d]">
        <Link href="/tools" className="hover:text-accent transition-colors">Calculators</Link>
        <span className="mx-2">/</span>
        <span className="text-[#1d1d1f] dark:text-white">{tool.title}</span>
      </nav>

      <div className="max-w-2xl">
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-[#1d1d1f] dark:text-white font-serif">
          {tool.title}
        </h1>
        <p className="mt-3 text-[15px] md:text-base text-[#6e6e73] dark:text-[#98989d] leading-relaxed">
          {tool.intro}
        </p>
      </div>

      <div className="mt-8">
        <CalculatorIsland slug={tool.slug} />
      </div>

      {/* FAQ */}
      <section className="mt-16 max-w-3xl">
        <h2 className="text-2xl font-bold text-[#1d1d1f] dark:text-white font-serif">
          Frequently asked questions
        </h2>
        <div className="mt-6 space-y-4">
          {tool.faqs.map((faq) => (
            <details key={faq.q} className="liquid-glass group p-5">
              <summary className="flex cursor-pointer items-center justify-between gap-3 list-none font-semibold text-[#1d1d1f] dark:text-white">
                {faq.q}
                <svg className="h-5 w-5 shrink-0 text-[#86868b] transition-transform group-open:rotate-180" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" /></svg>
              </summary>
              <p className="mt-3 text-[15px] leading-relaxed text-[#6e6e73] dark:text-[#98989d]">
                {faq.a}
              </p>
            </details>
          ))}
        </div>
      </section>

      {/* Related tools */}
      <section className="mt-16">
        <h2 className="text-xl font-semibold text-[#1d1d1f] dark:text-white">More calculators</h2>
        <div className="mt-5 grid gap-5 sm:grid-cols-3">
          {related.map((t) => (
            <Link key={t.slug} href={`/tools/${t.slug}`} className="group liquid-glass p-5">
              <CategoryIcon name={t.icon} className="h-7 w-7 text-[#1d1d1f]/65 dark:text-white/75" />
              <h3 className="mt-2 font-semibold text-[#1d1d1f] dark:text-white group-hover:text-accent transition-colors">
                {t.title}
              </h3>
              <p className="mt-1 text-sm text-[#6e6e73] dark:text-[#98989d]">{t.tagline}</p>
            </Link>
          ))}
        </div>
      </section>
    </main>
  )
}
