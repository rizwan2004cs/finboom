"use client"

import { useEffect, useState } from "react"
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Area, AreaChart } from "recharts"
import type { Snapshot } from "@/lib/types"

interface Props {
  snapshots: Snapshot[]
}

export function NetWorthChart({ snapshots }: Props) {
  const [isDark, setIsDark] = useState(false)

  useEffect(() => {
    const check = () => setIsDark(document.documentElement.classList.contains("dark"))
    check()
    const observer = new MutationObserver(check)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] })
    return () => observer.disconnect()
  }, [])

  if (snapshots.length === 0) {
    return (
      <div className="h-48 flex items-center justify-center text-[14px] text-[#86868b]">
        <p>Take your first snapshot to see trends</p>
      </div>
    )
  }

  const data = snapshots.map((s) => ({
    date: new Date(s.snapshot_date).toLocaleDateString("en-IN", { month: "short", year: "2-digit" }),
    netWorth: Number(s.net_worth),
    assets: Number(s.total_assets),
    liabilities: Number(s.total_liabilities),
  }))

  const formatValue = (value: number) => {
    if (value >= 10000000) return `₹${(value / 10000000).toFixed(1)}Cr`
    if (value >= 100000) return `₹${(value / 100000).toFixed(1)}L`
    if (value >= 1000) return `₹${(value / 1000).toFixed(0)}K`
    return `₹${value}`
  }

  const strokeColor = isDark ? "#f5f5f7" : "#1d1d1f"
  const tickColor = isDark ? "#98989d" : "#86868b"
  const gradientOpacity = isDark ? 0.15 : 0.08

  return (
    <div className="h-48">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
          <defs>
            <linearGradient id="netWorthGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={strokeColor} stopOpacity={gradientOpacity} />
              <stop offset="95%" stopColor={strokeColor} stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis 
            dataKey="date" 
            tick={{ fontSize: 11, fill: tickColor }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis 
            tickFormatter={formatValue}
            tick={{ fontSize: 11, fill: tickColor }}
            axisLine={false}
            tickLine={false}
            width={60}
          />
          <Tooltip
            contentStyle={{
              background: isDark ? "#1c1c1e" : "#ffffff",
              border: isDark ? "1px solid rgba(255,255,255,0.1)" : "1px solid rgba(0,0,0,0.06)",
              borderRadius: 12,
              fontSize: 12,
              color: isDark ? "#f5f5f7" : "#1d1d1f",
              boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
            }}
            formatter={(value) => [formatValue(Number(value)), ""]}
          />
          <Area
            type="monotone"
            dataKey="netWorth"
            stroke={strokeColor}
            strokeWidth={2}
            fill="url(#netWorthGradient)"
            dot={false}
            activeDot={{ r: 4, fill: strokeColor }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
