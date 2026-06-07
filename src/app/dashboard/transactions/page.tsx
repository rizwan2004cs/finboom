"use client"

import { Suspense, useEffect, useState } from "react"
import { useUser } from "@/hooks/use-auth"
import { useProfile } from "@/hooks/use-profile"
import { useSearchParams } from "next/navigation"
import { useOfflineQuery } from "@/hooks/use-offline-query"
import { deleteRow } from "@/lib/offline"
import { createClient } from "@/utils/supabase/client"
import { useQueryClient } from "@tanstack/react-query"
import { Plus, ArrowUpCircle, ArrowDownCircle, Trash2, Edit2, Receipt } from "lucide-react"
import type { Transaction } from "@/lib/types"
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from "@/lib/constants"
import { CategoryIcon } from "@/components/category-icon"
import { AddTransactionModal } from "@/components/modals/add-transaction-modal"
import { useAppDialog } from "@/components/app-dialog"
import { useCurrency } from "@/hooks/use-currency"

export default function TransactionsPageWrapper() {
  return (
    <Suspense fallback={<div className="space-y-4">{[1,2,3].map(i => <div key={i} className="h-20 liquid-glass rounded-2xl animate-pulse" />)}</div>}>
      <TransactionsPage />
    </Suspense>
  )
}

