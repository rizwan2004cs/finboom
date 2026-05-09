"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useRouter, usePathname } from "next/navigation"
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
  Settings,
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
  href?: string
  // Specific element inside the page to spotlight
  elSelector?: string
  // Sidebar / bottom nav link to also spotlight
  navSelector?: string
}

const tourSteps: TourStep[] = [
  {
    icon: Sparkles,
    title: "Welcome to FinBoom!",
    description: "Your personal finance tracker. Let\u2019s walk through everything you can do.",
  },
  {
    icon: LayoutDashboard,
    title: "Dashboard",
    description: "Net worth, assets, liabilities & spending charts at a glance.",
    href: "/dashboard",
    elSelector: "[data-tour-el='dashboard-summary']",
    navSelector: "[data-tour='dashboard'], [data-tour-mobile='home']",
  },
  {
    icon: Wallet,
    title: "Assets",
    description: "Track stocks, mutual funds, real estate, gold & crypto.",
    href: "/dashboard/assets",
    elSelector: "[data-tour-el='assets-header']",
    navSelector: "[data-tour='assets'], [data-tour-mobile='assets']",
  },
  {
    icon: CreditCard,
    title: "Liabilities",
    description: "Monitor loans & credit cards. Track EMIs & balances.",
    href: "/dashboard/liabilities",
    elSelector: "[data-tour-el='liabilities-header']",
    navSelector: "[data-tour='liabilities'], [data-tour-mobile='loans']",
  },
  {
    icon: ArrowUpDown,
    title: "Transactions",
    description: "Log income & expenses. Categorize & filter.",
    href: "/dashboard/transactions",
    elSelector: "[data-tour-el='transactions-header']",
    navSelector: "[data-tour='transactions'], [data-tour-mobile='track']",
  },
  {
    icon: PiggyBank,
    title: "Budget",
    description: "Set monthly budgets by category & track limits.",
    href: "/dashboard/budget",
    elSelector: "[data-tour-el='budget-header']",
    navSelector: "[data-tour='budget']",
  },
  {
    icon: HandCoins,
    title: "Parties",
    description: "Track money lent or borrowed from friends & family.",
    href: "/dashboard/parties",
    elSelector: "[data-tour-el='parties-header']",
    navSelector: "[data-tour='parties']",
  },
  {
    icon: Target,
    title: "Goals",
    description: "Set financial goals & track your progress.",
    href: "/dashboard/goals",
    elSelector: "[data-tour-el='goals-header']",
    navSelector: "[data-tour='goals']",
  },
  {
    icon: Camera,
    title: "Snapshots",
    description: "Capture net worth at any point. Build a wealth history.",
    href: "/dashboard/snapshots",
    elSelector: "[data-tour-el='snapshots-header']",
    navSelector: "[data-tour='snapshots']",
  },
  {
    icon: Heart,
    title: "Health",
    description: "Financial health score \u2014 savings, debt & diversity.",
    href: "/dashboard/health",
    elSelector: "[data-tour-el='health-header']",
    navSelector: "[data-tour='health']",
  },
  {
    icon: Users,
    title: "Profiles",
    description: "Manage multiple profiles \u2014 personal, family or business.",
    href: "/dashboard/profiles",
    elSelector: "[data-tour-el='profiles-header']",
    navSelector: "[data-tour='profiles']",
  },
  {
    icon: Settings,
    title: "Settings",
    description: "Currency, theme, export data, PIN lock & preferences.",
    href: "/dashboard/settings",
    elSelector: "[data-tour-el='settings-header']",
    navSelector: "[data-tour='settings']",
  },
  {
    icon: BookOpen,
    title: "Blog",
    description: "Articles on personal finance, investing tips & budgeting.",
    navSelector: "[data-tour='blog']",
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

  useEffect(() => {
    try {
      if (!localStorage.getItem(TOUR_SEEN_KEY)) {
        const t = setTimeout(() => setOpen(true), 800)
        return () => clearTimeout(t)
      }
    } catch {}
  }, [])

  return { open, startTour, closeTour }
}

// ── helpers ──

function findVisible(selector: string): Element | null {
  for (const sel of selector.split(",").map((s) => s.trim())) {
    try {
      const el = document.querySelector(sel)
      if (el) {
        const r = el.getBoundingClientRect()
        if (r.width > 0 && r.height > 0) return el
      }
    } catch {}
  }
  return null
}

type Spot = { x: number; y: number; w: number; h: number; rx: number }

function SpotlightOverlay({ spots }: { spots: Spot[] }) {
  if (spots.length === 0) return null
  return (
    <svg
      className="fixed inset-0 z-99 pointer-events-none"
      style={{ position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh" }}
    >
      <defs>
        <mask id="tour-mask">
          <rect width="100%" height="100%" fill="white" />
          {spots.map((s, i) => (
            <rect key={i} x={s.x} y={s.y} width={s.w} height={s.h} rx={s.rx} fill="black" />
          ))}
        </mask>
      </defs>
      <rect width="100%" height="100%" fill="rgba(0,0,0,0.55)" mask="url(#tour-mask)" />
      {spots.map((s, i) => (
        <rect
          key={`b-${i}`}
          x={s.x} y={s.y} width={s.w} height={s.h} rx={s.rx}
          fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="2"
        />
      ))}
    </svg>
  )
}

// ── Card positioned next to the target element ──

function TourCard({
  step,
  total,
  current,
  isFirst,
  isLast,
  onNext,
  onPrev,
  onClose,
  targetRect,
  onTouchStart,
  onTouchEnd,
}: {
  step: number
  total: number
  current: TourStep
  isFirst: boolean
  isLast: boolean
  onNext: () => void
  onPrev: () => void
  onClose: () => void
  targetRect: DOMRect | null
  onTouchStart: (e: React.TouchEvent) => void
  onTouchEnd: (e: React.TouchEvent) => void
}) {
  const Icon = current.icon
  const cardRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ top?: number; left?: number; right?: number; bottom?: number; transform?: string }>({})
  const hasTarget = !!targetRect

  // Position the card near the target element
  useEffect(() => {
    if (!targetRect || !cardRef.current) {
      setPos({})
      return
    }

    const card = cardRef.current.getBoundingClientRect()
    const vw = window.innerWidth
    const vh = window.innerHeight
    const cardW = Math.min(card.width || 280, 280)
    const cardH = card.height || 200
    const gap = 12

    // On mobile (< 640px), always show at bottom as a sheet
    if (vw < 640) {
      setPos({})
      return
    }

    // Try below the target element
    if (targetRect.bottom + gap + cardH < vh) {
      // Below, aligned to right edge of target (or left if not enough room)
      let left = targetRect.right - cardW
      if (left < 8) left = targetRect.left
      if (left + cardW > vw - 8) left = vw - cardW - 8
      setPos({ top: targetRect.bottom + gap, left })
      return
    }

    // Try above
    if (targetRect.top - gap - cardH > 0) {
      let left = targetRect.right - cardW
      if (left < 8) left = targetRect.left
      if (left + cardW > vw - 8) left = vw - cardW - 8
      setPos({ top: targetRect.top - gap - cardH, left })
      return
    }

    // Fallback: right side
    const top = Math.max(8, Math.min(targetRect.top, vh - cardH - 8))
    if (targetRect.right + gap + cardW < vw) {
      setPos({ top, left: targetRect.right + gap })
    } else {
      // Left side
      setPos({ top, left: Math.max(8, targetRect.left - gap - cardW) })
    }
  }, [targetRect])

  const isPositioned = hasTarget && pos.top !== undefined && window.innerWidth >= 640

  return (
    <div
      ref={cardRef}
      className={cn(
        "z-100",
        isPositioned
          ? "fixed w-70"
          : hasTarget
            ? "fixed bottom-0 left-0 right-0"
            : "fixed bottom-0 left-0 right-0 sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-80"
      )}
      style={isPositioned ? { top: pos.top, left: pos.left } : undefined}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <div className={cn("relative overflow-hidden", isPositioned ? "rounded-2xl" : "rounded-t-2xl sm:rounded-2xl")}>
        <div className="h-0.5 w-full bg-[#1d1d1f] dark:bg-white/80" />
        <div className={cn(
          "liquid-glass backdrop-blur-2xl border-t-0 p-3 sm:p-3.5",
          isPositioned ? "rounded-t-[calc(var(--radius)-1px)]!" : "rounded-t-none! sm:rounded-t-[calc(var(--radius)-1px)]!",
          !isPositioned && "pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:pb-3.5"
        )}>
          {/* Counter + close */}
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-semibold tracking-widest uppercase text-[#86868b] dark:text-[#636366]">
              {step + 1} / {total}
            </span>
            <button
              onClick={onClose}
              className="p-1 -mr-1 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
              aria-label="Close tour"
            >
              <X className="w-3.5 h-3.5 text-[#86868b]" strokeWidth={2.5} />
            </button>
          </div>

          {/* Icon + Title */}
          <div className="flex items-center gap-2 mb-1">
            <div className="w-7 h-7 rounded-lg bg-[#1d1d1f] dark:bg-white flex items-center justify-center shrink-0">
              <Icon className="w-3.5 h-3.5 text-white dark:text-[#1d1d1f]" strokeWidth={2} />
            </div>
            <h2 className="text-sm font-bold tracking-tight text-[#1d1d1f] dark:text-white leading-tight">
              {current.title}
            </h2>
          </div>

          {/* Description */}
          <p className="text-[11px] leading-normal text-[#6e6e73] dark:text-[#aeaeb2] mb-2.5">
            {current.description}
          </p>

          {/* Progress bar */}
          <div className="h-0.5 w-full bg-black/6 dark:bg-white/6 rounded-full mb-2.5 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500 ease-out bg-[#1d1d1f] dark:bg-white"
              style={{ width: `${((step + 1) / total) * 100}%` }}
            />
          </div>

          {/* Buttons */}
          <div className="flex items-center justify-between">
            {isFirst ? (
              <button onClick={onClose} className="text-[11px] font-medium text-[#aeaeb2] hover:text-[#1d1d1f] dark:hover:text-white transition-colors py-0.5">
                Skip
              </button>
            ) : (
              <button onClick={onPrev} className="flex items-center gap-0.5 text-[11px] font-medium text-[#aeaeb2] hover:text-[#1d1d1f] dark:hover:text-white transition-colors py-0.5">
                <ChevronLeft className="w-3 h-3" /> Back
              </button>
            )}
            <button
              onClick={isLast ? onClose : onNext}
              className="flex items-center gap-0.5 text-[11px] font-semibold px-3.5 py-1.5 rounded-full shadow-sm transition-all active:scale-95 bg-[#1d1d1f] dark:bg-white text-white dark:text-[#1d1d1f]"
            >
              {isLast ? "Get Started" : "Next"}
              {!isLast && <ChevronRight className="w-3 h-3" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main ──

export function FeatureTour({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const [step, setStep] = useState(0)
  const [spots, setSpots] = useState<Spot[]>([])
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null)
  const router = useRouter()
  const pathname = usePathname()
  const touchStart = useRef<number | null>(null)
  const highlightedRef = useRef<Element[]>([])

  useEffect(() => {
    if (open) setStep(0)
  }, [open])

  // Navigate to page on step change
  useEffect(() => {
    if (!open) return
    const s = tourSteps[step]
    if (s.href && s.href !== pathname) {
      router.push(s.href)
    }
  }, [step, open, router, pathname])

  // Find elements, scroll, measure
  useEffect(() => {
    if (!open) {
      setSpots([])
      setTargetRect(null)
      return
    }

    const s = tourSteps[step]
    const pad = 8

    // Cleanup previous
    for (const el of highlightedRef.current) el.classList.remove("tour-highlight")
    highlightedRef.current = []

    if (!s.navSelector && !s.elSelector) {
      setSpots([])
      setTargetRect(null)
      return
    }

    // Wait for page to render after navigation
    const timer = setTimeout(() => {
      const newSpots: Spot[] = []
      const highlighted: Element[] = []

      // 1) Nav element — only spotlight if it's actually visible (not inside More sheet)
      if (s.navSelector) {
        const isMobile = window.innerWidth < 1024
        const navEl = findVisible(s.navSelector)
        // On mobile, skip nav spotlight if the element is inside the More sheet (not in bottom bar)
        const isInMoreSheet = navEl?.closest("[class*='translate-y']") !== null
        if (navEl && !(isMobile && isInMoreSheet)) {
          navEl.classList.add("tour-highlight")
          highlighted.push(navEl)
          const r = navEl.getBoundingClientRect()
          newSpots.push({
            x: r.left - pad, y: r.top - pad,
            w: r.width + pad * 2, h: r.height + pad * 2,
            rx: 12,
          })
        }
      }

      // 2) Page element — scroll into view, then measure
      if (s.elSelector) {
        const el = findVisible(s.elSelector)
        if (el) {
          el.classList.add("tour-highlight")
          highlighted.push(el)

          // Scroll the exact element into view, clearing the sticky header via scroll-margin-top
          el.scrollIntoView({ behavior: "smooth", block: "start" })

          // Measure after scroll settles
          setTimeout(() => {
            const r = el.getBoundingClientRect()
            newSpots.push({
              x: r.left - pad, y: r.top - pad,
              w: r.width + pad * 2, h: r.height + pad * 2,
              rx: 16,
            })
            highlightedRef.current = highlighted
            setSpots([...newSpots])
            setTargetRect(r)
          }, 350)
          return
        }
      }

      highlightedRef.current = highlighted
      setSpots(newSpots)
      setTargetRect(null)
    }, 300)

    return () => {
      clearTimeout(timer)
      for (const el of highlightedRef.current) el.classList.remove("tour-highlight")
      highlightedRef.current = []
    }
  }, [step, open, pathname])

  // Update rect on scroll/resize
  useEffect(() => {
    if (!open) return
    const s = tourSteps[step]
    if (!s.elSelector) return

    function refresh() {
      if (!s.elSelector) return
      const el = findVisible(s.elSelector)
      if (el) setTargetRect(el.getBoundingClientRect())
    }

    window.addEventListener("scroll", refresh, true)
    window.addEventListener("resize", refresh)
    return () => {
      window.removeEventListener("scroll", refresh, true)
      window.removeEventListener("resize", refresh)
    }
  }, [step, open])

  const goNext = useCallback(() => setStep((s) => Math.min(s + 1, tourSteps.length - 1)), [])
  const goPrev = useCallback(() => setStep((s) => Math.max(s - 1, 0)), [])

  useEffect(() => {
    if (!open) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight" || e.key === "ArrowDown") goNext()
      else if (e.key === "ArrowLeft" || e.key === "ArrowUp") goPrev()
      else if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", handleKey)
    return () => window.removeEventListener("keydown", handleKey)
  }, [open, onClose, goNext, goPrev])

  function onTouchStart(e: React.TouchEvent) {
    touchStart.current = e.touches[0].clientX
  }
  function onTouchEnd(e: React.TouchEvent) {
    if (touchStart.current === null) return
    const diff = e.changedTouches[0].clientX - touchStart.current
    if (Math.abs(diff) > 50) diff < 0 ? goNext() : goPrev()
    touchStart.current = null
  }

  if (!open) return null

  const current = tourSteps[step]
  const hasSpotlight = !!(current.navSelector || current.elSelector)

  return (
    <>
      <SpotlightOverlay spots={spots} />

      {/* Click-catcher / backdrop */}
      {!hasSpotlight ? (
        <div className="fixed inset-0 z-99 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      ) : (
        <div className="fixed inset-0 z-98" onClick={onClose} />
      )}

      <TourCard
        step={step}
        total={tourSteps.length}
        current={current}
        isFirst={step === 0}
        isLast={step === tourSteps.length - 1}
        onNext={goNext}
        onPrev={goPrev}
        onClose={onClose}
        targetRect={targetRect}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      />
    </>
  )
}
