"use client"

import { useState, useEffect, useCallback } from "react"
import { cn } from "@/lib/utils"
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
  ChevronLeft,
  ChevronRight,
  X,
  Sparkles,
  type LucideIcon,
} from "lucide-react"

type TourStep = {
  icon: LucideIcon
  title: string
  description: string
  color: string
  darkColor: string
}

const tourSteps: TourStep[] = [
  {
    icon: Sparkles,
    title: "Welcome to FinBoom!",
    description:
      "Your personal finance tracker with a beautiful glass design. Let\u2019s walk through everything you can do here.",
    color: "bg-purple-50 text-purple-600",
    darkColor: "dark:bg-purple-500/20 dark:text-purple-400",
  },
  {
    icon: LayoutDashboard,
    title: "Dashboard",
    description:
      "Your financial command center. See your net worth, total assets, liabilities, charts, and quick actions all in one glance.",
    color: "bg-blue-50 text-blue-600",
    darkColor: "dark:bg-blue-500/20 dark:text-blue-400",
  },
  {
    icon: Wallet,
    title: "Assets",
    description:
      "Track all your investments \u2014 stocks, mutual funds, real estate, gold, crypto, and more. Import via CSV or add manually.",
    color: "bg-green-50 text-green-600",
    darkColor: "dark:bg-green-500/20 dark:text-green-400",
  },
  {
    icon: CreditCard,
    title: "Liabilities",
    description:
      "Keep tabs on all your loans \u2014 home, car, personal, or credit card. Monitor outstanding amounts and EMIs.",
    color: "bg-red-50 text-red-600",
    darkColor: "dark:bg-red-500/20 dark:text-red-400",
  },
  {
    icon: ArrowUpDown,
    title: "Transactions",
    description:
      "Log every income and expense. Categorize, filter, and understand where your money goes each month.",
    color: "bg-orange-50 text-orange-600",
    darkColor: "dark:bg-orange-500/20 dark:text-orange-400",
  },
  {
    icon: PiggyBank,
    title: "Budget",
    description:
      "Set monthly budgets by category and track your spending against them. Stay on top of your finances effortlessly.",
    color: "bg-pink-50 text-pink-600",
    darkColor: "dark:bg-pink-500/20 dark:text-pink-400",
  },
  {
    icon: HandCoins,
    title: "Parties",
    description:
      "Track money you\u2019ve lent or borrowed from friends and family. Never forget who owes you and when it\u2019s due.",
    color: "bg-emerald-50 text-emerald-600",
    darkColor: "dark:bg-emerald-500/20 dark:text-emerald-400",
  },
  {
    icon: Target,
    title: "Goals",
    description:
      "Set financial goals \u2014 emergency fund, vacation, new car \u2014 and track your progress toward each one.",
    color: "bg-indigo-50 text-indigo-600",
    darkColor: "dark:bg-indigo-500/20 dark:text-indigo-400",
  },
  {
    icon: Camera,
    title: "Snapshots",
    description:
      "Capture your net worth at any point in time. Build a history to see how your wealth grows month over month.",
    color: "bg-violet-50 text-violet-600",
    darkColor: "dark:bg-violet-500/20 dark:text-violet-400",
  },
  {
    icon: Heart,
    title: "Health",
    description:
      "Get a financial health score based on your savings rate, debt ratio, emergency fund, and investment diversity.",
    color: "bg-rose-50 text-rose-600",
    darkColor: "dark:bg-rose-500/20 dark:text-rose-400",
  },
  {
    icon: Users,
    title: "Profiles",
    description:
      "Manage multiple financial profiles \u2014 personal, family, or business. Switch between them instantly.",
    color: "bg-cyan-50 text-cyan-600",
    darkColor: "dark:bg-cyan-500/20 dark:text-cyan-400",
  },
  {
    icon: BookOpen,
    title: "Blog",
    description:
      "Read curated articles on personal finance, investing tips, budgeting strategies, and more.",
    color: "bg-amber-50 text-amber-600",
    darkColor: "dark:bg-amber-500/20 dark:text-amber-400",
  },
]

const TOUR_SEEN_KEY = "finboom_tour_seen"

