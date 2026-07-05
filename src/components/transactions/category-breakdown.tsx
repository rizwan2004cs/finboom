"use client"

import { useEffect, useMemo, useState } from "react"
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts"
import { useCurrency } from "@/hooks/use-currency"
import type { Transaction } from "@/lib/types"
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from "@/lib/constants"
import { CategoryIcon } from "@/components/category-icon"

const COLORS = [
  "#1d1d1f", "#0071e3", "#34c759", "#ff9500", "#af52de",
  "#ff2d55", "#5856d6", "#6e6e73", "#86868b", "#30b0c7",
]

const EXPENSE_LABELS = new Map<string, string>(EXPENSE_CATEGORIES.map((c) => [c.id, c.label]))
const INCOME_LABELS = new Map<string, string>(INCOME_CATEGORIES.map((c) => [c.id, c.label]))
const EXPENSE_ICONS = new Map<string, string>(EXPENSE_CATEGORIES.map((c) => [c.id, c.icon]))
const INCOME_ICONS = new Map<string, string>(INCOME_CATEGORIES.map((c) => [c.id, c.icon]))

interface Props {
  transactions: Transaction[]
  /** e.g. "1 Jul – 5 Jul 2026" */
  periodLabel: string
}

type View = "expense" | "income"

function sumByCategory(txs: Transaction[]): Map<string, number> {
  const map = new Map<string, number>()
  for (const tx of txs) {
    map.set(tx.category, (map.get(tx.category) ?? 0) + Number(tx.amount))
  }
  return map
}

