"use client"

import { Suspense, useEffect, useMemo, useRef, useState } from "react"
import { useUser } from "@/hooks/use-auth"
import { useProfile } from "@/hooks/use-profile"
import { useSearchParams } from "next/navigation"
import { useOfflineQuery } from "@/hooks/use-offline-query"
import { deleteRow } from "@/lib/offline"
import { useQueryClient } from "@tanstack/react-query"
import { Plus, ArrowUpCircle, ArrowDownCircle, Trash2, Edit2, Receipt, User, Download } from "lucide-react"
import type { Transaction, Party, PartyTransaction, Sip } from "@/lib/types"
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, ACCOUNT_MOVEMENT_CATEGORIES } from "@/lib/constants"
import { isAccountMovement } from "@/lib/finance/accounts"
import { deleteTransactionWithLinks } from "@/lib/finance/delete-transaction"
import { useAccounts } from "@/hooks/use-accounts"
import { CustomSelect } from "@/components/custom-select"
import { CategoryIcon } from "@/components/category-icon"
import { AccountTypeIcon } from "@/components/account-type-icon"
import { AddTransactionModal } from "@/components/modals/add-transaction-modal"
import { StatementModal } from "@/components/modals/statement-modal"
import { SipMonthChecklist } from "@/components/sip-month-checklist"
import { useSipPayments } from "@/hooks/use-sip-payments"
import { useAppDialog } from "@/components/app-dialog"
import { useCurrency } from "@/hooks/use-currency"
import { formatDueDate, todayLocalISO } from "@/lib/utils"
import { TransactionCategoryBreakdown } from "@/components/transactions/category-breakdown"
import { monthKeyFromDate, sipStatusForMonth, sumCashflow } from "@/lib/finance/monthly-cashflow"

const LEGACY_MONTH_FORWARD_DESCRIPTION = "Previous month's forward"

export default function TransactionsPageWrapper() {
  return (
    <Suspense fallback={<div className="space-y-4">{[1,2,3].map(i => <div key={i} className="h-20 liquid-glass rounded-2xl animate-pulse" />)}</div>}>
      <TransactionsPage />
    </Suspense>
  )
}

