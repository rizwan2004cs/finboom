import Link from "next/link"
import type { ReactNode } from "react"

export default function ToolsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-white dark:bg-black">
      <header>
        <nav className="sticky top-0 z-50 glass-elevated border-b border-black/[0.04] dark:border-white/[0.06]">
          <div className="max-w-[1200px] mx-auto px-6 lg:px-10 h-14 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link
                href="/dashboard"
                className="p-1.5 rounded-lg hover:bg-black/[0.05] dark:hover:bg-white/[0.08] transition-all"
                aria-label="Back to Dashboard"
              >
                <svg className="w-5 h-5 text-[#1d1d1f] dark:text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" /></svg>
              </Link>
              <Link href="/tools" className="text-[22px] font-bold tracking-[-0.5px] text-[#1d1d1f] dark:text-white">
                FinBoom
              </Link>
              <span className="hidden sm:inline text-sm font-medium text-[#86868b] dark:text-[#98989d]">Calculators</span>
            </div>
            <div className="flex items-center gap-2 sm:gap-4">
              <Link href="/blog" className="hidden sm:block text-[15px] font-medium text-[#1d1d1f] dark:text-white px-3 py-1.5 rounded-xl hover:bg-black/[0.05] dark:hover:bg-white/[0.08] active:scale-95 transition-all duration-200">
                Blog
              </Link>
              <Link href="/dashboard" className="text-[15px] font-medium text-[#1d1d1f] dark:text-white px-3 py-1.5 rounded-xl hover:bg-black/[0.05] dark:hover:bg-white/[0.08] active:scale-95 transition-all duration-200 whitespace-nowrap">
                Dashboard
              </Link>
            </div>
          </div>
        </nav>
      </header>

      {children}

      <footer className="max-w-[1200px] mx-auto px-6 lg:px-10 py-12 border-t border-black/[0.04] dark:border-white/[0.06]">
        <p className="text-xs leading-relaxed text-[#86868b] dark:text-[#98989d]">
          These calculators are for educational purposes only and do not constitute investment, tax, or financial advice. Results are estimates based on the inputs and assumptions you provide. FinBoom is not a SEBI-registered investment adviser. Consult a qualified professional before making financial decisions.
        </p>
      </footer>
    </div>
  )
}
