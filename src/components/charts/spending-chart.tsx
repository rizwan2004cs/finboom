"use client"

import { useMemo, useSyncExternalStore } from "react"
import { PieChart, Pie, Cell, Tooltip } from "recharts"
import { useCurrency } from "@/hooks/use-currency"
import { TrendingDown, TrendingUp } from "lucide-react"
import type { Transaction } from "@/lib/types"
import { EXPENSE_CATEGORIES } from "@/lib/constants"
import { isAccountMovement } from "@/lib/finance/accounts"
import { monthKeyFromDate, transactionsInMonth } from "@/lib/finance/monthly-cashflow"
import { todayLocalISO } from "@/lib/utils"

// Map raw category ids (e.g. "food_dining") to human labels ("Food & Dining").
const EXPENSE_LABELS = new Map<string, string>(EXPENSE_CATEGORIES.map((c) => [c.id, c.label]))
const categoryLabel = (id: string) => EXPENSE_LABELS.get(id) ?? id

interface Props {
  transactions: Transaction[]
  isLoading?: boolean
}

const COLORS_LIGHT = [
  "#1d1d1f", "#6e6e73", "#86868b", "#aeaeb2", "#c7c7cc",
  "#3a3a3c", "#48484a", "#636366", "#8e8e93", "#b0b0b4",
]

const COLORS_DARK = [
  "#f5f5f7", "#aeaeb2", "#86868b", "#6e6e73", "#48484a",
  "#d1d1d6", "#c7c7cc", "#98989d", "#8e8e93", "#636366",
]

// External-store bindings for hydration and the dark-mode class on <html>.
const subscribeNoop = () => () => {}
const readIsDark = () => document.documentElement.classList.contains("dark")
function subscribeThemeClass(onChange: () => void) {
  const observer = new MutationObserver(onChange)
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] })
  return () => observer.disconnect()
}

export function SpendingChart({ transactions, isLoading }: Props) {
  const { formatCompact: formatCurrency } = useCurrency()
  // Recharts can't server-render, so the pie is skipped until hydration; the
  // theme is read from the <html> class list and re-read when it changes.
  const mounted = useSyncExternalStore(subscribeNoop, () => true, () => false)
  const isDark = useSyncExternalStore(subscribeThemeClass, readIsDark, () => false)

  const COLORS = isDark ? COLORS_DARK : COLORS_LIGHT

  const { currentMonthData, totalThisMonth, totalLastMonth, percentChange } = useMemo(() => {
    // Bucket by the YYYY-MM prefix like every other screen — Date-parsing a
    // bare ISO date is UTC midnight, which shifted the 1st into the previous
    // month for viewers west of UTC.
    const now = new Date()
    const thisKey = monthKeyFromDate(now)
    const lastKey = monthKeyFromDate(new Date(now.getFullYear(), now.getMonth() - 1, 1))
    const today = todayLocalISO()

    // Account movements (transfers/adjustments) are not real spending.
    const expenses = transactions.filter(t => t.type === "expense" && !isAccountMovement(t))

    // Month-to-date, matching the Transactions page "Expense" card.
    const thisMonthExpenses = transactionsInMonth(expenses, thisKey).filter(t => t.date <= today)
    const lastMonthExpenses = transactionsInMonth(expenses, lastKey)

    const categoryMap = new Map<string, number>()
    for (const tx of thisMonthExpenses) {
      const current = categoryMap.get(tx.category) || 0
      categoryMap.set(tx.category, current + Number(tx.amount))
    }

    const sorted = Array.from(categoryMap.entries())
      .map(([name, value]) => ({ name: categoryLabel(name), value }))
      .sort((a, b) => b.value - a.value)

    const totalThis = thisMonthExpenses.reduce((s, t) => s + Number(t.amount), 0)
    const totalLast = lastMonthExpenses.reduce((s, t) => s + Number(t.amount), 0)
    const pctChange = totalLast > 0 ? ((totalThis - totalLast) / totalLast) * 100 : 0

    return {
      currentMonthData: sorted,
      totalThisMonth: totalThis,
      totalLastMonth: totalLast,
      percentChange: pctChange,
    }
  }, [transactions])

  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="skeleton h-5 w-36 rounded-lg" />
        <div className="skeleton h-32 w-full rounded-xl" />
      </div>
    )
  }

  if (currentMonthData.length === 0) {
    return (
      <div className="h-48 flex flex-col items-center justify-center text-center px-4">
        <div className="w-10 h-10 rounded-xl bg-white/50 dark:bg-white/5 backdrop-blur-sm flex items-center justify-center mb-3">
          <TrendingDown className="w-5 h-5 text-[#86868b]" />
        </div>
        <p className="text-[14px] text-[#86868b]">No expenses this month</p>
        <p className="text-[12px] text-[#aeaeb2] mt-1">
          Log transactions to see your spending breakdown
        </p>
      </div>
    )
  }

  const top3 = currentMonthData.slice(0, 3)

  return (
    <div className="space-y-4">
      {/* Total + comparison */}
      <div className="flex items-baseline gap-2 flex-wrap">
        <span className="text-[22px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">
          {formatCurrency(totalThisMonth)}
        </span>
        {totalLastMonth > 0 && (
          <span className={`text-[12px] font-medium flex items-center gap-0.5 ${
            percentChange <= 0
              ? "text-green-600 dark:text-green-400"
              : "text-red-500 dark:text-red-400"
          }`}>
            {percentChange <= 0 ? (
              <TrendingDown className="w-3 h-3" />
            ) : (
              <TrendingUp className="w-3 h-3" />
            )}
            {percentChange > 0 ? "+" : ""}{percentChange.toFixed(0)}% vs last month
          </span>
        )}
      </div>

      {/* Chart + legend */}
      <div className="flex items-center gap-4">
        <div className="w-[120px] h-[120px] flex-shrink-0">
          {mounted && (
            <PieChart width={120} height={120}>
              <Pie
                data={currentMonthData}
                cx={60}
                cy={60}
                innerRadius={30}
                outerRadius={50}
                paddingAngle={currentMonthData.length > 1 ? 2 : 0}
                dataKey="value"
                stroke="none"
                startAngle={90}
                endAngle={-270}
                isAnimationActive={false}
              >
                {currentMonthData.map((_, index) => (
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

        {/* Top categories */}
        <div className="flex-1 space-y-2 min-w-0">
          {top3.map((item, index) => (
            <div key={item.name} className="flex items-center gap-2">
              <div
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: COLORS[index % COLORS.length] }}
              />
              <span className="text-[12px] text-[#6e6e73] dark:text-[#aeaeb2] truncate flex-1 capitalize">
                {item.name}
              </span>
              <span className="text-[12px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7]">
                {formatCurrency(item.value)}
              </span>
            </div>
          ))}
          {currentMonthData.length > 3 && (
            <p className="text-[11px] text-[#86868b]">
              +{currentMonthData.length - 3} more categor{currentMonthData.length - 3 === 1 ? "y" : "ies"}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
