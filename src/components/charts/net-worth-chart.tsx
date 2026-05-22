"use client"

import { useEffect, useState } from "react"
import { XAxis, YAxis, Tooltip, ResponsiveContainer, Area, AreaChart } from "recharts"
import type { Snapshot } from "@/lib/types"
import { useCurrency } from "@/hooks/use-currency"

interface Props {
  snapshots: Snapshot[]
}

export function NetWorthChart({ snapshots }: Props) {
  const { formatCompact } = useCurrency()
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

  // Smart date formatting based on actual date range spread
  const dates = snapshots.map(s => new Date(s.snapshot_date))
  const minDate = dates[dates.length - 1]
  const maxDate = dates[0]
  const diffMs = maxDate.getTime() - minDate.getTime()
  const diffDays = diffMs / (1000 * 60 * 60 * 24)

  const data = snapshots.map((s) => {
    const d = new Date(s.snapshot_date)
    let dateLabel: string
    if (diffDays <= 60) {
      // Within ~2 months: show day + short month
      dateLabel = d.toLocaleDateString("en-IN", { day: "numeric", month: "short" })
    } else if (diffDays <= 365) {
      // Within a year: show day + short month
      dateLabel = d.toLocaleDateString("en-IN", { day: "numeric", month: "short" })
    } else {
      // Multi-year: show month + year
      dateLabel = d.toLocaleDateString("en-IN", { month: "short", year: "2-digit" })
    }
    return {
      date: dateLabel,
      netWorth: Number(s.net_worth),
      assets: Number(s.total_assets),
      liabilities: Number(s.total_liabilities),
    }
  })

  const formatValue = (value: number) => formatCompact(value)

  const strokeColor = isDark ? "#f5f5f7" : "#1d1d1f"
  const tickColor = isDark ? "#98989d" : "#86868b"
  const gradientOpacity = isDark ? 0.15 : 0.08

  return (
    <div className="h-48" style={{ minWidth: 0, minHeight: 0 }}>
      <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
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
            minTickGap={20}
          />
          <YAxis 
            tickFormatter={formatValue}
            tick={{ fontSize: 11, fill: tickColor }}
            axisLine={false}
            tickLine={false}
            width={60}
            domain={[(dataMin: number) => Math.floor(dataMin * 0.95), (dataMax: number) => Math.ceil(dataMax * 1.02)]}
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
