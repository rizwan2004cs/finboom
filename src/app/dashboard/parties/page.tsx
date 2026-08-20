"use client"

import { Suspense } from "react"
import { useEffect, useMemo, useRef, useState } from "react"
import { useUser } from "@/hooks/use-auth"
import { deleteRow, fetchTable } from "@/lib/offline"
import { useOfflineQuery } from "@/hooks/use-offline-query"
import { useQueryClient } from "@tanstack/react-query"
import { useSearchParams } from "next/navigation"
import {
  Plus,
  ArrowUpRight,
  ArrowDownLeft,
  ArrowDownRight,
  ArrowUpLeft,
  Trash2,
  Pencil,
  Clock,
  AlertCircle,
  CheckCircle2,
  User,
  HandCoins,
  ChevronLeft,
} from "lucide-react"
import type { Party, PartyTransaction, Transaction } from "@/lib/types"
import { AddPartyTransactionModal } from "@/components/modals/add-party-transaction-modal"
import { AddPartyModal } from "@/components/modals/add-party-modal"
import { EditPartyModal } from "@/components/modals/edit-party-modal"
import { useCurrency } from "@/hooks/use-currency"
import { formatDueDate, todayLocalISO } from "@/lib/utils"

const typeConfig = {
  lent: { label: "Gave", icon: ArrowUpRight, color: "text-red-600", bg: "bg-red-50 dark:bg-red-500/10" },
  received_back: { label: "Received Back", icon: ArrowDownLeft, color: "text-green-600", bg: "bg-green-50 dark:bg-green-500/10" },
  borrowed: { label: "Borrowed", icon: ArrowDownRight, color: "text-orange-600", bg: "bg-orange-50 dark:bg-orange-500/10" },
  paid_back: { label: "Paid Back", icon: ArrowUpLeft, color: "text-blue-600", bg: "bg-blue-50 dark:bg-blue-500/10" },
}

// Filter options for the Transactions tab (by entry type) and the Parties tab
// (by net balance status). "Receivable" = parties who owe you, "Payable" =
// parties you owe, "Settled" = net zero.
type TxFilter = "all" | keyof typeof typeConfig
type PartyBalanceFilter = "all" | "receivable" | "payable" | "settled"

const TX_FILTERS: { id: TxFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "lent", label: "Gave" },
  { id: "received_back", label: "Received Back" },
  { id: "borrowed", label: "Borrowed" },
  { id: "paid_back", label: "Paid Back" },
]

const PARTY_FILTERS: { id: PartyBalanceFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "receivable", label: "Receivable" },
  { id: "payable", label: "Payable" },
  { id: "settled", label: "Settled" },
]

