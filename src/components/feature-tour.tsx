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
  // Specific element inside the page to spotlight (desktop)
  elSelector?: string
  // Sidebar nav link to spotlight when no page element (desktop)
  navSelector?: string
}

const tourSteps: TourStep[] = [
  {
    icon: Sparkles,
    title: "Welcome to FinBoom!",
    description: "Your personal finance tracker. Let\u2019s take a quick tour of everything you can do.",
  },
  {
    icon: LayoutDashboard,
    title: "Dashboard",
    description: "Net worth, assets, liabilities & spending charts at a glance.",
    href: "/dashboard",
    elSelector: "[data-tour-el='dashboard-summary']",
    navSelector: "[data-tour='dashboard']",
  },
  {
    icon: Wallet,
    title: "Assets",
    description: "Track stocks, mutual funds, real estate, gold & crypto.",
    href: "/dashboard/assets",
    elSelector: "[data-tour-el='assets-header']",
    navSelector: "[data-tour='assets']",
  },
  {
    icon: CreditCard,
    title: "Liabilities",
    description: "Monitor loans & credit cards. Track EMIs & balances.",
    href: "/dashboard/liabilities",
    elSelector: "[data-tour-el='liabilities-header']",
    navSelector: "[data-tour='liabilities']",
  },
  {
    icon: ArrowUpDown,
    title: "Transactions",
    description: "Log income & expenses. Categorize & filter them easily.",
    href: "/dashboard/transactions",
    elSelector: "[data-tour-el='transactions-header']",
    navSelector: "[data-tour='transactions']",
  },
  {
    icon: PiggyBank,
    title: "Budget",
    description: "Set monthly budgets by category & track your limits.",
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
    description: "Set financial goals & watch your progress grow.",
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
    description: "Your financial health score \u2014 savings, debt & diversity.",
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
    description: "Currency, theme, data export & all your preferences.",
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
const SPOT_PAD = 8

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

// ────────────────────────────── hooks ──────────────────────────────

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState<boolean>(() =>
    typeof window !== "undefined" ? window.matchMedia(query).matches : false
  )
  useEffect(() => {
    const mq = window.matchMedia(query)
    const onChange = () => setMatches(mq.matches)
    onChange()
    mq.addEventListener("change", onChange)
    return () => mq.removeEventListener("change", onChange)
  }, [query])
  return matches
}

function usePrefersReducedMotion() {
  return useMediaQuery("(prefers-reduced-motion: reduce)")
}

function useLockBodyScroll(active: boolean) {
  useEffect(() => {
    if (!active) return
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = prev
    }
  }, [active])
}

// Move focus into a container, trap Tab inside it, restore focus on unmount.
function useFocusTrap(ref: React.RefObject<HTMLElement | null>, active: boolean) {
  useEffect(() => {
    if (!active) return
    const node = ref.current
    if (!node) return
    const previouslyFocused = document.activeElement as HTMLElement | null

    const getFocusable = () =>
      Array.from(
        node.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
      ).filter((el) => !el.hasAttribute("disabled") && el.offsetParent !== null)

    const focusables = getFocusable()
    ;(focusables[0] ?? node).focus({ preventScroll: true })

    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Tab") return
      const list = getFocusable()
      if (list.length === 0) {
        e.preventDefault()
        return
      }
      const first = list[0]
      const last = list[list.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }

    node.addEventListener("keydown", onKeyDown)
    return () => {
      node.removeEventListener("keydown", onKeyDown)
      previouslyFocused?.focus?.({ preventScroll: true })
    }
  }, [ref, active])
}

// ────────────────────────────── helpers ──────────────────────────────

type Rect = { top: number; left: number; width: number; height: number }

function findVisible(selector: string): HTMLElement | null {
  for (const sel of selector.split(",").map((s) => s.trim())) {
    if (!sel) continue
    try {
      const el = document.querySelector<HTMLElement>(sel)
      if (el) {
        const r = el.getBoundingClientRect()
        if (r.width > 0 && r.height > 0) return el
      }
    } catch {}
  }
  return null
}

function rectFrom(el: Element): Rect {
  const r = el.getBoundingClientRect()
  return { top: r.top, left: r.left, width: r.width, height: r.height }
}