export function useFeatureTour() {
  const [open, setOpen] = useState(false)

  const startTour = useCallback(() => setOpen(true), [])

  const closeTour = useCallback(() => {
    setOpen(false)
    try {
      localStorage.setItem(TOUR_SEEN_KEY, "1")
    } catch {}
  }, [])

  // Auto-trigger on first visit
  useEffect(() => {
    try {
      if (!localStorage.getItem(TOUR_SEEN_KEY)) {
        // Small delay so dashboard renders first
        const t = setTimeout(() => setOpen(true), 800)
        return () => clearTimeout(t)
      }
    } catch {}
  }, [])

  return { open, startTour, closeTour }
}

export function FeatureTour({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const [step, setStep] = useState(0)

  // Reset step when opened
  useEffect(() => {
    if (open) setStep(0)
  }, [open])

  // Keyboard navigation
  useEffect(() => {
    if (!open) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        setStep((s) => Math.min(s + 1, tourSteps.length - 1))
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        setStep((s) => Math.max(s - 1, 0))
      } else if (e.key === "Escape") {
        onClose()
      }
    }
    window.addEventListener("keydown", handleKey)
    return () => window.removeEventListener("keydown", handleKey)
  }, [open, onClose])

  if (!open) return null

  const current = tourSteps[step]
  const isFirst = step === 0
  const isLast = step === tourSteps.length - 1
  const Icon = current.icon

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-md"
        onClick={onClose}
      />

      {/* Card */}
      <div className="relative w-full max-w-md animate-in fade-in zoom-in-95 duration-200">
        <div className="liquid-glass rounded-2xl p-6 relative overflow-hidden">
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-full bg-white/50 dark:bg-white/10 hover:bg-white/80 dark:hover:bg-white/20 transition-colors z-10"
          >
            <X className="w-4 h-4 text-[#3a3a3c] dark:text-[#aeaeb2]" strokeWidth={2} />
          </button>

          {/* Step indicator */}
          <div className="flex items-center gap-1.5 mb-6">
            {tourSteps.map((_, i) => (
              <button
                key={i}
                onClick={() => setStep(i)}
                className={cn(
                  "h-1.5 rounded-full transition-all duration-300",
                  i === step
                    ? "w-6 bg-[#1d1d1f] dark:bg-white"
                    : i < step
                    ? "w-1.5 bg-[#1d1d1f]/40 dark:bg-white/40"
                    : "w-1.5 bg-[#1d1d1f]/15 dark:bg-white/15"
                )}
              />
            ))}
          </div>

          {/* Icon */}
          <div
            className={cn(
              "w-14 h-14 rounded-2xl flex items-center justify-center mb-5",
              current.color,
              current.darkColor
            )}
          >
            <Icon className="w-7 h-7" strokeWidth={1.5} />
          </div>

          {/* Content */}
          <h2 className="text-[22px] font-semibold tracking-[-0.3px] text-[#1d1d1f] dark:text-white mb-2">
            {current.title}
          </h2>
          <p className="text-[15px] leading-relaxed text-[#86868b] dark:text-[#aeaeb2] min-h-[72px]">
            {current.description}
          </p>

          {/* Navigation */}
          <div className="flex items-center justify-between mt-6">
            <button
              onClick={() => setStep((s) => Math.max(s - 1, 0))}
              disabled={isFirst}
              className={cn(
                "flex items-center gap-1 text-[14px] font-medium px-3 py-2 rounded-xl transition-all",
                isFirst
                  ? "text-[#86868b]/40 dark:text-white/20 cursor-not-allowed"
                  : "text-[#86868b] dark:text-[#aeaeb2] hover:bg-white/50 dark:hover:bg-white/10"
              )}
            >
              <ChevronLeft className="w-4 h-4" />
              Back
            </button>

            {isLast ? (
              <button
                onClick={onClose}
                className="flex items-center gap-1 text-[14px] font-semibold px-5 py-2.5 rounded-xl bg-[#1d1d1f] dark:bg-white text-white dark:text-[#1d1d1f] hover:opacity-90 transition-opacity"
              >
                Get Started
              </button>
            ) : (
              <button
                onClick={() => setStep((s) => Math.min(s + 1, tourSteps.length - 1))}
                className="flex items-center gap-1 text-[14px] font-semibold px-5 py-2.5 rounded-xl bg-[#1d1d1f] dark:bg-white text-white dark:text-[#1d1d1f] hover:opacity-90 transition-opacity"
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Skip link */}
          {!isLast && (
            <button
              onClick={onClose}
              className="w-full text-center mt-3 text-[12px] text-[#86868b] dark:text-[#aeaeb2] hover:text-[#1d1d1f] dark:hover:text-white transition-colors"
            >
              Skip tour
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
