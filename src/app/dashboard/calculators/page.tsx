import Link from "next/link"
import { TOOLS } from "@/lib/tools"
import { CategoryIcon } from "@/components/category-icon"

// In-app calculators hub. Renders the same calculators as the public /tools
// pages but inside the dashboard shell (sidebar, top bar, app styling) — the
// public marketing pages stay at /tools for SEO.
export default function DashboardCalculatorsPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-[#1d1d1f] dark:text-white">Calculators</h1>
        <p className="text-sm text-[#86868b]">
          Plan investments, deposits, and taxes — instant and private
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {TOOLS.map((tool) => (
          <Link
            key={tool.slug}
            href={`/dashboard/calculators/${tool.slug}`}
            className="group liquid-glass p-5 flex items-start gap-4"
          >
            <div className="shrink-0 flex items-center justify-center w-11 h-11 rounded-xl bg-black/[0.04] dark:bg-white/[0.06]">
              <CategoryIcon
                name={tool.icon}
                className="h-5 w-5 text-[#1d1d1f]/70 dark:text-white/80"
              />
            </div>
            <div className="min-w-0">
              <h2 className="font-semibold text-[#1d1d1f] dark:text-white group-hover:text-accent transition-colors">
                {tool.title}
              </h2>
              <p className="mt-1 text-sm text-[#86868b]">{tool.tagline}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