function rectChanged(a: Rect | null, b: Rect | null): boolean {
  if (!a || !b) return a !== b
  return (
    Math.abs(a.top - b.top) > 0.5 ||
    Math.abs(a.left - b.left) > 0.5 ||
    Math.abs(a.width - b.width) > 0.5 ||
    Math.abs(a.height - b.height) > 0.5
  )
}

// ────────────────────────────── entry ──────────────────────────────

export function FeatureTour({
  open,
  onClose,
  navigate = true,
}: {
  open: boolean
  onClose: () => void
  // When false, the desktop tour spotlights on-page targets without routing
  // (used by the standalone /tour-preview page).
  navigate?: boolean
}) {
  // Below the `lg` breakpoint the desktop sidebar is hidden, so the spotlight
  // tour has nothing to point at — use the dedicated mobile experience instead.
  const isMobile = useMediaQuery("(max-width: 1023px)")

  if (!open) return null
  return isMobile ? (
    <MobileTour onClose={onClose} />
  ) : (
    <DesktopTour onClose={onClose} navigate={navigate} />
  )
}

// ────────────────────────── desktop spotlight ──────────────────────────

function DesktopTour({ onClose, navigate }: { onClose: () => void; navigate: boolean }) {
  const [step, setStep] = useState(0)
  const [target, setTarget] = useState<Rect | null>(null)
  const router = useRouter()
  const pathname = usePathname()
  const reducedMotion = usePrefersReducedMotion()
  const tokenRef = useRef(0)
  const lastRectRef = useRef<Rect | null>(null)

  const total = tourSteps.length
  const current = tourSteps[step]
  const isLast = step === total - 1

  const goNext = useCallback(() => setStep((s) => Math.min(s + 1, total - 1)), [total])
  const goPrev = useCallback(() => setStep((s) => Math.max(s - 1, 0)), [])

  // Navigate to the step's route, then locate + spotlight its target. No fixed
  // timers: a rAF loop resolves as soon as the element is mounted & laid out.
  useEffect(() => {
    if (navigate && current.href && current.href !== pathname) {
      router.push(current.href)
      return // re-runs once pathname matches
    }

    const token = ++tokenRef.current
    let raf = 0

    const sel = current.elSelector ?? current.navSelector
    if (!sel) {
      lastRectRef.current = null
      // Defer out of the effect body (welcome step → centered card, no spotlight)
      raf = requestAnimationFrame(() => {
        if (token === tokenRef.current) setTarget(null)
      })
      return () => {
        if (raf) cancelAnimationFrame(raf)
      }
    }

    const startedAt = performance.now()

    const locate = () => {
      if (token !== tokenRef.current) return
      const el = findVisible(sel)
      if (el) {
        el.scrollIntoView({
          behavior: reducedMotion ? "auto" : "smooth",
          block: "center",
          inline: "nearest",
        })
        const rect = rectFrom(el)
        lastRectRef.current = rect
        setTarget(rect)
        return // scroll/resize effect keeps it synced as the smooth scroll settles
      }
      if (performance.now() - startedAt > 1500) {
        lastRectRef.current = null
        setTarget(null) // give up → centered card, no spotlight
        return
      }
      raf = requestAnimationFrame(locate)
    }

    raf = requestAnimationFrame(locate)
    return () => {
      if (raf) cancelAnimationFrame(raf)
    }
  }, [step, pathname, current, router, reducedMotion, navigate])

  // Keep the spotlight glued to the target during scroll / resize / the
  // programmatic smooth-scroll. rAF-batched + passive so it never janks.
  useEffect(() => {
    const sel = current.elSelector ?? current.navSelector
    if (!sel) return
    let raf = 0
    const update = () => {
      raf = 0
      const el = findVisible(sel)
      if (!el) return
      const rect = rectFrom(el)
      if (rectChanged(lastRectRef.current, rect)) {
        lastRectRef.current = rect
        setTarget(rect)
      }
    }
    const onEvent = () => {
      if (!raf) raf = requestAnimationFrame(update)
    }
    window.addEventListener("scroll", onEvent, { passive: true, capture: true })
    window.addEventListener("resize", onEvent, { passive: true })
    return () => {
      if (raf) cancelAnimationFrame(raf)
      window.removeEventListener("scroll", onEvent, true)
      window.removeEventListener("resize", onEvent)
    }
  }, [step, current])

  // Keyboard navigation
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight" || e.key === "ArrowDown") goNext()
      else if (e.key === "ArrowLeft" || e.key === "ArrowUp") goPrev()
      else if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [goNext, goPrev, onClose])

  const spot: Rect | null = target
    ? {
        top: target.top - SPOT_PAD,
        left: target.left - SPOT_PAD,
        width: target.width + SPOT_PAD * 2,
        height: target.height + SPOT_PAD * 2,
      }
    : null

  return (
    <>
      {/* Dimming scrim + morphing spotlight cutout (single element) */}
      {spot ? (
        <div
          aria-hidden
          className={cn(
            "fixed z-[200] rounded-[14px] pointer-events-none tour-spot",
            !reducedMotion && "tour-spot-anim"
          )}
          style={{
            top: spot.top,
            left: spot.left,
            width: spot.width,
            height: spot.height,
            boxShadow: "0 0 0 9999px rgba(0,0,0,0.55)",
            transition: reducedMotion
              ? undefined
              : "top .3s cubic-bezier(.4,0,.2,1), left .3s cubic-bezier(.4,0,.2,1), width .3s cubic-bezier(.4,0,.2,1), height .3s cubic-bezier(.4,0,.2,1)",
          }}
        />
      ) : (
        <div aria-hidden className="fixed inset-0 z-[200] bg-black/55" />
      )}

      {/* Catch clicks so the dimmed page can't be interacted with mid-tour */}
      <div className="fixed inset-0 z-[201]" aria-hidden onClick={(e) => e.stopPropagation()} />

      <DesktopCard
        step={step}
        total={total}
        current={current}
        isLast={isLast}
        target={target}
        reducedMotion={reducedMotion}
        onNext={goNext}
        onPrev={goPrev}
        onClose={onClose}
      />
    </>
  )
}