function TransactionsPage() {
  const { formatCompact: formatCurrency, symbol: currencySymbol } = useCurrency()
  const { user } = useUser()
  const { activeProfile } = useProfile()
  const searchParams = useSearchParams()
  const queryClient = useQueryClient()
  const [showAddModal, setShowAddModal] = useState(false)
  const [editTransaction, setEditTransaction] = useState<Transaction | null>(null)
  const [typeFilter, setTypeFilter] = useState<"all" | "income" | "expense">("all")
  const [monthFilter, setMonthFilter] = useState(
    new Date().toISOString().slice(0, 7) // YYYY-MM
  )

  const startDate = `${monthFilter}-01`
  const endDate = new Date(parseInt(monthFilter.slice(0, 4)), parseInt(monthFilter.slice(5, 7)), 0)
    .toISOString().slice(0, 10)

  const { data: transactions = [], isLoading: loading } = useOfflineQuery<Transaction>(
    "transactions", user?.id, {
      filters: [
        { column: "profile_id", op: "eq", value: activeProfile?.id ?? "" },
        { column: "date", op: "gte", value: startDate },
        { column: "date", op: "lte", value: endDate },
      ],
      order: { column: "date", ascending: false },
      enabled: !!activeProfile,
      queryKey: [monthFilter],
    }
  )

  useEffect(() => {
    if (searchParams.get("action") === "add") setShowAddModal(true)
  }, [searchParams])

  const { showConfirm } = useAppDialog()

  async function deleteTransaction(id: string) {
    await showConfirm("Delete this transaction?", {
      destructive: true,
      onConfirm: async () => {
        // Also delete any linked party_transaction (expense mapped to receivable)
        try {
          const supabase = createClient()
          const { data: linked } = await supabase
            .from("party_transactions")
            .select("id")
            .eq("linked_transaction_id", id)
          if (linked && linked.length > 0) {
            for (const pt of linked) {
              await deleteRow("party_transactions", pt.id)
            }
          }
        } catch (e) {
          console.warn("Could not delete linked party transactions:", e)
        }

        await deleteRow("transactions", id)
        queryClient.invalidateQueries({ queryKey: ["transactions"] })
        queryClient.invalidateQueries({ queryKey: ["party_transactions"] })
      },
    })
  }

  const filtered = transactions.filter(t => typeFilter === "all" || t.type === typeFilter)
  
  const totalIncome = transactions
    .filter(t => t.type === "income")
    .reduce((sum, t) => sum + Number(t.amount), 0)
  const totalExpense = transactions
    .filter(t => t.type === "expense")
    .reduce((sum, t) => sum + Number(t.amount), 0)
  const savings = totalIncome - totalExpense
  const savingsRate = totalIncome > 0 ? (savings / totalIncome) * 100 : 0

  // Group by date
  const grouped = filtered.reduce((acc, t) => {
    const date = t.date
    if (!acc[date]) acc[date] = []
    acc[date].push(t)
    return acc
  }, {} as Record<string, Transaction[]>)

  if (loading || !user || !activeProfile) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="skeleton h-7 w-36 rounded-lg" />
          <div className="skeleton h-9 w-28 rounded-xl" />
        </div>
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="liquid-glass rounded-2xl p-4 flex items-center gap-4">
            <div className="skeleton h-10 w-10 rounded-full" />
            <div className="flex-1 space-y-2">
              <div className="skeleton h-4 w-28 rounded-lg" />
              <div className="skeleton h-3 w-16 rounded-lg" />
            </div>
            <div className="skeleton h-5 w-16 rounded-lg" />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4" data-tour-page="transactions">
      {/* Header */}
      <div className="flex items-center justify-between" data-tour-el="transactions-header">
        <div>
          <h1 className="text-xl font-bold text-[#1d1d1f] dark:text-white">Transactions</h1>
          <p className="text-sm text-[#86868b]">Income & Expenses</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-1.5 liquid-glass-btn-primary"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Add</span>
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="liquid-glass rounded-2xl p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <ArrowUpCircle className="w-3.5 h-3.5 text-[#1d1d1f] dark:text-white" />
            <p className="text-[10px] uppercase tracking-wider text-[#86868b]">Income</p>
          </div>
          <p className="text-lg font-bold text-[#1d1d1f] dark:text-white">{formatCurrency(totalIncome)}</p>
        </div>
        <div className="liquid-glass rounded-2xl p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <ArrowDownCircle className="w-3.5 h-3.5 text-[#6e6e73] dark:text-[#aeaeb2]" />
            <p className="text-[10px] uppercase tracking-wider text-[#86868b]">Expense</p>
          </div>
          <p className="text-lg font-bold text-[#1d1d1f] dark:text-white">{formatCurrency(totalExpense)}</p>
        </div>
        <div className="liquid-glass rounded-2xl p-3">
          <p className="text-[10px] uppercase tracking-wider text-[#86868b] mb-1">Savings Rate</p>
          <p className="text-lg font-bold text-[#1d1d1f] dark:text-white">
            {savingsRate.toFixed(0)}%
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        <input
          type="month"
          value={monthFilter}
          onChange={(e) => setMonthFilter(e.target.value)}
          className="px-3 py-2 rounded-xl bg-[#f5f5f7] dark:bg-[#2c2c2e] text-sm text-[#1d1d1f] dark:text-white border-0 focus:outline-none focus:ring-2 focus:ring-[#1d1d1f]/10 dark:focus:ring-white/10"
        />
        <div className="flex bg-[#f5f5f7] dark:bg-[#2c2c2e] rounded-xl p-0.5">
          {(["all", "income", "expense"] as const).map(type => (
            <button
              key={type}
              onClick={() => setTypeFilter(type)}
              className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                typeFilter === type
                  ? "bg-[#ffffff] dark:bg-[#3a3a3c] text-[#1d1d1f] dark:text-white shadow-sm"
                  : "text-[#86868b] dark:text-[#98989d]"
              }`}
            >
              {type.charAt(0).toUpperCase() + type.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Transaction List */}
      {Object.keys(grouped).length === 0 ? (
        <div className="liquid-glass rounded-2xl p-8 text-center">
          <div className="w-12 h-12 rounded-xl bg-white/50 backdrop-blur-sm flex items-center justify-center mx-auto mb-3">
            <Receipt className="w-6 h-6 text-[#86868b]" strokeWidth={1.5} />
          </div>
          <p className="font-medium text-[#1d1d1f] dark:text-white">No transactions yet</p>
          <p className="text-sm text-[#86868b] mt-1">Log your income and expenses</p>
          <button
            onClick={() => setShowAddModal(true)}
            className="mt-4 liquid-glass-btn-primary"
          >
            Add Transaction
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(grouped).map(([date, txns]) => (
            <div key={date}>
              <p className="text-xs font-medium text-[#86868b] mb-2 px-1">
                {new Date(date).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}
              </p>
              <div className="space-y-2">
                {txns.map((t) => {
                  const cats = t.type === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES
                  const cat = cats.find(c => c.id === t.category)
                  return (
                    <div key={t.id} className="liquid-glass rounded-2xl p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-white/50 backdrop-blur-sm flex items-center justify-center">
                          <CategoryIcon name={cat?.icon || "MoreHorizontal"} className="w-4.5 h-4.5 text-[#1d1d1f] dark:text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-[#1d1d1f] dark:text-white text-sm leading-snug break-words">
                            {t.description || cat?.label || t.category}
                          </p>
                          <p className="text-xs text-[#86868b]">{cat?.label}</p>
                        </div>
                        <div className="text-right">
                          <p className={`font-semibold ${t.type === "income" ? "text-[#1d1d1f] dark:text-white" : "text-[#6e6e73] dark:text-[#aeaeb2]"}`}>
                            {t.type === "income" ? "+" : "-"}{formatCurrency(Number(t.amount))}
                          </p>
                        </div>
                        <div className="flex gap-1 ml-1">
                          <button
                            onClick={() => setEditTransaction(t)}
                            className="p-1.5 rounded-lg hover:bg-[#f5f5f7] transition-all"
                          >
                            <Edit2 className="w-3.5 h-3.5 text-[#86868b]" />
                          </button>
                          <button
                            onClick={() => deleteTransaction(t.id)}
                            className="p-1.5 rounded-lg hover:bg-[#f5f5f7] transition-all"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-[#86868b]" />
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {(showAddModal || editTransaction) && (
        <AddTransactionModal
          transaction={editTransaction}
          onClose={() => { setShowAddModal(false); setEditTransaction(null) }}
          onSave={() => { setShowAddModal(false); setEditTransaction(null); queryClient.invalidateQueries({ queryKey: ["transactions"] }) }}
        />
      )}
    </div>
  )
}
