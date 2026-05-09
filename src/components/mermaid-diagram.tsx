"use client"

import { useCallback, useEffect, useRef, useState } from "react"

export default function MermaidDiagram({ code, zoomable = false }: { code: string; zoomable?: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [svg, setSvg] = useState("")
  const [error, setError] = useState("")
  const [zoomed, setZoomed] = useState(false)
  const [scale, setScale] = useState(1)
  const [translate, setTranslate] = useState({ x: 0, y: 0 })
  const lastDistance = useRef<number | null>(null)
  const lastCenter = useRef<{ x: number; y: number } | null>(null)
  const dragging = useRef(false)
  const dragStart = useRef({ x: 0, y: 0 })
  const lastTap = useRef(0)

  const reset = useCallback(() => {
    setScale(1)
    setTranslate({ x: 0, y: 0 })
    lastDistance.current = null
    lastCenter.current = null
  }, [])

  useEffect(() => {
    let cancelled = false

    async function render() {
      try {
        const mermaid = (await import("mermaid")).default
        const isDark = document.documentElement.classList.contains("dark")

        mermaid.initialize({
          startOnLoad: false,
          theme: isDark ? "base" : "neutral",
          fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', sans-serif",
          ...(isDark && {
            themeVariables: {
              // Base colors
              background: "#1c1c1e",
              primaryColor: "#48484a",
              primaryBorderColor: "#636366",
              primaryTextColor: "#e5e5ea",
              secondaryColor: "#3a3a3c",
              secondaryBorderColor: "#545456",
              secondaryTextColor: "#e5e5ea",
              tertiaryColor: "#2c2c2e",
              tertiaryBorderColor: "#48484a",
              tertiaryTextColor: "#e5e5ea",
              lineColor: "#636366",
              textColor: "#e5e5ea",
              mainBkg: "#48484a",
              nodeBorder: "#636366",
              // Notes
              noteBkgColor: "#2c2c2e",
              noteTextColor: "#e5e5ea",
              noteBorderColor: "#48484a",
              // Timeline / journey / gantt section colors
              cScale0: "#48484a",
              cScale1: "#545456",
              cScale2: "#636366",
              cScale3: "#48484a",
              cScale4: "#545456",
              cScale5: "#636366",
              cScale6: "#48484a",
              cScale7: "#545456",
              cScale8: "#636366",
              cScale9: "#48484a",
              cScale10: "#545456",
              cScale11: "#636366",
              cScaleLabel0: "#e5e5ea",
              cScaleLabel1: "#e5e5ea",
              cScaleLabel2: "#e5e5ea",
              cScaleLabel3: "#e5e5ea",
              cScaleLabel4: "#e5e5ea",
              cScaleLabel5: "#e5e5ea",
              // Pie
              pie1: "#48484a",
              pie2: "#636366",
              pie3: "#8e8e93",
              pie4: "#545456",
              pie5: "#787880",
              // XY chart
              xyChart: {
                backgroundColor: "transparent",
                titleColor: "#e5e5ea",
                xAxisTitleColor: "#aeaeb2",
                yAxisTitleColor: "#aeaeb2",
                xAxisLabelColor: "#aeaeb2",
                yAxisLabelColor: "#aeaeb2",
                xAxisTickColor: "#48484a",
                yAxisTickColor: "#48484a",
                xAxisLineColor: "#48484a",
                yAxisLineColor: "#48484a",
                plotColorPalette: "#8e8e93,#a1a1a6,#636366,#787880,#aeaeb2",
              },
            },
          }),
        })
        const id = `mermaid-${Math.random().toString(36).slice(2, 9)}`
        const { svg: rendered } = await mermaid.render(id, code)
        if (!cancelled) setSvg(rendered)
      } catch {
        if (!cancelled) setError("Could not render diagram")
      }
    }

    render()
    return () => { cancelled = true }
  }, [code])

  if (error) {
    return (
      <pre className="my-6 p-4 rounded-xl bg-[#f5f5f7] dark:bg-[#1c1c1e] text-sm text-[#86868b] overflow-x-auto">
        {code}
      </pre>
    )
  }

  if (!svg) {
    return (
      <div className="my-6 p-8 rounded-xl border border-black/[0.08] dark:border-white/[0.08] flex items-center justify-center">
        <p className="text-sm text-[#86868b]">Loading diagram...</p>
      </div>
    )
  }

  return (
    <>
      <div
        ref={containerRef}
        className={`my-6 overflow-x-auto rounded-2xl border border-black/[0.06] dark:border-white/[0.06] p-6 bg-[#fafafa] dark:bg-[#161618] shadow-sm [&_svg]:mx-auto [&_svg]:max-w-full ${zoomable ? "cursor-zoom-in" : ""}`}
        dangerouslySetInnerHTML={{ __html: svg }}
        onClick={zoomable ? () => { reset(); setZoomed(true) } : undefined}
      />

      {zoomable && zoomed && (
        <ZoomOverlay
          svg={svg}
          scale={scale}
          setScale={setScale}
          translate={translate}
          setTranslate={setTranslate}
          lastDistance={lastDistance}
          lastCenter={lastCenter}
          dragging={dragging}
          dragStart={dragStart}
          lastTap={lastTap}
          reset={reset}
          onClose={() => { setZoomed(false); reset() }}
        />
      )}
    </>
  )
}

function ZoomOverlay({
  svg,
  scale,
  setScale,
  translate,
  setTranslate,
  lastDistance,
  lastCenter,
  dragging,
  dragStart,
  lastTap,
  reset,
  onClose,
}: {
  svg: string
  scale: number
  setScale: React.Dispatch<React.SetStateAction<number>>
  translate: { x: number; y: number }
  setTranslate: React.Dispatch<React.SetStateAction<{ x: number; y: number }>>
  lastDistance: React.MutableRefObject<number | null>
  lastCenter: React.MutableRefObject<{ x: number; y: number } | null>
  dragging: React.MutableRefObject<boolean>
  dragStart: React.MutableRefObject<{ x: number; y: number }>
  lastTap: React.MutableRefObject<number>
  reset: () => void
  onClose: () => void
}) {
  useEffect(() => {
    document.body.style.overflow = "hidden"
    return () => { document.body.style.overflow = "" }
  }, [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  function handleTouchMove(e: React.TouchEvent) {
    if (e.touches.length === 2) {
      e.preventDefault()
      const dx = e.touches[0].clientX - e.touches[1].clientX
      const dy = e.touches[0].clientY - e.touches[1].clientY
      const dist = Math.sqrt(dx * dx + dy * dy)
      const cx = (e.touches[0].clientX + e.touches[1].clientX) / 2
      const cy = (e.touches[0].clientY + e.touches[1].clientY) / 2
      if (lastDistance.current !== null) {
        setScale((s) => Math.min(5, Math.max(1, s * (dist / lastDistance.current!))))
      }
      if (lastCenter.current !== null) {
        setTranslate((t) => ({ x: t.x + (cx - lastCenter.current!.x), y: t.y + (cy - lastCenter.current!.y) }))
      }
      lastDistance.current = dist
      lastCenter.current = { x: cx, y: cy }
    } else if (e.touches.length === 1 && scale > 1 && dragging.current) {
      const dx = e.touches[0].clientX - dragStart.current.x
      const dy = e.touches[0].clientY - dragStart.current.y
      dragStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
      setTranslate((t) => ({ x: t.x + dx, y: t.y + dy }))
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
    if (scale <= 1) reset()
  }

  function handleDoubleTap() {
    const now = Date.now()
    if (now - lastTap.current < 300) {
      if (scale > 1) reset()
      else setScale(2.5)
    }
    lastTap.current = now
  }

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center"
      onClick={(e) => { if (e.target === e.currentTarget && scale <= 1) onClose() }}
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-[101] w-10 h-10 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center text-white hover:bg-white/20 transition-colors"
        aria-label="Close"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
      <p className="absolute bottom-6 left-0 right-0 text-center text-xs text-white/50 pointer-events-none">
        Pinch to zoom · Double tap to toggle
      </p>
      <div
        className="w-[95vw] overflow-visible select-none bg-white dark:bg-[#161618] rounded-xl p-4 [&_svg]:mx-auto [&_svg]:!w-full [&_svg]:!h-auto [&_svg]:!max-w-none"
        style={{
          transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale})`,
          transition: dragging.current ? "none" : "transform 0.2s ease-out",
          touchAction: "none",
        }}
        onClick={handleDoubleTap}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        dangerouslySetInnerHTML={{ __html: svg.replace(/<svg([^>]*?)(?:\s+width="[^"]*")?([^>]*?)(?:\s+height="[^"]*")?([^>]*)>/, '<svg$1$2$3 width="100%" preserveAspectRatio="xMidYMid meet">') }}
      />
    </div>
  )
}
