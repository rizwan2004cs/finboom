import Link from "next/link"
import { notFound } from "next/navigation"
import { ChevronLeft } from "lucide-react"
import { TOOLS, TOOL_SLUGS, getTool } from "@/lib/tools"
import { CalculatorIsland } from "@/components/tools/calculator-island"

export const dynamicParams = false

export function generateStaticParams() {
  return TOOL_SLUGS.map((slug) => ({ slug }))
}

// In-app version of a calculator: same CalculatorIsland as the public
// /tools/[slug] page, wrapped in the dashboard's compact header style instead
// of the marketing hero + SEO scaffolding.
export default async function DashboardCalculatorPage({
  params,
}: Readonly<{ params: Promise<{ slug: string }> }>) {
  const { slug } = await params
  const tool = getTool(slug)
  if (!tool) notFound()

  const others = TOOLS.filter((t) => t.slug !== tool.slug)

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Link
          href="/dashboard/calculators"
          aria-label="Back to calculators"
          className="p-2 -ml-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-all"
        >
          <ChevronLeft className="w-5 h-5 text-[#515154] dark:text-[#98989d]" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-[#1d1d1f] dark:text-white">{tool.title}</h1>
          <p className="text-sm text-[#86868b]">{tool.tagline}</p>
        </div>
      </div>

      <CalculatorIsland slug={tool.slug} />

      {/* Quick hop to the other calculators */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {others.map((t) => (
          <Link
            key={t.slug}
            href={`/dashboard/calculators/${t.slug}`}
            className="shrink-0 text-xs font-medium px-3 py-1.5 rounded-full border border-black/10 dark:border-white/15 bg-white/60 dark:bg-white/[0.04] text-[#515154] dark:text-[#98989d] hover:text-accent transition-colors whitespace-nowrap"
          >
            {t.title}
          </Link>
        ))}
      </div>

      <details className="liquid-glass group p-4">
        <summary className="flex cursor-pointer items-center justify-between gap-3 list-none text-sm font-semibold text-[#1d1d1f] dark:text-white">
          How this calculator works
          <ChevronLeft className="h-4 w-4 shrink-0 -rotate-90 text-[#86868b] transition-transform group-open:rotate-90" />
        </summary>
        <div className="mt-3 space-y-3">
          <p className="text-sm leading-relaxed text-[#6e6e73] dark:text-[#98989d]">{tool.intro}</p>
          {tool.faqs.map((faq) => (
            <div key={faq.q}>
              <p className="text-sm font-medium text-[#1d1d1f] dark:text-white">{faq.q}</p>
              <p className="mt-1 text-sm leading-relaxed text-[#6e6e73] dark:text-[#98989d]">{faq.a}</p>
            </div>
          ))}
        </div>
      </details>
    </div>
  )
}