export function TransactionCategoryBreakdown({ transactions, periodLabel }: Props) {
  const { formatCompact: formatCurrency } = useCurrency()
  const [view, setView] = useState<View>("expense")
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  const { incomeTotal, expenseTotal, incomeRows, expenseRows, categorySummary } = useMemo(() => {
    const incomeTx = transactions.filter((t) => t.type === "income")
    const expenseTx = transactions.filter((t) => t.type === "expense")
    const incomeMap = sumByCategory(incomeTx)
    const expenseMap = sumByCategory(expenseTx)

    const incomeTotal = incomeTx.reduce((s, t) => s + Number(t.amount), 0)
    const expenseTotal = expenseTx.reduce((s, t) => s + Number(t.amount), 0)

    const toRows = (map: Map<string, number>, labels: Map<string, string>) =>
      Array.from(map.entries())
        .map(([id, value]) => ({ id, name: labels.get(id) ?? id, value }))
        .sort((a, b) => b.value - a.value)

    const incomeRows = toRows(incomeMap, INCOME_LABELS)
    const expenseRows = toRows(expenseMap, EXPENSE_LABELS)

    const allIds = new Set([...incomeMap.keys(), ...expenseMap.keys()])
    const categorySummary = [...allIds]
      .map((id) => ({
        id,
        label: EXPENSE_LABELS.get(id) ?? INCOME_LABELS.get(id) ?? id,
        icon: EXPENSE_ICONS.get(id) ?? INCOME_ICONS.get(id) ?? "MoreHorizontal",
        income: incomeMap.get(id) ?? 0,
        expense: expenseMap.get(id) ?? 0,
      }))
      .filter((r) => r.income > 0 || r.expense > 0)
      .sort((a, b) => b.expense + b.income - (a.expense + a.income))

    return { incomeTotal, expenseTotal, incomeRows, expenseRows, categorySummary }
  }, [transactions])

  const chartRows = view === "expense" ? expenseRows : incomeRows
  const chartTotal = view === "expense" ? expenseTotal : incomeTotal
  const netBalance = incomeTotal - expenseTotal

  function balanceClass(n: number) {
    if (n > 0) return "text-green-700 dark:text-green-400"
    if (n < 0) return "text-red-700 dark:text-red-400"
    return "text-[#86868b]"
  }

  function formatBalance(n: number) {
    if (n === 0) return "—"
    const prefix = n > 0 ? "+" : "−"
    return `${prefix}${formatCurrency(Math.abs(n))}`
  }

  if (transactions.length === 0) return null

  return (
    <div className="liquid-glass rounded-2xl p-4 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-[#1d1d1f] dark:text-white">By category</h3>
          <p className="text-[11px] text-[#86868b]">{periodLabel}</p>
        </div>
        <div className="flex bg-[#f5f5f7] dark:bg-[#2c2c2e] rounded-xl p-0.5 self-start">
          {(["expense", "income"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                view === v
                  ? "bg-white dark:bg-[#3a3a3c] text-[#1d1d1f] dark:text-white shadow-sm"
                  : "text-[#86868b]"
              }`}
            >
              {v === "expense" ? "Expenses" : "Income"}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="bg-green-50/80 dark:bg-green-500/10 rounded-xl p-3">
          <p className="text-[10px] text-[#86868b] uppercase tracking-wide">Income</p>
          <p className="text-lg font-semibold text-green-700 dark:text-green-400">{formatCurrency(incomeTotal)}</p>
        </div>
        <div className="bg-red-50/80 dark:bg-red-500/10 rounded-xl p-3">
          <p className="text-[10px] text-[#86868b] uppercase tracking-wide">Expenses</p>
          <p className="text-lg font-semibold text-red-700 dark:text-red-400">{formatCurrency(expenseTotal)}</p>
        </div>
      </div>

      {categorySummary.length > 0 && (
        <div className="overflow-x-auto -mx-1 px-1">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="text-[10px] uppercase tracking-wide text-[#86868b] border-b border-black/[0.06] dark:border-white/[0.08]">
                <th className="text-left font-medium py-2 pr-2">Category</th>
                <th className="text-right font-medium py-2 px-2 w-24">Income</th>
                <th className="text-right font-medium py-2 px-2 w-24">Expense</th>
                <th className="text-right font-medium py-2 pl-2 w-24">Balance</th>
              </tr>
            </thead>
            <tbody>
              {categorySummary.map((row, i) => {
                const balance = row.income - row.expense
                return (
                  <tr
                    key={row.id}
                    className="border-b border-black/[0.03] dark:border-white/[0.04] last:border-0"
                  >
                    <td className="py-2.5 pr-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{ backgroundColor: COLORS[i % COLORS.length] }}
                        />
                        <CategoryIcon name={row.icon} className="w-3.5 h-3.5 text-[#86868b] flex-shrink-0" />
                        <span className="truncate text-[#1d1d1f] dark:text-white font-medium">{row.label}</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-2 text-right tabular-nums text-green-700 dark:text-green-400">
                      {row.income > 0 ? formatCurrency(row.income) : "—"}
                    </td>
                    <td className="py-2.5 px-2 text-right tabular-nums text-red-700 dark:text-red-400">
                      {row.expense > 0 ? formatCurrency(row.expense) : "—"}
                    </td>
                    <td className={`py-2.5 pl-2 text-right tabular-nums font-medium ${balanceClass(balance)}`}>
                      {formatBalance(balance)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="border-t border-black/[0.08] dark:border-white/[0.1] font-semibold">
                <td className="py-2.5 pr-2 text-[#1d1d1f] dark:text-white">Total</td>
                <td className="py-2.5 px-2 text-right tabular-nums text-green-700 dark:text-green-400">
                  {formatCurrency(incomeTotal)}
                </td>
                <td className="py-2.5 px-2 text-right tabular-nums text-red-700 dark:text-red-400">
                  {formatCurrency(expenseTotal)}
                </td>
                <td className={`py-2.5 pl-2 text-right tabular-nums ${balanceClass(netBalance)}`}>
                  {formatBalance(netBalance)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {chartRows.length > 0 && mounted && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartRows}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius="45%"
                  outerRadius="75%"
                  paddingAngle={chartRows.length > 1 ? 2 : 0}
                  stroke="none"
                >
                  {chartRows.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => formatCurrency(Number(v))} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartRows} layout="vertical" margin={{ left: 4, right: 8, top: 0, bottom: 0 }}>
                <XAxis type="number" hide tickFormatter={(v) => formatCurrency(v)} />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={72}
                  tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip formatter={(v) => formatCurrency(Number(v))} />
                <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={14}>
                  {chartRows.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {chartRows.length === 0 && (
        <p className="text-sm text-[#86868b] text-center py-4">
          No {view === "expense" ? "expenses" : "income"} in this period
        </p>
      )}

      {chartTotal > 0 && (
        <p className="text-[11px] text-[#86868b] text-right">
          {view === "expense" ? "Total spent" : "Total earned"}: {formatCurrency(chartTotal)}
        </p>
      )}
    </div>
  )
}