function PartiesPageInner() {
  const { formatCompact: formatCurrency } = useCurrency()
  const { user } = useUser()
  const searchParams = useSearchParams()
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<"transactions" | "parties">("transactions")
  const [showAddTransaction, setShowAddTransaction] = useState(false)
  const [showAddParty, setShowAddParty] = useState(false)
  const [settlePartyId, setSettlePartyId] = useState<string | null>(null)
  const [settleType, setSettleType] = useState<"received_back" | "paid_back">("received_back")
  // Entry-level settle target: id of the lent/borrowed entry plus its
  // outstanding remainder (prefills the modal amount).
  const [settleTarget, setSettleTarget] = useState<{ id: string; amount: number } | null>(null)
  const [selectedPartyId, setSelectedPartyId] = useState<string | null>(null)
  const [editingParty, setEditingParty] = useState<Party | null>(null)
  const [deletingPartyId, setDeletingPartyId] = useState<string | null>(null)
  const [txFilter, setTxFilter] = useState<TxFilter>("all")
  const [partyFilter, setPartyFilter] = useState<PartyBalanceFilter>("all")

  const { data: parties = [], isLoading: loadingParties } = useOfflineQuery<Party>(
    "parties", user?.id, { order: { column: "name", ascending: true } }
  )
  const { data: rawTx = [], isLoading: loadingTx } = useOfflineQuery<PartyTransaction>(
    "party_transactions", user?.id, { order: { column: "date", ascending: false } }
  )
  const loading = loadingParties || loadingTx

  const transactions = useMemo(() => {
    const partyMap = new Map(parties.map(p => [p.id, p]))
    return rawTx
      .map(tx => ({ ...tx, party: partyMap.get(tx.party_id) as Party }))
      .filter(tx => tx.party)
  }, [parties, rawTx])

  const filteredTransactions = useMemo(
    () => (txFilter === "all" ? transactions : transactions.filter(tx => tx.type === txFilter)),
    [transactions, txFilter],
  )

  const invalidateParties = () => {
    queryClient.invalidateQueries({ queryKey: ["parties"] })
    queryClient.invalidateQueries({ queryKey: ["party_transactions"] })
  }

  useEffect(() => {
    if (searchParams.get("action") === "add") setShowAddTransaction(true)
  }, [searchParams])

  // Legacy entries (no linked_transaction_id) get their auto-created transaction
  // matched by description/amount/date. Goes through the offline data layer so
  // the cached list is searched when the network is down, and re-verifies the
  // match locally because fetchTable's failure fallback returns the unfiltered
  // cache. Returns false when the lookup itself failed — callers must then keep
  // the ledger entry rather than silently orphaning the linked transaction.
  async function deleteLegacyLinkedTransaction(ptx: PartyTransaction & { party?: Party }): Promise<boolean> {
    const partyName = ptx.party?.name || ""
    const descMap: Record<string, { type: string; desc: string }> = {
      lent: { type: "expense", desc: `Lent to ${partyName}` },
      received_back: { type: "income", desc: `Received back from ${partyName}` },
      borrowed: { type: "income", desc: `Borrowed from ${partyName}` },
      paid_back: { type: "expense", desc: `Paid back to ${partyName}` },
    }
    const expected = descMap[ptx.type]
    if (!expected || !partyName) return true
    try {
      const rows = await fetchTable<Transaction>("transactions", ptx.user_id, {
        filters: [
          { column: "type", op: "eq", value: expected.type },
          { column: "description", op: "eq", value: expected.desc },
          { column: "date", op: "eq", value: ptx.date },
        ],
      })
      const linked = rows.find(
        t =>
          t.type === expected.type &&
          t.description === expected.desc &&
          t.date === ptx.date &&
          Number(t.amount) === Number(ptx.amount),
      )
      if (linked) await deleteRow("transactions", linked.id)
      return true
    } catch {
      return false
    }
  }

  // In-flight guard: a double-click re-enters before the cache invalidates,
  // and the legacy description-match could then delete a *twin* entry's
  // linked transaction while the first delete is still settling.
  const deleteInFlightRef = useRef(false)

  async function handleDelete(id: string) {
    if (deleteInFlightRef.current) return
    deleteInFlightRef.current = true
    try {
      const ptx = transactions.find(tx => tx.id === id)
      if (ptx) {
        if (ptx.linked_transaction_id) {
          // Direct link exists
          await deleteRow("transactions", ptx.linked_transaction_id)
        } else if (!(await deleteLegacyLinkedTransaction(ptx))) {
          window.dispatchEvent(
            new CustomEvent("finboom:write-error", {
              detail: "Couldn't reach the linked transaction — nothing was deleted. Try again.",
            }),
          )
          return
        }
      }
      await deleteRow("party_transactions", id)
      invalidateParties()
    } finally {
      deleteInFlightRef.current = false
    }
  }

  async function handleDeleteParty(id: string) {
    if (deleteInFlightRef.current) return
    deleteInFlightRef.current = true
    try {
      // Delete linked transactions for all party_transactions of this party
      const partyTxs = transactions.filter(tx => tx.party_id === id)
      for (const ptx of partyTxs) {
        if (ptx.linked_transaction_id) {
          await deleteRow("transactions", ptx.linked_transaction_id)
        } else if (!(await deleteLegacyLinkedTransaction(ptx))) {
          window.dispatchEvent(
            new CustomEvent("finboom:write-error", {
              detail: "Couldn't reach linked transactions — party not deleted. Try again.",
            }),
          )
          setDeletingPartyId(null)
          return
        }
      }
      await deleteRow("parties", id)
      setDeletingPartyId(null)
      setSelectedPartyId(null)
      invalidateParties()
    } finally {
      deleteInFlightRef.current = false
    }
  }

  // Calculate net balance per party
  const partyBalances = useMemo(() => {
    const map = new Map<string, { party: Party; balance: number; txCount: number }>()

    for (const p of parties) {
      map.set(p.id, { party: p, balance: 0, txCount: 0 })
    }

    for (const tx of transactions) {
      const entry = map.get(tx.party_id)
      if (!entry) continue
      entry.txCount++
      if (tx.type === "lent") entry.balance += Number(tx.amount)
      else if (tx.type === "received_back") entry.balance -= Number(tx.amount)
      else if (tx.type === "borrowed") entry.balance -= Number(tx.amount)
      else if (tx.type === "paid_back") entry.balance += Number(tx.amount)
    }

    return Array.from(map.values()).sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance))
  }, [parties, transactions])

  const filteredPartyBalances = useMemo(() => {
    if (partyFilter === "receivable") return partyBalances.filter(p => p.balance > 0)
    if (partyFilter === "payable") return partyBalances.filter(p => p.balance < 0)
    if (partyFilter === "settled") return partyBalances.filter(p => p.balance === 0)
    return partyBalances
  }, [partyBalances, partyFilter])

  const totalReceivable = partyBalances
    .filter(p => p.balance > 0)
    .reduce((sum, p) => sum + p.balance, 0)
  const totalPayable = partyBalances
    .filter(p => p.balance < 0)
    .reduce((sum, p) => sum + Math.abs(p.balance), 0)

  // Net outstanding per party (used for summary cards and settle actions).
  const balanceByParty = new Map(partyBalances.map(p => [p.party.id, p.balance]))

  // Remaining outstanding per individual obligation. Repayments created via an
  // entry's Settle button carry settles_transaction_id and reduce THAT entry
  // first; any unlinked repayment (or the overflow of a linked one) is
  // allocated FIFO — oldest obligation first. This lets a fully-repaid entry
  // drop off the overdue list even when the party still has other open
  // obligations, and settling a specific entry can no longer be absorbed by an
  // older one.
  const outstandingByTx = useMemo(() => {
    const remaining = new Map<string, number>()
    const byParty = new Map<string, PartyTransaction[]>()
    for (const tx of transactions) {
      const list = byParty.get(tx.party_id)
      if (list) list.push(tx)
      else byParty.set(tx.party_id, [tx])
    }
    const allocate = (txs: PartyTransaction[], obligation: string, repayment: string) => {
      const obligations = txs
        .filter(t => t.type === obligation)
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      const open = new Map(obligations.map(o => [o.id, Number(o.amount)]))

      // Phase 1: targeted repayments hit their linked entry; overflow (and
      // repayments without a link) feed the FIFO pool.
      let pool = 0
      for (const t of txs.filter(t => t.type === repayment)) {
        const target = t.settles_transaction_id
        const cur = target ? open.get(target) : undefined
        if (target && cur !== undefined) {
          const used = Math.min(cur, Number(t.amount))
          open.set(target, cur - used)
          pool += Number(t.amount) - used
        } else {
          pool += Number(t.amount)
        }
      }

      // Phase 2: FIFO the pool over whatever is still open.
      for (const ob of obligations) {
        const cur = open.get(ob.id) ?? 0
        const used = Math.min(cur, pool)
        pool -= used
        remaining.set(ob.id, cur - used)
      }
    }
    for (const txs of byParty.values()) {
      allocate(txs, "lent", "received_back")
      allocate(txs, "borrowed", "paid_back")
    }
    return remaining
  }, [transactions])

  // An obligation is unsettled while it still has an outstanding remainder.
  const isUnsettled = (tx: PartyTransaction) => {
    if (tx.type !== "lent" && tx.type !== "borrowed") return false
    return (outstandingByTx.get(tx.id) ?? Number(tx.amount)) > 0
  }

  // Due within 30 days — sum the individual due-dated entries (NOT the whole
  // party net balance), so setting a due date on one transaction doesn't pull
  // the entire party balance into this card. Cap each party's contribution at
  // its net outstanding so a partial repayment can't overstate what's due.
  // Compare YYYY-MM-DD strings in local time. `new Date("YYYY-MM-DD")` parses
  // as UTC midnight, which made entries due *today* read as overdue from
  // 05:30 IST and simultaneously drop out of the due-soon window.
  const todayStr = todayLocalISO()
  const in30Days = new Date()
  in30Days.setDate(in30Days.getDate() + 30)
  const plus30Str = `${in30Days.getFullYear()}-${String(in30Days.getMonth() + 1).padStart(2, "0")}-${String(in30Days.getDate()).padStart(2, "0")}`
  const dueSoon = transactions.filter(tx => {
    if (!tx.due_date || !isUnsettled(tx)) return false
    return tx.due_date >= todayStr && tx.due_date <= plus30Str
  })
  const dueSoonAmount = dueSoon.reduce(
    (sum, tx) => sum + (outstandingByTx.get(tx.id) ?? Number(tx.amount)),
    0,
  )

  // Overdue items — still-outstanding receivables and payables past their due date.
  const overdue = transactions.filter(tx => {
    if (!tx.due_date || !isUnsettled(tx)) return false
    return tx.due_date < todayStr
  })

  function handleSettle(
    partyId: string,
    balance: number,
    target?: { id: string; amount: number }
  ) {
    setSettlePartyId(partyId)
    setSettleType(balance > 0 ? "received_back" : "paid_back")
    setSettleTarget(target ?? null)
    setShowAddTransaction(true)
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div><div className="skeleton h-7 w-32 rounded-xl" /><div className="skeleton h-4 w-48 rounded-lg mt-1" /></div>
          <div className="skeleton h-10 w-10 rounded-xl" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="liquid-glass rounded-2xl p-5 space-y-3">
              <div className="skeleton h-4 w-20 rounded-lg" />
              <div className="skeleton h-8 w-32 rounded-lg" />
            </div>
          ))}
        </div>
        {[1, 2, 3].map(i => (
          <div key={i} className="liquid-glass rounded-2xl p-4">
            <div className="skeleton h-5 w-full rounded-lg" />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6" data-tour-page="parties">
      {/* Header */}
      <div className="flex items-center justify-between" data-tour-el="parties-header">
        <div>
          <h1 className="text-[24px] font-semibold tracking-[-0.3px] text-[#1d1d1f] dark:text-white">Parties</h1>
          <p className="text-[14px] text-[#86868b] mt-0.5">Track money given & received</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowAddParty(true)}
            className="p-2.5 rounded-xl bg-white/50 dark:bg-white/[0.06] backdrop-blur-sm border border-white/40 dark:border-white/[0.08] hover:bg-white/70 dark:hover:bg-white/[0.1] transition-all"
            title="Add party"
          >
            <User className="w-5 h-5 text-[#1d1d1f] dark:text-white" />
          </button>
          <button
            onClick={() => { setSettlePartyId(null); setShowAddTransaction(true) }}
            className="p-2.5 rounded-xl bg-[#1d1d1f] text-white hover:opacity-90 transition-all"
            title="Add transaction"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="liquid-glass rounded-2xl p-5">
          <div className="flex items-center justify-between">
            <p className="text-[14px] text-[#86868b] font-medium">To Receive</p>
            <div className="w-9 h-9 rounded-xl bg-green-50 dark:bg-green-500/10 flex items-center justify-center">
              <ArrowDownLeft className="w-5 h-5 text-green-600" />
            </div>
          </div>
          <p className="text-[28px] font-semibold mt-2 text-green-700 dark:text-green-500">{formatCurrency(totalReceivable)}</p>
          <p className="text-[12px] text-[#86868b] mt-1">
            {partyBalances.filter(p => p.balance > 0).length} parties owe you
          </p>
        </div>

        <div className="liquid-glass rounded-2xl p-5">
          <div className="flex items-center justify-between">
            <p className="text-[14px] text-[#86868b] font-medium">To Pay</p>
            <div className="w-9 h-9 rounded-xl bg-red-50 dark:bg-red-500/10 flex items-center justify-center">
              <ArrowUpRight className="w-5 h-5 text-red-600" />
            </div>
          </div>
          <p className="text-[28px] font-semibold mt-2 text-red-700 dark:text-red-500">{formatCurrency(totalPayable)}</p>
          <p className="text-[12px] text-[#86868b] mt-1">
            {partyBalances.filter(p => p.balance < 0).length} parties you owe
          </p>
        </div>

        <div className="liquid-glass rounded-2xl p-5">
          <div className="flex items-center justify-between">
            <p className="text-[14px] text-[#86868b] font-medium">Due in 30 Days</p>
            <div className="w-9 h-9 rounded-xl bg-orange-50 dark:bg-orange-500/10 flex items-center justify-center">
              <Clock className="w-5 h-5 text-orange-600" />
            </div>
          </div>
          <p className="text-[28px] font-semibold mt-2 text-orange-700 dark:text-orange-500">{formatCurrency(dueSoonAmount)}</p>
          <p className="text-[12px] text-[#86868b] mt-1">{dueSoon.length} {dueSoon.length === 1 ? "entry" : "entries"} upcoming</p>
        </div>
      </div>

      {/* Overdue alerts */}
      {overdue.length > 0 && (
        <div className="liquid-glass rounded-2xl p-4 border border-red-200/80 dark:border-red-500/20 bg-red-50/40 dark:bg-red-500/5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-full bg-red-100 dark:bg-red-500/15 flex items-center justify-center">
              <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-red-800 dark:text-red-400">Overdue</p>
              <p className="text-[11px] text-red-600/80 dark:text-red-400/80">{overdue.length} {overdue.length === 1 ? "entry" : "entries"} past due date</p>
            </div>
          </div>
          <div className="space-y-2">
            {overdue.map(tx => {
              const balance = balanceByParty.get(tx.party_id) ?? 0
              // "T00:00:00" forces local-time parsing; a bare date string is UTC.
              const due = new Date(`${tx.due_date!}T00:00:00`)
              due.setHours(0, 0, 0, 0)
              const now = new Date()
              now.setHours(0, 0, 0, 0)
              const daysLate = Math.floor((now.getTime() - due.getTime()) / 86400000)
              const isReceivable = tx.type === "lent"
              return (
                <div
                  key={tx.id}
                  className="flex items-center gap-3 p-3 rounded-xl bg-white/60 dark:bg-white/[0.04] border border-red-100 dark:border-red-500/10"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium text-[#1d1d1f] dark:text-white truncate">
                        {tx.party?.name ?? "Unknown"}
                      </p>
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-red-100 dark:bg-red-500/15 text-red-700 dark:text-red-400">
                        {daysLate}d late
                      </span>
                    </div>
                    <p className="text-[12px] text-[#86868b] mt-0.5">
                      {isReceivable ? "They owe you" : "You owe"} · due {formatDueDate(tx.due_date!)}
                    </p>
                  </div>
                  <p className="text-sm font-semibold text-red-700 dark:text-red-400 tabular-nums">
                    {formatCurrency(outstandingByTx.get(tx.id) ?? Number(tx.amount))}
                  </p>
                  {/* Direction comes from the entry being settled, not the
                      party's net balance — with mixed lent+borrowed entries
                      the net sign can point the repayment the wrong way. */}
                  <button
                    type="button"
                    onClick={() =>
                      handleSettle(tx.party_id, tx.type === "lent" ? 1 : -1, {
                        id: tx.id,
                        amount: outstandingByTx.get(tx.id) ?? Number(tx.amount),
                      })
                    }
                    className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#1d1d1f] dark:bg-white text-white dark:text-[#1d1d1f] hover:opacity-90 transition-opacity"
                  >
                    Settle
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Tab switcher */}
      <div className="flex bg-[#f5f5f7] dark:bg-[#2c2c2e] rounded-xl p-1">
        <button
          onClick={() => setTab("transactions")}
          className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${
            tab === "transactions" ? "bg-[#ffffff] dark:bg-[#3a3a3c] text-[#1d1d1f] dark:text-white shadow-sm" : "text-[#86868b] dark:text-[#98989d]"
          }`}
        >
          Transactions
        </button>
        <button
          onClick={() => setTab("parties")}
          className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${
            tab === "parties" ? "bg-[#ffffff] dark:bg-[#3a3a3c] text-[#1d1d1f] dark:text-white shadow-sm" : "text-[#86868b] dark:text-[#98989d]"
          }`}
        >
          Parties ({parties.length})
        </button>
      </div>

      {/* Transactions tab */}
      {tab === "transactions" && (
        <div className="space-y-3">
          {transactions.length === 0 ? (
            <div className="liquid-glass rounded-2xl p-8 text-center">
              <HandCoins className="w-10 h-10 text-[#86868b] mx-auto" />
              <p className="text-[15px] font-medium text-[#1d1d1f] dark:text-white mt-3">No party transactions yet</p>
              <p className="text-[13px] text-[#86868b] mt-1">Start tracking money given & received</p>
              <button
                onClick={() => setShowAddTransaction(true)}
                className="mt-4 px-5 py-2.5 rounded-xl bg-[#1d1d1f] text-white text-sm font-medium hover:opacity-90 transition-all"
              >
                Add First Entry
              </button>
            </div>
          ) : (
            <>
              {/* Type filter chips */}
              <div className="flex flex-wrap gap-2">
                {TX_FILTERS.map(f => (
                  <button
                    key={f.id}
                    onClick={() => setTxFilter(f.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                      txFilter === f.id
                        ? "bg-[#1d1d1f] text-white"
                        : "bg-white/50 dark:bg-white/[0.06] text-[#86868b] hover:bg-white/70 dark:hover:bg-white/[0.1]"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              {filteredTransactions.length === 0 ? (
                <div className="liquid-glass rounded-2xl p-6 text-center">
                  <p className="text-[13px] text-[#86868b]">No entries match this filter.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredTransactions.map(tx => {
                    const config = typeConfig[tx.type]
                    const Icon = config.icon
                    const isOverdue = tx.due_date && tx.due_date < todayStr && isUnsettled(tx)
                    return (
                      <div key={tx.id} className="liquid-glass rounded-2xl p-4 flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl ${config.bg} flex items-center justify-center flex-shrink-0`}>
                          <Icon className={`w-5 h-5 ${config.color}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <p className="text-[14px] font-medium text-[#1d1d1f] dark:text-white truncate max-w-[120px] sm:max-w-none">{tx.party?.name}</p>
                            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-md flex-shrink-0 ${config.bg} ${config.color}`}>
                              {config.label}
                            </span>
                            {isOverdue && (
                              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-red-100 dark:bg-red-500/10 text-red-700 dark:text-red-400 flex-shrink-0">
                                Overdue
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5 overflow-hidden">
                            <p className="text-[12px] text-[#86868b] flex-shrink-0">
                              {new Date(tx.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                            </p>
                            {tx.due_date && (
                              <p className="text-[12px] text-[#86868b] flex-shrink-0">
                                · Due {formatDueDate(tx.due_date)}
                              </p>
                            )}
                            {tx.notes && (
                              <p className="text-[12px] text-[#86868b] truncate">· {tx.notes}</p>
                            )}
                          </div>
                        </div>
                        <p className={`text-[15px] font-semibold tabular-nums whitespace-nowrap flex-shrink-0 ${
                          tx.type === "lent" || tx.type === "paid_back" ? "text-red-600" : "text-green-600"
                        }`}>
                          {tx.type === "lent" || tx.type === "paid_back" ? "-" : "+"}₹{Number(tx.amount).toLocaleString("en-IN")}
                        </p>
                        <button
                          onClick={() => handleDelete(tx.id)}
                          className="p-2 rounded-lg hover:bg-[#f5f5f7] dark:hover:bg-white/[0.08] transition-all flex-shrink-0"
                        >
                          <Trash2 className="w-4 h-4 text-[#86868b]" />
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Parties tab */}
      {tab === "parties" && (
        <div className="space-y-3">
          {partyBalances.length === 0 ? (
            <div className="liquid-glass rounded-2xl p-8 text-center">
              <User className="w-10 h-10 text-[#86868b] mx-auto" />
              <p className="text-[15px] font-medium text-[#1d1d1f] dark:text-white mt-3">No parties yet</p>
              <p className="text-[13px] text-[#86868b] mt-1">Add people you exchange money with</p>
              <button
                onClick={() => setShowAddParty(true)}
                className="mt-4 px-5 py-2.5 rounded-xl bg-[#1d1d1f] text-white text-sm font-medium hover:opacity-90 transition-all"
              >
                Add Party
              </button>
            </div>
          ) : selectedPartyId ? (() => {
            const entry = partyBalances.find(p => p.party.id === selectedPartyId)
            if (!entry) return null
            const { party, balance } = entry
            const partyTxs = transactions.filter(tx => tx.party_id === selectedPartyId)
            const totalGave = partyTxs.filter(tx => tx.type === "lent").reduce((s, tx) => s + Number(tx.amount), 0)
            const totalReceivedBack = partyTxs.filter(tx => tx.type === "received_back").reduce((s, tx) => s + Number(tx.amount), 0)
            const totalBorrowed = partyTxs.filter(tx => tx.type === "borrowed").reduce((s, tx) => s + Number(tx.amount), 0)
            const totalPaidBack = partyTxs.filter(tx => tx.type === "paid_back").reduce((s, tx) => s + Number(tx.amount), 0)

            return (
              <div className="space-y-3">
                {/* Party header */}
                <div className="liquid-glass rounded-2xl p-4">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setSelectedPartyId(null)}
                      className="p-1.5 rounded-lg hover:bg-[#f5f5f7] dark:hover:bg-white/[0.08] transition-all"
                    >
                      <ChevronLeft className="w-5 h-5 text-[#1d1d1f] dark:text-white" />
                    </button>
                    <div className="w-10 h-10 rounded-xl bg-[#f5f5f7] dark:bg-[#2c2c2e] flex items-center justify-center flex-shrink-0">
                      <span className="text-[15px] font-semibold text-[#1d1d1f] dark:text-white">
                        {party.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[16px] font-semibold text-[#1d1d1f] dark:text-white">{party.name}</p>
                      {party.phone && <p className="text-[12px] text-[#86868b]">{party.phone}</p>}
                      {party.notes && <p className="text-[12px] text-[#86868b]">{party.notes}</p>}
                    </div>
                    <div className="flex items-center gap-1 mr-2">
                      <button
                        onClick={() => setEditingParty(party)}
                        className="p-2 rounded-lg hover:bg-[#f5f5f7] dark:hover:bg-white/[0.08] transition-all"
                        title="Edit party"
                      >
                        <Pencil className="w-4 h-4 text-[#86868b]" />
                      </button>
                      <button
                        onClick={() => setDeletingPartyId(party.id)}
                        className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 transition-all"
                        title="Delete party"
                      >
                        <Trash2 className="w-4 h-4 text-[#86868b] hover:text-red-600" />
                      </button>
                    </div>
                    <div className="text-right">
                      {balance === 0 ? (
                        <div className="flex items-center gap-1">
                          <CheckCircle2 className="w-4 h-4 text-green-600" />
                          <span className="text-[13px] font-medium text-green-600">Settled</span>
                        </div>
                      ) : (
                        <>
                          <p className={`text-[18px] font-bold tabular-nums ${balance > 0 ? "text-green-600" : "text-red-600"}`}>
                            {balance > 0 ? "+" : "-"}₹{Math.abs(balance).toLocaleString("en-IN")}
                          </p>
                          <p className="text-[11px] text-[#86868b]">
                            {balance > 0 ? "will receive" : "you owe"}
                          </p>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Summary breakdown */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="liquid-glass rounded-xl p-3">
                    <p className="text-[11px] text-[#86868b] font-medium">Gave</p>
                    <p className="text-[16px] font-semibold text-red-600 tabular-nums">{formatCurrency(totalGave)}</p>
                  </div>
                  <div className="liquid-glass rounded-xl p-3">
                    <p className="text-[11px] text-[#86868b] font-medium">Received Back</p>
                    <p className="text-[16px] font-semibold text-green-600 tabular-nums">{formatCurrency(totalReceivedBack)}</p>
                  </div>
                  <div className="liquid-glass rounded-xl p-3">
                    <p className="text-[11px] text-[#86868b] font-medium">Borrowed</p>
                    <p className="text-[16px] font-semibold text-orange-600 tabular-nums">{formatCurrency(totalBorrowed)}</p>
                  </div>
                  <div className="liquid-glass rounded-xl p-3">
                    <p className="text-[11px] text-[#86868b] font-medium">Paid Back</p>
                    <p className="text-[16px] font-semibold text-blue-600 tabular-nums">{formatCurrency(totalPaidBack)}</p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  {balance !== 0 && (
                    <button
                      onClick={() => handleSettle(party.id, balance)}
                      className="flex-1 py-2.5 rounded-xl bg-[#f5f5f7] dark:bg-[#2c2c2e] text-[13px] font-medium text-[#1d1d1f] dark:text-white hover:bg-[#e8e8ed] dark:hover:bg-[#3a3a3c] transition-all"
                    >
                      {balance > 0 ? "Record Payment Received" : "Record Payment Made"}
                    </button>
                  )}
                  <button
                    onClick={() => { setSettlePartyId(party.id); setShowAddTransaction(true) }}
                    className="flex-1 py-2.5 rounded-xl bg-[#1d1d1f] text-white text-[13px] font-medium hover:opacity-90 transition-all"
                  >
                    Add Transaction
                  </button>
                </div>

                {/* Transaction list */}
                <p className="text-[13px] font-medium text-[#86868b] pt-1">All Transactions ({partyTxs.length})</p>
                {partyTxs.length === 0 ? (
                  <div className="liquid-glass rounded-2xl p-6 text-center">
                    <p className="text-[13px] text-[#86868b]">No transactions with {party.name} yet</p>
                  </div>
                ) : (
                  partyTxs.map(tx => {
                    const config = typeConfig[tx.type]
                    const Icon = config.icon
                    const isOverdue = tx.due_date && tx.due_date < todayStr && isUnsettled(tx)
                    return (
                      <div key={tx.id} className="liquid-glass rounded-2xl p-4 flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-xl ${config.bg} flex items-center justify-center flex-shrink-0`}>
                          <Icon className={`w-4 h-4 ${config.color}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className={`text-[11px] font-medium px-1.5 py-0.5 rounded-md flex-shrink-0 ${config.bg} ${config.color}`}>
                              {config.label}
                            </span>
                            {isOverdue && (
                              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-red-100 dark:bg-red-500/10 text-red-700 dark:text-red-400 flex-shrink-0">
                                Overdue
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5 overflow-hidden">
                            <p className="text-[12px] text-[#86868b] flex-shrink-0">
                              {new Date(tx.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                            </p>
                            {tx.due_date && (
                              <p className="text-[12px] text-[#86868b] flex-shrink-0">
                                · Due {formatDueDate(tx.due_date)}
                              </p>
                            )}
                            {tx.notes && (
                              <p className="text-[12px] text-[#86868b] truncate">· {tx.notes}</p>
                            )}
                          </div>
                        </div>
                        <p className={`text-[15px] font-semibold tabular-nums whitespace-nowrap flex-shrink-0 ${
                          tx.type === "lent" || tx.type === "paid_back" ? "text-red-600" : "text-green-600"
                        }`}>
                          {tx.type === "lent" || tx.type === "paid_back" ? "-" : "+"}₹{Number(tx.amount).toLocaleString("en-IN")}
                        </p>
                        <button
                          onClick={() => handleDelete(tx.id)}
                          className="p-2 rounded-lg hover:bg-[#f5f5f7] dark:hover:bg-white/[0.08] transition-all flex-shrink-0"
                        >
                          <Trash2 className="w-4 h-4 text-[#86868b]" />
                        </button>
                      </div>
                    )
                  })
                )}
              </div>
            )
          })() : (
            <>
              {/* Status filter chips */}
              <div className="flex flex-wrap gap-2">
                {PARTY_FILTERS.map(f => (
                  <button
                    key={f.id}
                    onClick={() => setPartyFilter(f.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                      partyFilter === f.id
                        ? "bg-[#1d1d1f] text-white"
                        : "bg-white/50 dark:bg-white/[0.06] text-[#86868b] hover:bg-white/70 dark:hover:bg-white/[0.1]"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              {filteredPartyBalances.length === 0 ? (
                <div className="liquid-glass rounded-2xl p-6 text-center">
                  <p className="text-[13px] text-[#86868b]">No parties match this filter.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredPartyBalances.map(({ party, balance, txCount }) => (
                    <div
                      key={party.id}
                      className="liquid-glass rounded-2xl p-4 flex items-center gap-3 cursor-pointer hover:shadow-md transition-all"
                      onClick={() => setSelectedPartyId(party.id)}
                    >
                      <div className="w-10 h-10 rounded-xl bg-[#f5f5f7] dark:bg-[#2c2c2e] flex items-center justify-center flex-shrink-0">
                        <span className="text-[15px] font-semibold text-[#1d1d1f] dark:text-white">
                          {party.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[14px] font-medium text-[#1d1d1f] dark:text-white truncate">{party.name}</p>
                        <p className="text-[12px] text-[#86868b]">{txCount} transactions</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        {balance === 0 ? (
                          <div className="flex items-center gap-1">
                            <CheckCircle2 className="w-4 h-4 text-green-600" />
                            <span className="text-[13px] font-medium text-green-600">Settled</span>
                          </div>
                        ) : (
                          <>
                            <p className={`text-[16px] font-semibold tabular-nums ${balance > 0 ? "text-green-600" : "text-red-600"}`}>
                              {balance > 0 ? "+" : "-"}₹{Math.abs(balance).toLocaleString("en-IN")}
                            </p>
                            <p className="text-[11px] text-[#86868b]">
                              {balance > 0 ? "will receive" : "you owe"}
                            </p>
                          </>
                        )}
                      </div>
                      {balance !== 0 && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleSettle(party.id, balance) }}
                          className="px-3 py-1.5 rounded-lg bg-[#f5f5f7] dark:bg-[#2c2c2e] text-[12px] font-medium text-[#1d1d1f] dark:text-white hover:bg-[#e8e8ed] dark:hover:bg-[#3a3a3c] transition-all flex-shrink-0"
                        >
                          Settle
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Modals */}
      {showAddTransaction && (
        <AddPartyTransactionModal
          onClose={() => { setShowAddTransaction(false); setSettlePartyId(null); setSettleTarget(null) }}
          onSave={() => { setShowAddTransaction(false); setSettlePartyId(null); setSettleTarget(null); invalidateParties() }}
          preselectedPartyId={settlePartyId || undefined}
          preselectedType={settlePartyId ? settleType : undefined}
          settlesTransactionId={settleTarget?.id}
          prefillAmount={settleTarget ? String(settleTarget.amount) : undefined}
        />
      )}
      {showAddParty && (
        <AddPartyModal
          onClose={() => setShowAddParty(false)}
          onSave={() => { setShowAddParty(false); invalidateParties() }}
        />
      )}
      {editingParty && (
        <EditPartyModal
          party={editingParty}
          onClose={() => setEditingParty(null)}
          onSave={() => { setEditingParty(null); invalidateParties() }}
        />
      )}
      {deletingPartyId && (
        <div className="fixed inset-0 z-60 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setDeletingPartyId(null)} />
          <div className="relative w-full sm:max-w-sm bg-[#ffffff] dark:bg-[#1c1c1e] rounded-2xl border border-white/40 dark:border-white/[0.08] shadow-xl p-6 text-center">
            <p className="text-[16px] font-semibold text-[#1d1d1f] dark:text-white">Delete Party?</p>
            <p className="text-[13px] text-[#86868b] mt-2">This will also delete all transactions with this party. This cannot be undone.</p>
            <div className="flex gap-3 mt-5">
              <button
                onClick={() => setDeletingPartyId(null)}
                className="flex-1 py-2.5 rounded-xl bg-[#f5f5f7] dark:bg-[#2c2c2e] text-[13px] font-medium text-[#1d1d1f] dark:text-white hover:bg-[#e8e8ed] dark:hover:bg-[#3a3a3c] transition-all"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteParty(deletingPartyId)}
                className="flex-1 py-2.5 rounded-xl bg-red-600 text-white text-[13px] font-medium hover:bg-red-700 transition-all"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function PartiesPage() {
  return (
    <Suspense fallback={
      <div className="space-y-6">
        <div className="skeleton h-7 w-32 rounded-xl" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="liquid-glass rounded-2xl p-5"><div className="skeleton h-8 w-32 rounded-lg" /></div>
          ))}
        </div>
      </div>
    }>
      <PartiesPageInner />
    </Suspense>
  )
}
