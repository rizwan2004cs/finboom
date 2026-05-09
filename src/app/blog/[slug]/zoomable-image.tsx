"use client"

import { useCallback, useEffect, useRef, useState } from "react"

export function ZoomableImage({
  src,
  alt,
  htmlContent,
  children,
}: {
  src?: string
  alt?: string
  htmlContent?: string
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [scale, setScale] = useState(1)
  const [translate, setTranslate] = useState({ x: 0, y: 0 })
  const lastDistance = useRef<number | null>(null)
  const lastCenter = useRef<{ x: number; y: number } | null>(null)
  const dragging = useRef(false)
  const dragStart = useRef({ x: 0, y: 0 })
  const imgRef = useRef<HTMLImageElement>(null)

  const reset = useCallback(() => {
    setScale(1)
    setTranslate({ x: 0, y: 0 })
    lastDistance.current = null
    lastCenter.current = null
  }, [])

  function handleOpen() {
    reset()
    setOpen(true)
  }

  function handleClose() {
    setOpen(false)
    reset()
  }

  // Lock body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = ""
    }
    return () => { document.body.style.overflow = "" }
  }, [open])

  // Close on Escape
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") handleClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open])

  // Pinch zoom
  function handleTouchMove(e: React.TouchEvent) {
    if (e.touches.length === 2) {
      e.preventDefault()
      const dx = e.touches[0].clientX - e.touches[1].clientX
      const dy = e.touches[0].clientY - e.touches[1].clientY
      const dist = Math.sqrt(dx * dx + dy * dy)
      const cx = (e.touches[0].clientX + e.touches[1].clientX) / 2
      const cy = (e.touches[0].clientY + e.touches[1].clientY) / 2

      if (lastDistance.current !== null) {
        const delta = dist / lastDistance.current
        setScale((s) => Math.min(5, Math.max(1, s * delta)))
      }
      if (lastCenter.current !== null) {
        setTranslate((t) => ({
          x: t.x + (cx - lastCenter.current!.x),
          y: t.y + (cy - lastCenter.current!.y),
        }))
      }
      lastDistance.current = dist
      lastCenter.current = { x: cx, y: cy }
    } else if (e.touches.length === 1 && scale > 1) {
      // Pan when zoomed
      if (dragging.current) {
        const dx = e.touches[0].clientX - dragStart.current.x
        const dy = e.touches[0].clientY - dragStart.current.y
        dragStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
        setTranslate((t) => ({ x: t.x + dx, y: t.y + dy }))
      }
    }
  }

  function handleTouchStart(e: React.TouchEvent) {
    if (e.touches.length === 1 && scale > 1) {
      dragging.current = true
      dragStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
    }
  }

  function handleTouchEnd() {
    lastDistance.current = null
    lastCenter.current = null
    dragging.current = false
    if (scale <= 1) {
      reset()
    }
  }

  // Double tap to zoom / reset
  const lastTap = useRef(0)
  function handleDoubleTap() {
    const now = Date.now()
    if (now - lastTap.current < 300) {
      if (scale > 1) {
        reset()
      } else {
        setScale(2.5)
      }
    }
    lastTap.current = now
  }

  return (
    <>
      <div onClick={handleOpen} className="cursor-zoom-in">
        {children}
      </div>

      {open && (
        <div
          className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center"
          onClick={(e) => {
            if (e.target === e.currentTarget && scale <= 1) handleClose()
          }}
        >
          {/* Close button */}
          <button
            onClick={handleClose}
            className="absolute top-4 right-4 z-[101] w-10 h-10 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center text-white hover:bg-white/20 transition-colors"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Hint */}
          <p className="absolute bottom-6 left-0 right-0 text-center text-xs text-white/50 pointer-events-none">
            Pinch to zoom · Double tap to toggle
          </p>

          {/* Image or HTML content */}
          {src ? (
            <img
              ref={imgRef}
              src={src}
              alt={alt || ""}
              className="max-w-[95vw] max-h-[85vh] object-contain select-none"
              style={{
                transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale})`,
                transition: dragging.current ? "none" : "transform 0.2s ease-out",
                touchAction: "none",
              }}
              draggable={false}
              onClick={handleDoubleTap}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            />
          ) : htmlContent ? (
            <div
              className="max-w-[95vw] max-h-[85vh] overflow-auto select-none bg-white dark:bg-[#161618] rounded-xl p-4 [&_svg]:mx-auto [&_svg]:max-w-full"
              style={{
                transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale})`,
                transition: dragging.current ? "none" : "transform 0.2s ease-out",
                touchAction: "none",
              }}
              onClick={handleDoubleTap}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              dangerouslySetInnerHTML={{ __html: htmlContent }}
            />
          ) : null}
        </div>
      )}
    </>
  )
}
