"use client"

import { useEffect, useRef, useState } from "react"

export default function MermaidDiagram({ code }: { code: string }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [svg, setSvg] = useState("")
  const [error, setError] = useState("")

  useEffect(() => {
    let cancelled = false

    async function render() {
      try {
        const mermaid = (await import("mermaid")).default
        const isDark = document.documentElement.classList.contains("dark")

        mermaid.initialize({
          startOnLoad: false,
          theme: isDark ? "dark" : "neutral",
          fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', sans-serif",
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
    <div
      ref={containerRef}
      className="my-6 overflow-x-auto rounded-2xl border border-black/[0.06] dark:border-white/[0.06] p-6 bg-[#fafafa] dark:bg-[#161618] shadow-sm [&_svg]:mx-auto [&_svg]:max-w-full"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}
