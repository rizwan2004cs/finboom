"use client"

import { useSyncExternalStore } from "react"
import { PieChart, Pie, Cell, Tooltip } from "recharts"
import { useCurrency } from "@/hooks/use-currency"

interface AllocationItem {
  name: string
  value: number
  id: string
  icon: string
}

interface Props {
  data: AllocationItem[]
}

const COLORS_LIGHT = [
  "#1d1d1f", "#6e6e73", "#86868b", "#aeaeb2", "#c7c7cc",
  "#3a3a3c", "#48484a", "#636366", "#8e8e93", "#b0b0b4",
  "#2c2c2e", "#d1d1d6",
]

const COLORS_DARK = [
  "#f5f5f7", "#aeaeb2", "#86868b", "#6e6e73", "#48484a",
  "#d1d1d6", "#c7c7cc", "#98989d", "#8e8e93", "#636366",
  "#e5e5ea", "#b0b0b4",
]

// External-store bindings for hydration and the dark-mode class on <html>.
const subscribeNoop = () => () => {}
const readIsDark = () => document.documentElement.classList.contains("dark")
function subscribeThemeClass(onChange: () => void) {
  const observer = new MutationObserver(onChange)
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] })
  return () => observer.disconnect()
}

export function AllocationChart({ data }: Props) {
  const { formatCompact: formatCurrency } = useCurrency()
  // Percentages are shares of what is plotted, so the legend always sums to
  // 100% — a caller-supplied total (e.g. one including cash & bank) did not.
  const total = data.reduce((sum, d) => sum + d.value, 0)
  // Recharts can't server-render, so the pie is skipped until hydration; the
  // theme is read from the <html> class list and re-read when it changes.
  const mounted = useSyncExternalStore(subscribeNoop, () => true, () => false)
  const isDark = useSyncExternalStore(subscribeThemeClass, readIsDark, () => false)

  const COLORS = isDark ? COLORS_DARK : COLORS_LIGHT

  if (data.length === 0) {
    return (
      <div className="h-48 flex items-center justify-center text-[14px] text-[#86868b]">
        <p>Add assets to see allocation</p>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-4">
      <div className="w-[144px] h-[144px] flex-shrink-0">
        {mounted && (
          <PieChart width={144} height={144}>
            <Pie
              data={data}
              cx={72}
              cy={72}
              innerRadius={35}
              outerRadius={60}
              paddingAngle={data.length > 1 ? 2 : 0}
              dataKey="value"
              stroke="none"
              startAngle={90}
              endAngle={-270}
              isAnimationActive={false}
            >
              {data.map((_, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                background: isDark ? "#1c1c1e" : "#ffffff",
                border: isDark ? "1px solid rgba(255,255,255,0.1)" : "1px solid rgba(0,0,0,0.06)",
                borderRadius: 12,
                fontSize: 12,
                color: isDark ? "#f5f5f7" : "#1d1d1f",
                boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
              }}
              formatter={(value) => [formatCurrency(Number(value)), ""]}
            />
          </PieChart>
        )}
      </div>
      <div className="flex-1 space-y-1.5 overflow-y-auto max-h-48">
        {data.slice(0, 6).map((item, index) => (
          <div key={item.id} className="flex items-center gap-2">
            <div
              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: COLORS[index % COLORS.length] }}
            />
            <span className="text-[12px] text-[#6e6e73] dark:text-[#aeaeb2] truncate flex-1">{item.name}</span>
            <span className="text-[12px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7]">
              {(total > 0 ? (item.value / total) * 100 : 0).toFixed(0)}%
            </span>
          </div>
        ))}
        {data.length > 6 && (
          <p className="text-[12px] text-[#86868b]">+{data.length - 6} more</p>
        )}
      </div>
    </div>
  )
}