function DesktopCard({
  step,
  total,
  current,
  isLast,
  target,
  reducedMotion,
  onNext,
  onPrev,
  onClose,
}: {
  step: number
  total: number
  current: TourStep
  isLast: boolean
  target: Rect | null
  reducedMotion: boolean
  onNext: () => void
  onPrev: () => void
  onClose: () => void
}) {
  const Icon = current.icon
  const cardRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  useFocusTrap(cardRef, true)

  // Position the card next to the target (or centered when there's none).
  useEffect(() => {
    const node = cardRef.current
    if (!node) return
    const card = node.getBoundingClientRect()
    const vw = window.innerWidth
    const vh = window.innerHeight
    const cardW = card.width || 320
    const cardH = card.height || 200
    const gap = 14
    const margin = 12

    if (!target) {
      setPos({ top: Math.max(margin, (vh - cardH) / 2), left: Math.max(margin, (vw - cardW) / 2) })
      return
    }

    let top: number
    if (target.top + target.height + gap + cardH <= vh - margin) {
      top = target.top + target.height + gap
    } else if (target.top - gap - cardH >= margin) {
      top = target.top - gap - cardH
    } else {
      top = Math.min(Math.max(margin, target.top), vh - cardH - margin)
    }

    let left = target.left + target.width / 2 - cardW / 2
    left = Math.min(Math.max(margin, left), vw - cardW - margin)
    setPos({ top, left })
  }, [target, step])

  return (
    <div
      ref={cardRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="tour-card-title"
      aria-describedby="tour-card-desc"
      tabIndex={-1}
      className={cn(
        "fixed z-[210] w-[320px] max-w-[calc(100vw-24px)] outline-none",
        pos ? "opacity-100" : "opacity-0",
        !reducedMotion && "transition-[top,left,opacity] duration-300 ease-out"
      )}
      style={pos ? { top: pos.top, left: pos.left } : { top: 0, left: 0 }}
    >
      <div className="liquid-glass backdrop-blur-2xl rounded-2xl p-4 shadow-xl shadow-black/10">
        {/* Counter + close */}
        <div className="flex items-center justify-between mb-2.5">
          <span className="text-[10px] font-semibold tracking-widest uppercase text-[#86868b] dark:text-[#636366]">
            {step + 1} / {total}
          </span>
          <button
            onClick={onClose}
            className="p-1.5 -mr-1 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
            aria-label="Close tour"
          >
            <X className="w-4 h-4 text-[#86868b]" strokeWidth={2.5} />
          </button>
        </div>

        {/* Icon + title */}
        <div className="flex items-center gap-2.5 mb-1.5">
          <div className="w-8 h-8 rounded-xl bg-[#1d1d1f] dark:bg-white flex items-center justify-center shrink-0">
            <Icon className="w-4 h-4 text-white dark:text-[#1d1d1f]" strokeWidth={2} />
          </div>
          <h2
            id="tour-card-title"
            className="text-[15px] font-bold tracking-tight text-[#1d1d1f] dark:text-white leading-tight"
          >
            {current.title}
          </h2>
        </div>

        <p
          id="tour-card-desc"
          className="text-[12px] leading-relaxed text-[#6e6e73] dark:text-[#aeaeb2] mb-3"
        >
          {current.description}
        </p>

        {/* Progress */}
        <div className="h-1 w-full bg-black/[0.06] dark:bg-white/[0.08] rounded-full mb-3 overflow-hidden">
          <div
            className="h-full rounded-full bg-[#1d1d1f] dark:bg-white transition-all duration-500 ease-out"
            style={{ width: `${((step + 1) / total) * 100}%` }}
          />
        </div>

        {/* Controls */}
        <div className="flex items-center justify-between gap-2">
          {step === 0 ? (
            <button
              onClick={onClose}
              className="text-[12px] font-medium text-[#aeaeb2] hover:text-[#1d1d1f] dark:hover:text-white transition-colors px-2 py-2"
            >
              Skip
            </button>
          ) : (
            <button
              onClick={onPrev}
              className="flex items-center gap-1 text-[12px] font-medium text-[#86868b] hover:text-[#1d1d1f] dark:hover:text-white transition-colors px-2 py-2"
            >
              <ChevronLeft className="w-3.5 h-3.5" /> Back
            </button>
          )}
          <button
            onClick={isLast ? onClose : onNext}
            className="flex items-center gap-1 text-[12px] font-semibold px-4 py-2 rounded-full shadow-sm transition-all active:scale-95 bg-[#1d1d1f] dark:bg-white text-white dark:text-[#1d1d1f]"
          >
            {isLast ? "Get Started" : "Next"}
            {!isLast && <ChevronRight className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────── dedicated mobile tour ───────────────────────
// Full-screen, swipeable onboarding carousel — the pattern native apps use.

function MobileTour({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(0)
  const [drag, setDrag] = useState(0)
  const [dragging, setDragging] = useState(false)
  const reducedMotion = usePrefersReducedMotion()
  const panelRef = useRef<HTMLDivElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const startX = useRef(0)
  const startY = useRef(0)
  const axis = useRef<null | "x" | "y">(null)

  const total = tourSteps.length
  const isLast = step === total - 1

  useLockBodyScroll(true)
  useFocusTrap(panelRef, true)

  const goNext = useCallback(() => setStep((s) => Math.min(s + 1, total - 1)), [total])
  const goPrev = useCallback(() => setStep((s) => Math.max(s - 1, 0)), [])
  const goTo = useCallback((i: number) => setStep(i), [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose()
      else if (e.key === "ArrowRight") goNext()
      else if (e.key === "ArrowLeft") goPrev()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose, goNext, goPrev])

  function onTouchStart(e: React.TouchEvent) {
    startX.current = e.touches[0].clientX
    startY.current = e.touches[0].clientY
    axis.current = null
    setDragging(true)
  }
  function onTouchMove(e: React.TouchEvent) {
    const dx = e.touches[0].clientX - startX.current
    const dy = e.touches[0].clientY - startY.current
    if (axis.current === null && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) {
      axis.current = Math.abs(dx) > Math.abs(dy) ? "x" : "y"
    }
    if (axis.current === "x") {
      // Rubber-band at the ends
      let d = dx
      if ((step === 0 && d > 0) || (isLast && d < 0)) d *= 0.3
      setDrag(d)
    }
  }
  function onTouchEnd() {
    setDragging(false)
    const width = trackRef.current?.offsetWidth || window.innerWidth
    const threshold = Math.min(72, width * 0.22)
    if (axis.current === "x") {
      if (drag <= -threshold) goNext()
      else if (drag >= threshold) goPrev()
    }
    setDrag(0)
    axis.current = null
  }

  const trackStyle: React.CSSProperties = {
    transform: `translate3d(calc(${(-step * 100) / total}% + ${drag}px), 0, 0)`,
    width: `${total * 100}%`,
    transition: dragging || reducedMotion ? "none" : "transform .35s cubic-bezier(.22,1,.36,1)",
  }

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-modal="true"
      aria-label="App tour"
      tabIndex={-1}
      className="fixed inset-0 z-[200] flex flex-col outline-none bg-gradient-to-br from-[#e8eaf0] via-[#f0eef5] to-[#eaf4f0] dark:from-[#0a0a0a] dark:via-[#111113] dark:to-[#0d0d0f]"
      style={{
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      {/* Top bar */}
      <div className="flex items-center justify-between h-12 px-5 shrink-0">
        <span className="text-[15px] font-semibold tracking-[-0.3px] text-[#1d1d1f] dark:text-white">
          FinBoom
        </span>
        {!isLast && (
          <button
            onClick={onClose}
            className="text-[13px] font-medium text-[#86868b] hover:text-[#1d1d1f] dark:hover:text-white px-3 py-2 -mr-2"
          >
            Skip
          </button>
        )}
      </div>

      {/* Swipeable slides */}
      <div
        className="flex-1 overflow-hidden"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <div ref={trackRef} className="flex h-full" style={trackStyle}>
          {tourSteps.map((s, i) => {
            const Icon = s.icon
            return (
              <div
                key={s.title}
                aria-hidden={i !== step}
                className="h-full shrink-0 flex flex-col items-center justify-center px-10 text-center select-none"
                style={{ width: `${100 / total}%` }}
              >
                <div className="w-20 h-20 rounded-[1.75rem] liquid-glass backdrop-blur-2xl flex items-center justify-center mb-7 shadow-lg shadow-black/5">
                  <Icon className="w-9 h-9 text-[#1d1d1f] dark:text-white" strokeWidth={1.5} />
                </div>
                <span className="text-[11px] font-semibold tracking-widest uppercase text-[#86868b] dark:text-[#636366] mb-3">
                  {i + 1} / {total}
                </span>
                <h2 className="text-[26px] font-bold tracking-tight text-[#1d1d1f] dark:text-white leading-tight mb-3">
                  {s.title}
                </h2>
                <p className="text-[15px] leading-relaxed text-[#6e6e73] dark:text-[#aeaeb2] max-w-[300px]">
                  {s.description}
                </p>
              </div>
            )
          })}
        </div>
      </div>

      {/* Controls */}
      <div className="shrink-0 px-6 pb-3 pt-2">
        {/* Step dots */}
        <div className="flex justify-center items-center gap-1.5 mb-6">
          {tourSteps.map((s, i) => (
            <button
              key={s.title}
              onClick={() => goTo(i)}
              aria-label={`Go to step ${i + 1}`}
              aria-current={i === step}
              className={cn(
                "h-1.5 rounded-full transition-all duration-300",
                i === step ? "w-7 bg-[#1d1d1f] dark:bg-white" : "w-1.5 bg-black/15 dark:bg-white/20"
              )}
            />
          ))}
        </div>

        <div className="flex items-center gap-3">
          {step > 0 && (
            <button
              onClick={goPrev}
              className="flex-1 h-12 rounded-2xl border border-black/10 dark:border-white/15 text-[15px] font-medium text-[#1d1d1f] dark:text-white flex items-center justify-center active:scale-[0.98] transition-transform"
            >
              Back
            </button>
          )}
          <button
            onClick={isLast ? onClose : goNext}
            className={cn(
              "h-12 rounded-2xl bg-[#1d1d1f] dark:bg-white text-white dark:text-[#1d1d1f] text-[15px] font-semibold flex items-center justify-center active:scale-[0.98] transition-transform",
              step > 0 ? "flex-[1.6]" : "flex-1"
            )}
          >
            {isLast ? "Get Started" : "Next"}
          </button>
        </div>
      </div>
    </div>
  )
}
