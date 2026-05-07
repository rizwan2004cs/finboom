"use client"

import { useEffect, useState } from "react"
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts"

interface AllocationItem {
  name: string
  value: number
  id: string
  icon: string
}

interface Props {
  data: AllocationItem[]
  total: number
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

function formatCurrency(amount: number) {
  if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(2)} Cr`
  if (amount >= 100000) return `₹${(amount / 100000).toFixed(2)} L`
  if (amount >= 1000) return `₹${(amount / 1000).toFixed(1)}K`
  return `₹${amount.toLocaleString("en-IN")}`
}

export function AllocationChart({ data, total }: Props) {
  const [isDark, setIsDark] = useState(false)

  useEffect(() => {
    const check = () => setIsDark(document.documentElement.classList.contains("dark"))
    check()
    const observer = new MutationObserver(check)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] })
    return () => observer.disconnect()
  }, [])

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
      <div className="w-36 h-36 flex-shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={35}
              outerRadius={60}
              paddingAngle={2}
              dataKey="value"
              stroke="none"
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
        </ResponsiveContainer>
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
              {((item.value / total) * 100).toFixed(0)}%
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
