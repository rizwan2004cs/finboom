import Link from "next/link"
import type { Metadata } from "next"
import { TOOLS } from "@/lib/tools"
import { SITE_NAME, absoluteUrl } from "@/lib/site"
import { CategoryIcon } from "@/components/category-icon"

export const metadata: Metadata = {
  title: "Free Financial Calculators",
  description:
    "Free, fast financial calculators for India — SIP, step-up SIP, lumpsum, FD, XIRR, HRA exemption, and old-vs-new income tax regime. No sign-up required.",
  keywords: [
    "financial calculators",
    "sip calculator",
    "xirr calculator",
    "income tax calculator",
    "fd calculator",
    "hra calculator",
  ],
  alternates: { canonical: "/tools" },
  openGraph: {
    title: "Free Financial Calculators — FinBoom",
    description:
      "SIP, step-up SIP, lumpsum, FD, XIRR, HRA, and income-tax calculators. Free and instant.",
    url: absoluteUrl("/tools"),
    type: "website",
  },
}

export default function ToolsLandingPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "FinBoom Financial Calculators",
    itemListElement: TOOLS.map((tool, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: tool.title,
      url: absoluteUrl(`/tools/${tool.slug}`),
    })),
  }

  return (
    <main className="max-w-[1200px] mx-auto px-6 lg:px-10 py-16">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <div className="max-w-2xl">
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-[#1d1d1f] dark:text-white font-serif">
          Financial calculators
        </h1>
        <p className="mt-4 text-lg text-[#6e6e73] dark:text-[#98989d]">
          Free, instant, and built for India. Plan your investments, deposits, and taxes — no
          sign-up, no data stored. Then track it all for real in {SITE_NAME}.
        </p>
      </div>

      <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {TOOLS.map((tool) => (
          <Link
            key={tool.slug}
            href={`/tools/${tool.slug}`}
            className="group liquid-glass overflow-hidden"
          >
            <div className={`relative h-28 overflow-hidden bg-gradient-to-br ${tool.gradient}`}>
              <CategoryIcon
                name={tool.icon}
                className="absolute bottom-3 right-4 h-11 w-11 text-[#1d1d1f]/65 dark:text-white/75 transition-transform duration-500 group-hover:scale-110"
              />
            </div>
            <div className="p-5">
              <h2 className="text-lg font-semibold text-[#1d1d1f] dark:text-white group-hover:text-accent transition-colors">
                {tool.title}
              </h2>
              <p className="mt-1.5 text-sm text-[#6e6e73] dark:text-[#98989d]">{tool.tagline}</p>
            </div>
          </Link>
        ))}
      </div>

      <div className="mt-16 liquid-glass p-6 md:p-8">
        <h2 className="text-xl font-semibold text-[#1d1d1f] dark:text-white">
          From a quick estimate to a real plan
        </h2>
        <p className="mt-2 text-[15px] text-[#6e6e73] dark:text-[#98989d] max-w-2xl">
          Calculators are a great start. {SITE_NAME} helps you track your actual net worth, assets,
          goals, and budgets in one private dashboard — free, offline-first, and made for India.
        </p>
        <Link
          href="/dashboard"
          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#1d1d1f] dark:bg-white px-5 py-2.5 text-sm font-semibold text-white dark:text-[#1d1d1f] hover:-translate-y-0.5 active:scale-95 transition-all"
        >
          Open your dashboard
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" /></svg>
        </Link>
      </div>
    </main>
  )
}
