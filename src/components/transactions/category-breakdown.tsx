"use client"

import { useEffect, useMemo, useState } from "react"
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts"
import { ChevronDown, PieChart as PieChartIcon, TrendingUp } from "lucide-react"
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

function ViewToggle({ view, onChange }: { view: View; onChange: (v: View) => void }) {
  return (
    <div className="flex bg-[#f5f5f7] dark:bg-[#2c2c2e] rounded-xl p-0.5">
      {(["expense", "income"] as const).map((v) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all ${
            view === v
              ? "bg-white dark:bg-[#3a3a3c] text-[#1d1d1f] dark:text-white shadow-sm"
              : "text-[#86868b]"
          }`}
        >
          {v === "expense" ? "Expenses" : "Income"}
        </button>
      ))}
    </div>
  )
}

export function TransactionCategoryBreakdown({ transactions, periodLabel }: Props) {
  const { formatCompact: formatCurrency } = useCurrency()
  const [open, setOpen] = useState(false)
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
    <div
      className={`relative overflow-hidden rounded-2xl border transition-all duration-300 ${
        open
          ? "border-indigo-300/60 dark:border-indigo-500/30 shadow-lg shadow-indigo-500/10"
          : "border-indigo-200/50 dark:border-indigo-500/20 shadow-md shadow-indigo-500/5"
      } bg-gradient-to-br from-indigo-50/90 via-white to-violet-50/70 dark:from-indigo-950/50 dark:via-[#1c1c1e] dark:to-violet-950/30`}
    >
      {/* decorative blobs */}
      <div className="pointer-events-none absolute -top-10 -right-10 h-32 w-32 rounded-full bg-indigo-400/10 blur-2xl" />
      <div className="pointer-events-none absolute -bottom-8 -left-8 h-24 w-24 rounded-full bg-violet-400/10 blur-2xl" />

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative w-full text-left p-4 sm:p-5 hover:bg-indigo-500/[0.03] dark:hover:bg-indigo-400/[0.04] transition-colors"
      >
        <div className="flex items-start gap-3 sm:gap-4">
          <div className="flex-shrink-0 w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-md shadow-indigo-500/25">
            <PieChartIcon className="w-5 h-5 text-white" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-0.5">
              <p className="text-[15px] font-semibold text-[#1d1d1f] dark:text-white tracking-tight">
                Cashflow analysis
              </p>
              <span className="text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-indigo-500/10 text-indigo-700 dark:bg-indigo-400/15 dark:text-indigo-300">
                Analytics
              </span>
            </div>
            <p className="text-[11px] text-[#86868b]">{periodLabel}</p>

            <div className="flex flex-wrap gap-2 mt-3">
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-white/70 dark:bg-white/[0.06] border border-green-200/60 dark:border-green-500/20 px-2.5 py-1.5 text-[11px]">
                <span className="text-[#86868b]">In</span>
                <span className="font-semibold tabular-nums text-green-700 dark:text-green-400">
                  {formatCurrency(incomeTotal)}
                </span>
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-white/70 dark:bg-white/[0.06] border border-red-200/60 dark:border-red-500/20 px-2.5 py-1.5 text-[11px]">
                <span className="text-[#86868b]">Out</span>
                <span className="font-semibold tabular-nums text-red-700 dark:text-red-400">
                  {formatCurrency(expenseTotal)}
                </span>
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-white/80 dark:bg-white/[0.08] border border-indigo-200/70 dark:border-indigo-500/25 px-2.5 py-1.5 text-[11px]">
                <TrendingUp className={`w-3 h-3 ${balanceClass(netBalance)}`} />
                <span className="text-[#86868b]">Net</span>
                <span className={`font-semibold tabular-nums ${balanceClass(netBalance)}`}>
                  {formatBalance(netBalance)}
                </span>
              </span>
            </div>
          </div>

          <div className="flex flex-col items-center gap-1 flex-shrink-0 pt-1">
            <span className="text-[10px] font-medium text-indigo-600/80 dark:text-indigo-400/80">
              {open ? "Hide" : "View"}
            </span>
            <div className="w-8 h-8 rounded-full bg-white/80 dark:bg-white/10 border border-indigo-200/50 dark:border-indigo-500/20 flex items-center justify-center">
              <ChevronDown
                className={`w-4 h-4 text-indigo-600 dark:text-indigo-400 transition-transform duration-300 ${open ? "rotate-180" : ""}`}
              />
            </div>
          </div>
        </div>
      </button>

      {open && (
        <div className="relative px-4 sm:px-5 pb-5 space-y-4 border-t border-indigo-200/40 dark:border-indigo-500/15 pt-4 bg-white/40 dark:bg-black/20">
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

          {chartRows.length > 0 && mounted ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <p className="text-[11px] text-[#86868b] uppercase tracking-wide">Distribution</p>
                  <ViewToggle view={view} onChange={setView} />
                </div>
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
                        {chartRows.map((row, i) => (
                          <Cell key={row.id} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v) => formatCurrency(Number(v))} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div>
                <p className="text-[11px] text-[#86868b] uppercase tracking-wide mb-2">By category</p>
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
                        {chartRows.map((row, i) => (
                          <Cell key={row.id} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-[#86868b] text-center py-4">
              No {view === "expense" ? "expenses" : "income"} in this period
            </p>
          )}

          {chartTotal > 0 && (
            <p className="text-[11px] text-[#86868b] text-right">
              {view === "expense" ? "Total spent" : "Total earned"}: {formatCurrency(chartTotal)}
            </p>
          )}

          {categorySummary.length > 0 && (
            <div className="overflow-x-auto -mx-1 px-1 pt-1 border-t border-black/[0.04] dark:border-white/[0.06]">
              <p className="text-[10px] text-[#86868b] uppercase tracking-wide py-2">Category breakdown</p>
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="text-[10px] uppercase tracking-wide text-[#86868b] border-b border-black/[0.06] dark:border-white/[0.08]">
                    <th className="text-left font-medium py-2 pr-2">Category</th>
                    <th className="text-right font-medium py-2 px-2 w-24">Income</th>
                    <th className="text-right font-medium py-2 pl-2 w-24">Expense</th>
                  </tr>
                </thead>
                <tbody>
                  {categorySummary.map((row, i) => (
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
                        <td className="py-2.5 pl-2 text-right tabular-nums text-red-700 dark:text-red-400">
                          {row.expense > 0 ? formatCurrency(row.expense) : "—"}
                        </td>
                      </tr>
                    ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-black/[0.08] dark:border-white/[0.1] font-semibold">
                    <td className="py-2.5 pr-2 text-[#1d1d1f] dark:text-white">Total</td>
                    <td className="py-2.5 px-2 text-right tabular-nums text-green-700 dark:text-green-400">
                      {formatCurrency(incomeTotal)}
                    </td>
                    <td className="py-2.5 pl-2 text-right tabular-nums text-red-700 dark:text-red-400">
                      {formatCurrency(expenseTotal)}
                    </td>
                  </tr>
                </tfoot>
              </table>
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-black/[0.04] dark:border-white/[0.06]">
                <span className="text-xs font-medium text-[#86868b]">Net balance</span>
                <span className={`text-sm font-semibold tabular-nums ${balanceClass(netBalance)}`}>
                  {formatBalance(netBalance)}
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