function TransactionsPage() {
  const { formatCurrency, symbol: currencySymbol } = useCurrency()
  const { user } = useUser()
  const { activeProfile } = useProfile()
  const searchParams = useSearchParams()
  const queryClient = useQueryClient()
  const [showAddModal, setShowAddModal] = useState(false)
  const [showStatement, setShowStatement] = useState(false)
  const [editTransaction, setEditTransaction] = useState<Transaction | null>(null)
  const [typeFilter, setTypeFilter] = useState<"all" | "income" | "expense">("all")
  // "all" | account id | "none" (transactions not tagged with any account)
  const [accountFilter, setAccountFilter] = useState<string>("all")
  const [monthFilter, setMonthFilter] = useState(
    // Local month key — toISOString() is UTC and shows the previous month to
    // IST users between midnight and 05:30 on the 1st.
    monthKeyFromDate() // YYYY-MM
  )

  const startDate = `${monthFilter}-01`
  // Build the last-day string from local parts. Using toISOString() here shifted
  // the boundary back a day in IST, dropping transactions dated on the 31st.
  const lastDayOfMonth = new Date(parseInt(monthFilter.slice(0, 4)), parseInt(monthFilter.slice(5, 7)), 0).getDate()
  const endDate = `${monthFilter}-${String(lastDayOfMonth).padStart(2, "0")}`

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

  // Pull party links so an expense "spent for" a party (or a party entry that
  // auto-created this transaction) can show the party name + its due date here
  // — otherwise the due date only lives on the Parties page and the expenditure
  // looks like it has "no date", which was the source of the confusion.
  const { data: partyTxs = [] } = useOfflineQuery<PartyTransaction>(
    "party_transactions", user?.id, { enabled: !!user }
  )
  const { data: parties = [] } = useOfflineQuery<Party>(
    "parties", user?.id, { enabled: !!user }
  )

  const pf = activeProfile
    ? [{ column: "profile_id", op: "eq" as const, value: activeProfile.id }]
    : undefined

  const { data: sips = [] } = useOfflineQuery<Sip>(
    "sips", user?.id, { filters: pf, enabled: !!activeProfile }
  )
  const { data: sipPayments = [] } = useSipPayments(user?.id)
  const { accounts } = useAccounts()

  /** Full month, honouring the account filter — the base for the list and for
   *  every summary card, so the Savings Rate % and its "Left ₹X" subtitle
   *  describe the same set of transactions. */
  const accountMonthTransactions = useMemo(() => {
    const matchesAccount = (t: Transaction) =>
      accountFilter === "all" ||
      (accountFilter === "none" ? !t.account_id : t.account_id === accountFilter)
    return transactions.filter(matchesAccount)
  }, [transactions, accountFilter])

  const { unpaidSipAmount, leftAfterSips } = useMemo(() => {
    // SIP status must see the UNFILTERED month: a "SIP: <fund>" expense paid
    // from another account still marks that SIP paid.
    const { unpaidAmount } = sipStatusForMonth(sips, sipPayments, monthFilter, transactions)
    return {
      unpaidSipAmount: unpaidAmount,
      leftAfterSips: sumCashflow(accountMonthTransactions).surplus - unpaidAmount,
    }
  }, [transactions, accountMonthTransactions, sips, sipPayments, monthFilter])

  const currentCalendarMonth = monthKeyFromDate()

  // The app used to auto-insert a "Previous month's forward" income row on the
  // 1st. That feature is gone; remove any such row still sitting in the viewed
  // month so each month starts from zero.
  const legacyForwardCleanupRef = useRef<string | null>(null)
  useEffect(() => {
    if (!user || !activeProfile || loading) return
    const stale = transactions.filter(
      (t) =>
        t.type === "income" &&
        t.category === "other" &&
        t.description === LEGACY_MONTH_FORWARD_DESCRIPTION,
    )
    if (stale.length === 0) return
    const runKey = `${activeProfile.id}:${monthFilter}`
    if (legacyForwardCleanupRef.current === runKey) return
    legacyForwardCleanupRef.current = runKey
    ;(async () => {
      for (const t of stale) await deleteRow("transactions", t.id)
      queryClient.invalidateQueries({ queryKey: ["transactions"] })
    })()
  }, [user, activeProfile, loading, transactions, monthFilter, queryClient])

  const partyLinkByTxId = useMemo(() => {
    const partyName = new Map(parties.map(p => [p.id, p.name]))
    const map = new Map<string, { partyName: string; dueDate?: string }>()
    for (const pt of partyTxs) {
      if (!pt.linked_transaction_id) continue
      map.set(pt.linked_transaction_id, {
        partyName: partyName.get(pt.party_id) || "Party",
        dueDate: pt.due_date || undefined,
      })
    }
    return map
  }, [partyTxs, parties])

  useEffect(() => {
    if (searchParams.get("action") === "add") setShowAddModal(true)
  }, [searchParams])

  const { showConfirm } = useAppDialog()

  async function deleteTransaction(t: Transaction) {
    // A transfer is two linked legs — deleting only one would silently corrupt
    // both account balances, so the helper always removes the group together
    // (plus linked party entries and cached SIP payment rows).
    const message = t.transfer_group_id
      ? "Delete this transfer? Both sides of it will be removed."
      : "Delete this transaction?"
    await showConfirm(message, {
      destructive: true,
      onConfirm: async () => {
        await deleteTransactionWithLinks(user!.id, t, { sipPayments })
        queryClient.invalidateQueries({ queryKey: ["transactions"] })
        queryClient.invalidateQueries({ queryKey: ["party_transactions"] })
        queryClient.invalidateQueries({ queryKey: ["sip_payments"] })
      },
    })
  }

  const accountById = useMemo(() => new Map(accounts.map(a => [a.id, a])), [accounts])

  const filtered = accountMonthTransactions.filter(t =>
    typeFilter === "all" || t.type === typeFilter
  )

  const todayStr = todayLocalISO()

  /** Month-to-date for current month; full month for past months. Follows the
   *  account filter so the summary cards and Insights match the visible list. */
  const tillDateTransactions = useMemo(() => {
    if (monthFilter !== currentCalendarMonth) return accountMonthTransactions
    return accountMonthTransactions.filter((t) => t.date <= todayStr)
  }, [accountMonthTransactions, monthFilter, currentCalendarMonth, todayStr])

  const periodLabel = useMemo(() => {
    const [y, m] = monthFilter.split("-").map(Number)
    const monthName = new Date(y, m - 1, 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" })
    if (monthFilter === currentCalendarMonth) {
      const day = new Date().getDate()
      return `1–${day} ${monthName}`
    }
    return monthName
  }, [monthFilter, currentCalendarMonth])
  
  // Account movements (transfers/adjustments) shift money between own
  // accounts — they are not income or spending, so keep them out of the cards.
  const totalIncome = tillDateTransactions
    .filter(t => t.type === "income" && !isAccountMovement(t))
    .reduce((sum, t) => sum + Number(t.amount), 0)
  const totalExpense = tillDateTransactions
    .filter(t => t.type === "expense" && !isAccountMovement(t))
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
        <div className="flex gap-2">
          <button
            onClick={() => setShowStatement(true)}
            className="flex items-center gap-1.5 liquid-glass rounded-full px-3 py-2 text-sm font-medium text-[#1d1d1f] dark:text-white hover:shadow-md transition-all"
            aria-label="Download statement"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Statement</span>
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 liquid-glass-btn-primary"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Add</span>
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="liquid-glass rounded-2xl p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <ArrowUpCircle className="w-3.5 h-3.5 text-[#1d1d1f] dark:text-white" />
            <p className="text-[10px] uppercase tracking-wider text-[#86868b]">Income</p>
          </div>
          <p className="text-lg font-bold text-[#1d1d1f] dark:text-white">{formatCurrency(totalIncome)}</p>
          <p className="text-[10px] text-[#86868b] mt-0.5">{periodLabel}</p>
        </div>
        <div className="liquid-glass rounded-2xl p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <ArrowDownCircle className="w-3.5 h-3.5 text-[#6e6e73] dark:text-[#aeaeb2]" />
            <p className="text-[10px] uppercase tracking-wider text-[#86868b]">Expense</p>
          </div>
          <p className="text-lg font-bold text-[#1d1d1f] dark:text-white">{formatCurrency(totalExpense)}</p>
          <p className="text-[10px] text-[#86868b] mt-0.5">{periodLabel}</p>
        </div>
        <div className="liquid-glass rounded-2xl p-3">
          <p className="text-[10px] uppercase tracking-wider text-[#86868b] mb-1">Savings Rate</p>
          <p className="text-lg font-bold text-[#1d1d1f] dark:text-white">
            {savingsRate.toFixed(0)}%
          </p>
          <p className="text-[10px] text-[#86868b] mt-1">
            {unpaidSipAmount > 0
              ? leftAfterSips >= 0
                ? `Left ${formatCurrency(leftAfterSips)} after ${formatCurrency(unpaidSipAmount)} SIPs`
                : `Short ${formatCurrency(-leftAfterSips)} for ${formatCurrency(unpaidSipAmount)} SIPs`
              : `Left ${formatCurrency(leftAfterSips)}`}
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
        {accounts.length > 0 && (
          <CustomSelect
            value={accountFilter}
            onChange={setAccountFilter}
            options={[
              { value: "all", label: "All accounts" },
              ...accounts.map(a => ({ value: a.id, label: a.name })),
              { value: "none", label: "No account" },
            ]}
            className="min-w-[150px]"
            searchable
          />
        )}
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

      {sips.some((s) => s.active) && (
        <SipMonthChecklist
          sips={sips}
          profileId={activeProfile.id}
          monthKey={monthFilter}
          transactions={transactions}
        />
      )}

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
                {/* "T00:00:00" forces local parsing — a bare date string is UTC
                    and renders one day early west of UTC. */}
                {new Date(`${date}T00:00:00`).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}
              </p>
              <div className="space-y-2">
                {txns.map((t) => {
                  const cats = t.type === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES
                  const cat = cats.find(c => c.id === t.category)
                    ?? ACCOUNT_MOVEMENT_CATEGORIES.find(c => c.id === t.category)
                  const movement = isAccountMovement(t)
                  const account = t.account_id ? accountById.get(t.account_id) : undefined
                  const link = partyLinkByTxId.get(t.id)
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
                          {account && (
                            <p className="text-xs text-[#86868b] mt-0.5 flex items-center gap-1">
                              <AccountTypeIcon type={account.type} className="w-3 h-3 flex-shrink-0" />
                              <span className="truncate">{account.name}</span>
                            </p>
                          )}
                          {link && (
                            <p className="text-xs text-[#86868b] mt-0.5 flex items-center gap-1 flex-wrap">
                              <User className="w-3 h-3 flex-shrink-0" />
                              <span className="truncate">{link.partyName}</span>
                              {link.dueDate && (
                                <span className="flex-shrink-0">· Due {formatDueDate(link.dueDate)}</span>
                              )}
                            </p>
                          )}
                        </div>
                        <div className="text-right">
                          <p className={`font-semibold ${t.type === "income" ? "text-[#1d1d1f] dark:text-white" : "text-[#6e6e73] dark:text-[#aeaeb2]"}`}>
                            {t.type === "income" ? "+" : "-"}{formatCurrency(Number(t.amount))}
                          </p>
                        </div>
                        <div className="flex gap-1 ml-1">
                          {/* Transfer/adjustment entries — and any leg that
                              shares a transfer_group_id, like the card-bill
                              expense a Transfer creates — are managed from
                              the Cash & Bank page. Free-form edits here would
                              desync the linked leg or the corrected balance. */}
                          {!movement && !t.transfer_group_id && (
                            <button
                              onClick={() => setEditTransaction(t)}
                              className="p-1.5 rounded-lg hover:bg-[#f5f5f7] transition-all"
                            >
                              <Edit2 className="w-3.5 h-3.5 text-[#86868b]" />
                            </button>
                          )}
                          <button
                            onClick={() => deleteTransaction(t)}
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

      <div className="pt-5 mt-3 border-t border-dashed border-[#d1d1d6]/80 dark:border-white/10">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-[#86868b] mb-3 px-1">
          Insights
        </p>
        <TransactionCategoryBreakdown
          transactions={tillDateTransactions}
          periodLabel={periodLabel}
        />
      </div>

      {showStatement && (
        <StatementModal
          onClose={() => setShowStatement(false)}
          accounts={accounts}
          initialAccountId={
            accountFilter !== "all" && accountFilter !== "none" ? accountFilter : ""
          }
        />
      )}

      {(showAddModal || editTransaction) && (
        <AddTransactionModal
          transaction={editTransaction}
          onClose={() => { setShowAddModal(false); setEditTransaction(null) }}
          onSave={() => {
            setShowAddModal(false)
            setEditTransaction(null)
            queryClient.invalidateQueries({ queryKey: ["transactions"] })
            queryClient.invalidateQueries({ queryKey: ["party_transactions"] })
          }}
        />
      )}
    </div>
  )
}
