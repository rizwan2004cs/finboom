"use client"

import { useState } from "react"
import { FeatureTour } from "@/components/feature-tour"
import {
  LayoutDashboard,
  Wallet,
  CreditCard,
  ArrowUpDown,
  PiggyBank,
  HandCoins,
  Target,
  Camera,
  Heart,
  Users,
  BookOpen,
  Settings,
  Play,
} from "lucide-react"

// Mirrors the real sidebar's `data-tour` keys so the desktop spotlight can
// land on the Blog step (which only has a nav target).
const navItems = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { key: "assets", label: "Assets", icon: Wallet },
  { key: "liabilities", label: "Liabilities", icon: CreditCard },
  { key: "transactions", label: "Transactions", icon: ArrowUpDown },
  { key: "budget", label: "Budget", icon: PiggyBank },
  { key: "parties", label: "Parties", icon: HandCoins },
  { key: "goals", label: "Goals", icon: Target },
  { key: "snapshots", label: "Snapshots", icon: Camera },
  { key: "health", label: "Health", icon: Heart },
  { key: "blog", label: "Blog", icon: BookOpen },
  { key: "profiles", label: "Profiles", icon: Users },
  { key: "settings", label: "Settings", icon: Settings },
]

// Mirrors the `data-tour-el` targets the desktop tour spotlights per step.
const sections = [
  { el: "dashboard-summary", title: "Dashboard", blurb: "Net worth, assets, liabilities & spending at a glance." },
  { el: "assets-header", title: "Assets", blurb: "Stocks, mutual funds, real estate, gold & crypto." },
  { el: "liabilities-header", title: "Liabilities", blurb: "Loans & credit cards. Track EMIs & balances." },
  { el: "transactions-header", title: "Transactions", blurb: "Income & expenses, categorized & filtered." },
  { el: "budget-header", title: "Budget", blurb: "Monthly budgets by category & limits." },
  { el: "parties-header", title: "Parties", blurb: "Money lent or borrowed from people." },
  { el: "goals-header", title: "Goals", blurb: "Financial goals & their progress." },
  { el: "snapshots-header", title: "Snapshots", blurb: "Net-worth history over time." },
  { el: "health-header", title: "Health", blurb: "Your financial health score." },
  { el: "profiles-header", title: "Profiles", blurb: "Personal, family or business profiles." },
  { el: "settings-header", title: "Settings", blurb: "Currency, theme, export & preferences." },
]

const skeletonCols = ["a", "b", "c"]

export default function TourPreviewPage() {
  const [open, setOpen] = useState(true)

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#e8eaf0] via-[#f0eef5] to-[#eaf4f0] dark:from-[#0a0a0a] dark:via-[#111113] dark:to-[#0d0d0f] mesh-bg">
      <div className="flex">
        {/* Mock sidebar (desktop only) */}
        <aside className="hidden lg:flex lg:flex-col lg:w-[260px] lg:fixed lg:inset-y-0 glass-elevated border-r border-black/[0.04] dark:border-white/[0.04] p-3">
          <div className="h-12 flex items-center px-3">
            <span className="text-[17px] font-semibold tracking-[-0.3px] text-[#1d1d1f] dark:text-white">
              FinBoom
            </span>
          </div>
          <nav className="flex-1 space-y-0.5 overflow-y-auto">
            {navItems.map((n) => (
              <div
                key={n.key}
                data-tour={n.key}
                className="flex items-center gap-3 rounded-xl px-3 py-2 text-[14px] font-medium text-[#6e6e73] dark:text-[#aeaeb2]"
              >
                <n.icon className="w-[18px] h-[18px]" strokeWidth={1.5} />
                <span>{n.label}</span>
              </div>
            ))}
          </nav>
        </aside>

        {/* Main */}
        <main className="flex-1 lg:pl-[260px]">
          <div className="p-4 lg:p-8 space-y-6 max-w-5xl">
            <div className="liquid-glass rounded-2xl p-4 flex items-center justify-between gap-4">
              <div>
                <h1 className="text-[15px] font-bold text-[#1d1d1f] dark:text-white">Tour preview</h1>
                <p className="text-[12px] text-[#6e6e73] dark:text-[#aeaeb2]">
                  Desktop: the spotlight walks through these cards. Resize the window under 1024px to
                  see the dedicated mobile carousel.
                </p>
              </div>
              <button
                onClick={() => setOpen(true)}
                className="flex items-center gap-1.5 shrink-0 text-[12px] font-semibold px-3.5 py-2 rounded-full bg-[#1d1d1f] dark:bg-white text-white dark:text-[#1d1d1f]"
              >
                <Play className="w-3.5 h-3.5" /> Restart tour
              </button>
            </div>

            {sections.map((s) => (
              <div key={s.el} data-tour-el={s.el} className="liquid-glass rounded-2xl p-5 min-h-[160px]">
                <h2 className="text-[15px] font-bold text-[#1d1d1f] dark:text-white mb-1">{s.title}</h2>
                <p className="text-[13px] text-[#6e6e73] dark:text-[#aeaeb2] mb-4">{s.blurb}</p>
                <div className="grid grid-cols-3 gap-3">
                  {skeletonCols.map((k) => (
                    <div key={k} className="h-16 rounded-xl bg-black/[0.04] dark:bg-white/[0.04]" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </main>
      </div>

      <FeatureTour open={open} onClose={() => setOpen(false)} navigate={false} />
    </div>
  )
}
