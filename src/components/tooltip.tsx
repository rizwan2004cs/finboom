"use client"

import {
  cloneElement,
  isValidElement,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type FocusEvent as ReactFocusEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactElement,
  type ReactNode,
  type Ref,
} from "react"
import { createPortal } from "react-dom"

type TooltipSide = "top" | "bottom" | "left" | "right"

interface TooltipProps {
  /** Text shown after a short hover/focus delay. If empty, children render unchanged. */
  label: ReactNode
  /** A single focusable element (button, link, etc.) that triggers the tooltip. */
  children: ReactNode
  side?: TooltipSide
  /** Delay before the tooltip appears, in ms. */
  delay?: number
}

interface TriggerProps {
  ref?: Ref<HTMLElement>
  onMouseEnter?: (e: ReactMouseEvent) => void
  onMouseLeave?: (e: ReactMouseEvent) => void
  onFocus?: (e: ReactFocusEvent) => void
  onBlur?: (e: ReactFocusEvent) => void
}

const TRANSLATE: Record<TooltipSide, string> = {
  top: "translate(-50%, -100%)",
  bottom: "translate(-50%, 0)",
  left: "translate(-100%, -50%)",
  right: "translate(0, -50%)",
}

/**
 * Lightweight, dependency-free tooltip. Appears on hover (after `delay`) and on
 * keyboard focus. Handlers and the measuring ref are attached directly to the
 * single child element, and the bubble renders into a portal with fixed
 * positioning so it is never clipped by `overflow` containers (sidebars,
 * scroll areas, cards).
 */
export function Tooltip({ label, children, side = "top", delay = 450 }: Readonly<TooltipProps>) {
  const [open, setOpen] = useState(false)
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null)
  const triggerRef = useRef<HTMLElement | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const tooltipId = useId()

  const computePosition = useCallback(() => {
    const el = triggerRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const gap = 8
    const positions: Record<TooltipSide, { top: number; left: number }> = {
      top: { top: r.top - gap, left: r.left + r.width / 2 },
      bottom: { top: r.bottom + gap, left: r.left + r.width / 2 },
      left: { top: r.top + r.height / 2, left: r.left - gap },
      right: { top: r.top + r.height / 2, left: r.right + gap },
    }
    setCoords(positions[side])
  }, [side])

  const show = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      computePosition()
      setOpen(true)
    }, delay)
  }, [computePosition, delay])

  const hide = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    setOpen(false)
  }, [])

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current) }, [])

  // Dismiss on scroll/resize so the bubble never floats at a stale position.
  useEffect(() => {
    if (!open) return
    window.addEventListener("scroll", hide, true)
    window.addEventListener("resize", hide)
    return () => {
      window.removeEventListener("scroll", hide, true)
      window.removeEventListener("resize", hide)
    }
  }, [open, hide])

  const setRef = useCallback((node: HTMLElement | null) => {
    triggerRef.current = node
  }, [])

  if (!label || !isValidElement(children)) return <>{children}</>

  const child = children as ReactElement<TriggerProps>
  const childProps = child.props

  const trigger = cloneElement(child, {
    ref: setRef,
    onMouseEnter: (e: ReactMouseEvent) => { childProps.onMouseEnter?.(e); show() },
    onMouseLeave: (e: ReactMouseEvent) => { childProps.onMouseLeave?.(e); hide() },
    onFocus: (e: ReactFocusEvent) => { childProps.onFocus?.(e); show() },
    onBlur: (e: ReactFocusEvent) => { childProps.onBlur?.(e); hide() },
  } satisfies TriggerProps)

  return (
    <>
      {trigger}
      {open && coords && typeof document !== "undefined" &&
        createPortal(
          <span
            id={tooltipId}
            role="tooltip"
            style={{ position: "fixed", top: coords.top, left: coords.left, transform: TRANSLATE[side] }}
            className="tooltip-pop pointer-events-none z-[100] max-w-xs whitespace-nowrap rounded-lg border border-white/10 bg-[#1d1d1f]/95 px-2.5 py-1.5 text-xs font-medium text-white shadow-lg shadow-black/25 backdrop-blur-sm dark:bg-[#3a3a3c]/95"
          >
            {label}
          </span>,
          document.body
        )}
    </>
  )
}
