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
          theme: "base",
          fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', sans-serif",
          themeVariables: isDark
            ? {
                // Dark premium theme
                primaryColor: "#2c2c2e",
                primaryTextColor: "#f5f5f7",
                primaryBorderColor: "rgba(255,255,255,0.12)",
                secondaryColor: "#1c1c1e",
                secondaryTextColor: "#e5e5e7",
                secondaryBorderColor: "rgba(255,255,255,0.08)",
                tertiaryColor: "#3a3a3c",
                tertiaryTextColor: "#f5f5f7",
                tertiaryBorderColor: "rgba(255,255,255,0.10)",
                lineColor: "rgba(255,255,255,0.25)",
                textColor: "#f5f5f7",
                mainBkg: "#2c2c2e",
                nodeBorder: "rgba(255,255,255,0.15)",
                clusterBkg: "#1c1c1e",
                clusterBorder: "rgba(255,255,255,0.08)",
                titleColor: "#ffffff",
                edgeLabelBackground: "#1c1c1e",
                nodeTextColor: "#f5f5f7",
                // Pie chart
                pie1: "#f5f5f7",
                pie2: "#636366",
                pie3: "#8e8e93",
                pie4: "#48484a",
                pie5: "#aeaeb2",
                pie6: "#3a3a3c",
                pie7: "#d1d1d6",
                pieStrokeColor: "rgba(255,255,255,0.1)",
                pieTitleTextColor: "#ffffff",
                pieSectionTextColor: "#1c1c1e",
                pieLegendTextColor: "#f5f5f7",
                pieOuterStrokeColor: "rgba(255,255,255,0.06)",
              }
            : {
                // Light premium theme
                primaryColor: "#1d1d1f",
                primaryTextColor: "#ffffff",
                primaryBorderColor: "rgba(0,0,0,0.12)",
                secondaryColor: "#f5f5f7",
                secondaryTextColor: "#1d1d1f",
                secondaryBorderColor: "rgba(0,0,0,0.08)",
                tertiaryColor: "#e8e8ed",
                tertiaryTextColor: "#1d1d1f",
                tertiaryBorderColor: "rgba(0,0,0,0.10)",
                lineColor: "rgba(0,0,0,0.35)",
                textColor: "#1d1d1f",
                mainBkg: "#1d1d1f",
                nodeBorder: "rgba(0,0,0,0.15)",
                clusterBkg: "#f5f5f7",
                clusterBorder: "rgba(0,0,0,0.08)",
                titleColor: "#1d1d1f",
                edgeLabelBackground: "#ffffff",
                nodeTextColor: "#ffffff",
                // Pie chart
                pie1: "#1d1d1f",
                pie2: "#6e6e73",
                pie3: "#86868b",
                pie4: "#aeaeb2",
                pie5: "#48484a",
                pie6: "#d1d1d6",
                pie7: "#3a3a3c",
                pieStrokeColor: "#ffffff",
                pieTitleTextColor: "#1d1d1f",
                pieSectionTextColor: "#ffffff",
                pieLegendTextColor: "#1d1d1f",
                pieOuterStrokeColor: "rgba(0,0,0,0.06)",
              },
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
