"use client"

import { useState, useMemo } from "react"
import { useUser } from "@/hooks/use-auth"
import { useProfile } from "@/hooks/use-profile"
import { useOfflineQuery } from "@/hooks/use-offline-query"
import { useInsertMutation, useUpdateMutation, useDeleteMutation } from "@/hooks/use-offline-mutation"
import { useQueryClient } from "@tanstack/react-query"
import { PiggyBank, Plus, Trash2, Sparkles, Copy, Pencil, Info, ChevronLeft, ChevronRight } from "lucide-react"
import type { Budget, Transaction } from "@/lib/types"
import { EXPENSE_CATEGORIES } from "@/lib/constants"
import { CategoryIcon } from "@/components/category-icon"
import { useAppDialog } from "@/components/app-dialog"
import { useCurrency } from "@/hooks/use-currency"

export default function BudgetPage() {
  const { formatCompact: formatCurrency } = useCurrency()
  const { user } = useUser()
  const { activeProfile } = useProfile()
  const queryClient = useQueryClient()
  const { showAlert } = useAppDialog()

  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7))
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editAmount, setEditAmount] = useState("")
  const [showAddCategory, setShowAddCategory] = useState(false)
  const [newAmount, setNewAmount] = useState("")
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [loadingAction, setLoadingAction] = useState<string | null>(null)

  // Data queries
  const { data: budgets = [], isLoading: loadingBudgets } = useOfflineQuery<Budget>(
    "budgets", user?.id, {
      filters: [
        { column: "profile_id", op: "eq", value: activeProfile?.id ?? "" },
        { column: "month", op: "eq", value: month },
      ],
      enabled: !!activeProfile,
      queryKey: [month],
    }
  )

  // Get transactions for current month to compute spend
  const startDate = `${month}-01`
  const endDate = new Date(parseInt(month.slice(0, 4)), parseInt(month.slice(5, 7)), 0)
    .toISOString().slice(0, 10)

  const { data: transactions = [] } = useOfflineQuery<Transaction>(
    "transactions", user?.id, {
      filters: [
        { column: "profile_id", op: "eq", value: activeProfile?.id ?? "" },
        { column: "date", op: "gte", value: startDate },
        { column: "date", op: "lte", value: endDate },
      ],
      enabled: !!activeProfile,
      queryKey: [`budget-txns-${month}`],
    }
  )

  // Get transactions for last 3 months (for auto-suggest)
  const threeMonthsAgo = useMemo(() => {
    const d = new Date(parseInt(month.slice(0, 4)), parseInt(month.slice(5, 7)) - 3, 1)
    return d.toISOString().slice(0, 10)
  }, [month])

  const { data: recentTransactions = [] } = useOfflineQuery<Transaction>(
    "transactions", user?.id, {
      filters: [
        { column: "profile_id", op: "eq", value: activeProfile?.id ?? "" },
        { column: "date", op: "gte", value: threeMonthsAgo },
        { column: "date", op: "lte", value: endDate },
      ],
      enabled: !!activeProfile,
      queryKey: [`budget-recent-txns-${month}`],
    }
  )

  const insertBudget = useInsertMutation<Budget>("budgets")
  const updateBudget = useUpdateMutation<Budget>("budgets")
  const deleteBudget = useDeleteMutation("budgets")

  // Compute spending per category
  const spendByCategory = useMemo(() => {
    const map: Record<string, number> = {}
    for (const t of transactions) {
      if (t.type === "expense") {
        map[t.category] = (map[t.category] || 0) + Number(t.amount)
      }
    }
    return map
  }, [transactions])

  const totalBudget = budgets.reduce((s, b) => s + Number(b.amount), 0)
  const totalSpent = Object.values(spendByCategory).reduce(
    (s, v) => s + v,
    0
  )

  // Only count spend on budgeted categories for the progress
  const budgetedSpent = budgets.reduce(
    (s, b) => s + (spendByCategory[b.category] || 0),
    0
  )

  const now = new Date()
  const daysInMonth = new Date(parseInt(month.slice(0, 4)), parseInt(month.slice(5, 7)), 0).getDate()
  const currentDay = month === now.toISOString().slice(0, 7) ? now.getDate() : daysInMonth
  const overallPct = totalBudget > 0 ? Math.min((budgetedSpent / totalBudget) * 100, 100) : 0

  // Categories already budgeted
  const budgetedCategories = new Set(budgets.map(b => b.category))
  const availableCategories = EXPENSE_CATEGORIES.filter(c => !budgetedCategories.has(c.id))

  function navigateMonth(dir: -1 | 1) {
    const d = new Date(parseInt(month.slice(0, 4)), parseInt(month.slice(5, 7)) - 1 + dir, 1)
    setMonth(d.toISOString().slice(0, 7))
    setShowAddCategory(false)
    setEditingId(null)
  }

  async function addBudget() {
    if (!selectedCategory || !newAmount || !activeProfile) return
    const amt = parseFloat(newAmount)
    if (isNaN(amt) || amt <= 0) return

    await insertBudget.mutateAsync({
      user_id: user!.id,
      profile_id: activeProfile.id,
      month,
      category: selectedCategory,
      amount: amt,
    })
    setSelectedCategory(null)
    setNewAmount("")
    setShowAddCategory(false)
  }

  async function saveEdit(id: string) {
    const amt = parseFloat(editAmount)
    if (isNaN(amt) || amt <= 0) return
    await updateBudget.mutateAsync({ id, data: { amount: amt } })
    setEditingId(null)
    setEditAmount("")
  }

  async function removeBudget(id: string) {
    await deleteBudget.mutateAsync(id)
  }

  async function copyFromLastMonth() {
    if (!activeProfile) return
    setLoadingAction("copy")
    try {
      const prev = new Date(parseInt(month.slice(0, 4)), parseInt(month.slice(5, 7)) - 2, 1)
      const prevMonth = prev.toISOString().slice(0, 7).padStart(7, "0")
      // Manually format to avoid leading zero issues
      const prevMonthStr = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}`

      const { fetchTable } = await import("@/lib/offline")
      const prevBudgets = await fetchTable<Budget>("budgets", user!.id, {
        filters: [
          { column: "profile_id", op: "eq", value: activeProfile.id },
          { column: "month", op: "eq", value: prevMonthStr },
        ],
      })

      if (prevBudgets.length === 0) {
        await showAlert("No budget found for the previous month.")
        return
      }

      for (const b of prevBudgets) {
        if (!budgetedCategories.has(b.category)) {
          await insertBudget.mutateAsync({
            user_id: user!.id,
            profile_id: activeProfile.id,
            month,
            category: b.category,
            amount: b.amount,
          })
        }
      }
      queryClient.invalidateQueries({ queryKey: ["budgets"] })
    } finally {
      setLoadingAction(null)
    }
  }

  async function autoSuggest() {
    if (!activeProfile) return
    setLoadingAction("suggest")
    try {
      // Average expenses per category over the last 3 months
      const expensesByCategory: Record<string, number[]> = {}
      for (const t of recentTransactions) {
        if (t.type !== "expense") continue
        const tMonth = t.date.slice(0, 7)
        if (tMonth === month) continue // exclude current month
        if (!expensesByCategory[t.category]) expensesByCategory[t.category] = []
        expensesByCategory[t.category].push(Number(t.amount))
      }

      let added = 0
      for (const [category, amounts] of Object.entries(expensesByCategory)) {
        if (budgetedCategories.has(category)) continue
        const avg = amounts.reduce((s, v) => s + v, 0) / 3
        const rounded = Math.ceil(avg / 500) * 500
        if (rounded <= 0) continue
        await insertBudget.mutateAsync({
          user_id: user!.id,
          profile_id: activeProfile.id,
          month,
          category,
          amount: rounded,
        })
        added++
      }

      if (added === 0) {
        await showAlert("No spending history found to suggest from.")
      }
      queryClient.invalidateQueries({ queryKey: ["budgets"] })
    } finally {
      setLoadingAction(null)
    }
  }

  // Loading skeleton
  if (loadingBudgets || !user || !activeProfile) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="skeleton h-7 w-36 rounded-lg" />
          <div className="skeleton h-9 w-28 rounded-xl" />
        </div>
        <div className="skeleton h-28 w-full rounded-2xl" />
        {[1, 2, 3].map(i => (
          <div key={i} className="skeleton h-20 w-full rounded-2xl" />
        ))}
      </div>
    )
  }

  const monthLabel = new Date(parseInt(month.slice(0, 4)), parseInt(month.slice(5, 7)) - 1)
    .toLocaleDateString("en-IN", { month: "long", year: "numeric" })

  return (
    <div className="space-y-4" data-tour-page="budget">
      {/* Header */}
      <div className="flex items-center justify-between" data-tour-el="budget-header">
        <div>
          <h1 className="text-xl font-bold text-[#1d1d1f] dark:text-white">Budget</h1>
          <p className="text-sm text-[#86868b]">Plan your monthly spending</p>
        </div>
        <button
          onClick={() => { setShowAddCategory(!showAddCategory); setSelectedCategory(null); setNewAmount("") }}
          className="flex items-center gap-1.5 liquid-glass-btn-primary"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Add</span>
        </button>
      </div>

      {/* Month Picker */}
      <div className="flex items-center justify-center gap-4">
        <button onClick={() => navigateMonth(-1)} className="p-2 rounded-xl hover:bg-[#f5f5f7] dark:hover:bg-[#2c2c2e] transition-all">
          <ChevronLeft className="w-5 h-5 text-[#1d1d1f] dark:text-white" />
        </button>
        <span className="text-sm font-semibold text-[#1d1d1f] dark:text-white min-w-[140px] text-center">
          {monthLabel}
        </span>
        <button onClick={() => navigateMonth(1)} className="p-2 rounded-xl hover:bg-[#f5f5f7] dark:hover:bg-[#2c2c2e] transition-all">
          <ChevronRight className="w-5 h-5 text-[#1d1d1f] dark:text-white" />
        </button>
      </div>

      {/* Summary Card */}
      {budgets.length > 0 && (
        <div className="liquid-glass rounded-2xl p-5">
          <div className="flex items-center justify-between mb-2">
            <div>
              <p className="text-sm text-[#86868b]">
                Spent this month
              </p>
              <p className="text-lg font-bold text-[#1d1d1f] dark:text-white">
                {formatCurrency(budgetedSpent)}{" "}
                <span className="text-sm font-normal text-[#86868b]">
                  of {formatCurrency(totalBudget)} planned
                </span>
              </p>
            </div>
            <span className="text-xs text-[#86868b]">
              Day {currentDay} of {daysInMonth}
            </span>
          </div>
          {/* Progress bar */}
          <div className="w-full h-2 bg-[#f5f5f7] dark:bg-[#2c2c2e] rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                overallPct > 90 ? "bg-red-500" : overallPct > 70 ? "bg-amber-500" : "bg-[#1d1d1f] dark:bg-white"
              }`}
              style={{ width: `${overallPct}%` }}
            />
          </div>
          {totalBudget > 0 && (
            <p className="text-xs text-[#86868b] mt-2">
              {formatCurrency(Math.max(totalBudget - budgetedSpent, 0))} remaining
            </p>
          )}
        </div>
      )}

      {/* Empty State */}
      {budgets.length === 0 && (
        <div className="liquid-glass rounded-2xl p-6">
          <div className="flex items-start gap-3 bg-blue-50 dark:bg-blue-500/10 rounded-xl p-4 mb-4">
            <Info className="w-5 h-5 text-blue-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-[#1d1d1f] dark:text-white">No budget for {monthLabel}</p>
              <p className="text-xs text-[#86868b] mt-0.5">
                Set spending limits per category to track where your money goes.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={autoSuggest}
              disabled={loadingAction === "suggest"}
              className="flex items-center justify-center gap-1.5 px-4 py-3 rounded-xl bg-[#f5f5f7] dark:bg-[#2c2c2e] text-[#1d1d1f] dark:text-white text-sm font-medium hover:bg-[#e8e8ed] dark:hover:bg-[#3a3a3c] transition-all disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4" />
              {loadingAction === "suggest" ? "Analyzing..." : "Auto-suggest"}
            </button>
            <button
              onClick={copyFromLastMonth}
              disabled={loadingAction === "copy"}
              className="flex items-center justify-center gap-1.5 px-4 py-3 rounded-xl bg-[#f5f5f7] dark:bg-[#2c2c2e] text-[#1d1d1f] dark:text-white text-sm font-medium hover:bg-[#e8e8ed] dark:hover:bg-[#3a3a3c] transition-all disabled:opacity-50"
            >
              <Copy className="w-4 h-4" />
              {loadingAction === "copy" ? "Copying..." : "Copy last month"}
            </button>
          </div>
        </div>
      )}

      {/* Add Category Panel */}
      {showAddCategory && (
        <div className="liquid-glass rounded-2xl p-5 space-y-3">
          <h3 className="text-sm font-semibold text-[#1d1d1f] dark:text-white">Add budget category</h3>

          {/* Category chips */}
          <div className="flex flex-wrap gap-2">
            {availableCategories.map(cat => {
              const catDef = EXPENSE_CATEGORIES.find(c => c.id === cat.id)
              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                    selectedCategory === cat.id
                      ? "bg-[#1d1d1f] dark:bg-white text-white dark:text-[#1d1d1f]"
                      : "bg-[#f5f5f7] dark:bg-[#2c2c2e] text-[#6e6e73] dark:text-[#aeaeb2] hover:text-[#1d1d1f] dark:hover:text-white"
                  }`}
                >
                  {catDef && <CategoryIcon name={catDef.icon} size="sm" />}
                  {cat.label}
                </button>
              )
            })}
          </div>

          {availableCategories.length === 0 && (
            <p className="text-xs text-[#86868b]">All categories have budgets already.</p>
          )}

          {/* Amount input */}
          {selectedCategory && (
            <div className="flex gap-2">
              <input
                type="number"
                placeholder="Amount"
                value={newAmount}
                onChange={e => setNewAmount(e.target.value)}
                className="flex-1 px-3 py-2.5 rounded-xl bg-[#f5f5f7] dark:bg-[#2c2c2e] text-sm text-[#1d1d1f] dark:text-white border-0 focus:outline-none focus:ring-2 focus:ring-[#1d1d1f]/10 dark:focus:ring-white/10"
                onKeyDown={e => e.key === "Enter" && addBudget()}
                autoFocus
              />
              <button
                onClick={addBudget}
                disabled={!newAmount || insertBudget.isPending}
                className="px-4 py-2.5 rounded-xl bg-[#1d1d1f] dark:bg-white text-white dark:text-[#1d1d1f] text-sm font-medium disabled:opacity-50"
              >
                Add
              </button>
            </div>
          )}
        </div>
      )}

      {/* Quick actions when budgets exist */}
      {budgets.length > 0 && (
        <div className="flex gap-2">
          <button
            onClick={autoSuggest}
            disabled={!!loadingAction}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#f5f5f7] dark:bg-[#2c2c2e] text-xs font-medium text-[#6e6e73] dark:text-[#aeaeb2] hover:text-[#1d1d1f] dark:hover:text-white transition-all disabled:opacity-50"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Auto-suggest
          </button>
          <button
            onClick={copyFromLastMonth}
            disabled={!!loadingAction}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#f5f5f7] dark:bg-[#2c2c2e] text-xs font-medium text-[#6e6e73] dark:text-[#aeaeb2] hover:text-[#1d1d1f] dark:hover:text-white transition-all disabled:opacity-50"
          >
            <Copy className="w-3.5 h-3.5" />
            Copy last month
          </button>
        </div>
      )}

      {/* Budget Cards */}
      {budgets
        .sort((a, b) => {
          const spentA = spendByCategory[a.category] || 0
          const spentB = spendByCategory[b.category] || 0
          const pctA = Number(a.amount) > 0 ? spentA / Number(a.amount) : 0
          const pctB = Number(b.amount) > 0 ? spentB / Number(b.amount) : 0
          return pctB - pctA // highest usage first
        })
        .map(budget => {
          const cat = EXPENSE_CATEGORIES.find(c => c.id === budget.category)
          const spent = spendByCategory[budget.category] || 0
          const budgetAmt = Number(budget.amount)
          const pct = budgetAmt > 0 ? Math.min((spent / budgetAmt) * 100, 100) : 0
          const remaining = Math.max(budgetAmt - spent, 0)
          const isOver = spent > budgetAmt

          return (
            <div key={budget.id} className="liquid-glass rounded-2xl p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-[#f5f5f7] dark:bg-[#2c2c2e] flex items-center justify-center">
                    {cat && <CategoryIcon name={cat.icon} size="sm" />}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[#1d1d1f] dark:text-white">
                      {cat?.label || budget.category}
                    </p>
                    <p className="text-xs text-[#86868b]">{pct.toFixed(0)}% used</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {editingId === budget.id ? (
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        value={editAmount}
                        onChange={e => setEditAmount(e.target.value)}
                        className="w-20 px-2 py-1 rounded-lg bg-[#f5f5f7] dark:bg-[#2c2c2e] text-xs text-[#1d1d1f] dark:text-white border-0 focus:outline-none focus:ring-2 focus:ring-[#1d1d1f]/10 dark:focus:ring-white/10"
                        onKeyDown={e => e.key === "Enter" && saveEdit(budget.id)}
                        autoFocus
                      />
                      <button
                        onClick={() => saveEdit(budget.id)}
                        className="px-2 py-1 rounded-lg bg-[#1d1d1f] dark:bg-white text-white dark:text-[#1d1d1f] text-xs font-medium"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => { setEditingId(null); setEditAmount("") }}
                        className="px-2 py-1 rounded-lg text-xs text-[#86868b]"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <>
                      <button
                        onClick={() => { setEditingId(budget.id); setEditAmount(String(budget.amount)) }}
                        className="p-1.5 rounded-lg hover:bg-[#f5f5f7] dark:hover:bg-[#2c2c2e] transition-all"
                      >
                        <Pencil className="w-3.5 h-3.5 text-[#86868b]" />
                      </button>
                      <button
                        onClick={() => removeBudget(budget.id)}
                        className="p-1.5 rounded-lg hover:bg-[#f5f5f7] dark:hover:bg-[#2c2c2e] transition-all"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-[#86868b]" />
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Progress bar */}
              <div className="w-full h-1.5 bg-[#f5f5f7] dark:bg-[#2c2c2e] rounded-full overflow-hidden mb-2">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    isOver ? "bg-red-500" : pct > 70 ? "bg-amber-500" : "bg-[#1d1d1f] dark:bg-white"
                  }`}
                  style={{ width: `${pct}%` }}
                />
              </div>

              <div className="flex justify-between text-xs text-[#86868b]">
                <span>
                  {formatCurrency(spent)} / {formatCurrency(budgetAmt)}
                </span>
                <span className={isOver ? "text-red-500 font-medium" : ""}>
                  {isOver
                    ? `${formatCurrency(spent - budgetAmt)} over`
                    : `${formatCurrency(remaining)} left`}
                </span>
              </div>
            </div>
          )
        })}

      {/* Empty list with budgets = 0 handled above */}
    </div>
  )
}
