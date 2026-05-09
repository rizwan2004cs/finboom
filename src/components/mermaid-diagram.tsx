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
                primaryColor: "#6366f1",
                primaryTextColor: "#f5f5f7",
                primaryBorderColor: "rgba(99,102,241,0.4)",
                secondaryColor: "#22d3ee",
                secondaryTextColor: "#1c1c1e",
                secondaryBorderColor: "rgba(34,211,238,0.3)",
                tertiaryColor: "#a78bfa",
                tertiaryTextColor: "#1c1c1e",
                tertiaryBorderColor: "rgba(167,139,250,0.3)",
                lineColor: "rgba(255,255,255,0.25)",
                textColor: "#f5f5f7",
                mainBkg: "#6366f1",
                nodeBorder: "rgba(99,102,241,0.5)",
                clusterBkg: "#1c1c1e",
                clusterBorder: "rgba(255,255,255,0.08)",
                titleColor: "#ffffff",
                edgeLabelBackground: "#1c1c1e",
                nodeTextColor: "#ffffff",
                // Pie chart — vibrant palette
                pie1: "#6366f1",
                pie2: "#22d3ee",
                pie3: "#f59e0b",
                pie4: "#10b981",
                pie5: "#f43f5e",
                pie6: "#a78bfa",
                pie7: "#ec4899",
                pie8: "#14b8a6",
                pieStrokeColor: "rgba(255,255,255,0.15)",
                pieTitleTextColor: "#ffffff",
                pieSectionTextColor: "#ffffff",
                pieLegendTextColor: "#f5f5f7",
                pieOuterStrokeColor: "rgba(255,255,255,0.06)",
                // XY / Bar chart
                xyChart: {
                  backgroundColor: "transparent",
                  titleColor: "#f5f5f7",
                  xAxisTitleColor: "#a1a1aa",
                  yAxisTitleColor: "#a1a1aa",
                  xAxisLabelColor: "#a1a1aa",
                  yAxisLabelColor: "#a1a1aa",
                  xAxisLineColor: "rgba(255,255,255,0.15)",
                  yAxisLineColor: "rgba(255,255,255,0.15)",
                  xAxisTickColor: "rgba(255,255,255,0.15)",
                  yAxisTickColor: "rgba(255,255,255,0.15)",
                  plotColorPalette: "#6366f1,#22d3ee,#f59e0b,#10b981,#f43f5e,#a78bfa",
                },
              }
            : {
                // Light premium theme
                primaryColor: "#6366f1",
                primaryTextColor: "#ffffff",
                primaryBorderColor: "rgba(99,102,241,0.3)",
                secondaryColor: "#22d3ee",
                secondaryTextColor: "#1d1d1f",
                secondaryBorderColor: "rgba(34,211,238,0.3)",
                tertiaryColor: "#a78bfa",
                tertiaryTextColor: "#1d1d1f",
                tertiaryBorderColor: "rgba(167,139,250,0.3)",
                lineColor: "rgba(0,0,0,0.35)",
                textColor: "#1d1d1f",
                mainBkg: "#6366f1",
                nodeBorder: "rgba(99,102,241,0.4)",
                clusterBkg: "#f5f5f7",
                clusterBorder: "rgba(0,0,0,0.08)",
                titleColor: "#1d1d1f",
                edgeLabelBackground: "#ffffff",
                nodeTextColor: "#ffffff",
                // Pie chart — vibrant palette
                pie1: "#6366f1",
                pie2: "#22d3ee",
                pie3: "#f59e0b",
                pie4: "#10b981",
                pie5: "#f43f5e",
                pie6: "#a78bfa",
                pie7: "#ec4899",
                pie8: "#14b8a6",
                pieStrokeColor: "#ffffff",
                pieTitleTextColor: "#1d1d1f",
                pieSectionTextColor: "#ffffff",
                pieLegendTextColor: "#1d1d1f",
                pieOuterStrokeColor: "rgba(0,0,0,0.06)",
                // XY / Bar chart
                xyChart: {
                  backgroundColor: "transparent",
                  titleColor: "#1d1d1f",
                  xAxisTitleColor: "#6e6e73",
                  yAxisTitleColor: "#6e6e73",
                  xAxisLabelColor: "#6e6e73",
                  yAxisLabelColor: "#6e6e73",
                  xAxisLineColor: "rgba(0,0,0,0.15)",
                  yAxisLineColor: "rgba(0,0,0,0.15)",
                  xAxisTickColor: "rgba(0,0,0,0.15)",
                  yAxisTickColor: "rgba(0,0,0,0.15)",
                  plotColorPalette: "#6366f1,#22d3ee,#f59e0b,#10b981,#f43f5e,#a78bfa",
                },
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
