"use client"

import { Suspense } from "react"
import { useEffect, useState, useMemo } from "react"
import { useUser } from "@clerk/nextjs"
import { createClient } from "@/utils/supabase/client"
import { fetchTable, deleteRow } from "@/lib/offline"
import { useSearchParams } from "next/navigation"
import {
  Plus,
  ArrowUpRight,
  ArrowDownLeft,
  ArrowDownRight,
  ArrowUpLeft,
  Trash2,
  Clock,
  AlertCircle,
  CheckCircle2,
  User,
  HandCoins,
  ChevronLeft,
} from "lucide-react"
import type { Party, PartyTransaction } from "@/lib/types"
import { AddPartyTransactionModal } from "@/components/modals/add-party-transaction-modal"
import { AddPartyModal } from "@/components/modals/add-party-modal"

function formatCurrency(amount: number) {
  if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(2)} Cr`
  if (amount >= 100000) return `₹${(amount / 100000).toFixed(2)} L`
  if (amount >= 1000) return `₹${(amount / 1000).toFixed(1)}K`
  return `₹${amount.toLocaleString("en-IN")}`
}

const typeConfig = {
  lent: { label: "Gave", icon: ArrowUpRight, color: "text-red-600", bg: "bg-red-50" },
  received_back: { label: "Received Back", icon: ArrowDownLeft, color: "text-green-600", bg: "bg-green-50" },
  borrowed: { label: "Borrowed", icon: ArrowDownRight, color: "text-orange-600", bg: "bg-orange-50" },
  paid_back: { label: "Paid Back", icon: ArrowUpLeft, color: "text-blue-600", bg: "bg-blue-50" },
}

function PartiesPageInner() {
  const { user } = useUser()
  const searchParams = useSearchParams()
  const [tab, setTab] = useState<"transactions" | "parties">("transactions")
  const [parties, setParties] = useState<Party[]>([])
  const [transactions, setTransactions] = useState<(PartyTransaction & { party: Party })[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddTransaction, setShowAddTransaction] = useState(false)
  const [showAddParty, setShowAddParty] = useState(false)
  const [settlePartyId, setSettlePartyId] = useState<string | null>(null)
  const [settleType, setSettleType] = useState<"received_back" | "paid_back">("received_back")
  const [selectedPartyId, setSelectedPartyId] = useState<string | null>(null)

  async function loadData() {
    if (!user) return

    const [partiesData, txData] = await Promise.all([
      fetchTable<Party>("parties", user.id, { order: { column: "name", ascending: true } }),
      fetchTable<PartyTransaction>("party_transactions", user.id, { order: { column: "date", ascending: false } }),
    ])

    setParties(partiesData)
    // Attach party object to each transaction client-side
    const partyMap = new Map(partiesData.map(p => [p.id, p]))
    const txWithParty = txData.map(tx => ({
      ...tx,
      party: partyMap.get(tx.party_id) as Party,
    })).filter(tx => tx.party)
    setTransactions(txWithParty)
    setLoading(false)
  }

  useEffect(() => {
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  useEffect(() => {
    if (searchParams.get("action") === "add") setShowAddTransaction(true)
  }, [searchParams])

  async function handleDelete(id: string) {
    await deleteRow("party_transactions", id)
    loadData()
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

  const totalReceivable = partyBalances
    .filter(p => p.balance > 0)
    .reduce((sum, p) => sum + p.balance, 0)
  const totalPayable = partyBalances
    .filter(p => p.balance < 0)
    .reduce((sum, p) => sum + Math.abs(p.balance), 0)

  // Due within 30 days
  const today = new Date()
  const in30Days = new Date(today)
  in30Days.setDate(in30Days.getDate() + 30)
  const dueSoon = transactions.filter(tx => {
    if (!tx.due_date) return false
    if (tx.type !== "lent") return false
    const d = new Date(tx.due_date)
    return d >= today && d <= in30Days
  })
  const dueSoonAmount = dueSoon.reduce((sum, tx) => sum + Number(tx.amount), 0)

  // Overdue items
  const overdue = transactions.filter(tx => {
    if (!tx.due_date) return false
    if (tx.type !== "lent" && tx.type !== "borrowed") return false
    return new Date(tx.due_date) < today
  })

  function handleSettle(partyId: string, balance: number) {
    setSettlePartyId(partyId)
    setSettleType(balance > 0 ? "received_back" : "paid_back")
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[24px] font-semibold tracking-[-0.3px] text-[#1d1d1f]">Parties</h1>
          <p className="text-[14px] text-[#86868b] mt-0.5">Track money given & received</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowAddParty(true)}
            className="p-2.5 rounded-xl bg-white/50 backdrop-blur-sm border border-white/40 hover:bg-white/70 transition-all"
            title="Add party"
          >
            <User className="w-5 h-5 text-[#1d1d1f]" />
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
            <div className="w-9 h-9 rounded-xl bg-green-50 flex items-center justify-center">
              <ArrowDownLeft className="w-5 h-5 text-green-600" />
            </div>
          </div>
          <p className="text-[28px] font-semibold mt-2 text-green-700">{formatCurrency(totalReceivable)}</p>
          <p className="text-[12px] text-[#86868b] mt-1">
            {partyBalances.filter(p => p.balance > 0).length} parties owe you
          </p>
        </div>

        <div className="liquid-glass rounded-2xl p-5">
          <div className="flex items-center justify-between">
            <p className="text-[14px] text-[#86868b] font-medium">To Pay</p>
            <div className="w-9 h-9 rounded-xl bg-red-50 flex items-center justify-center">
              <ArrowUpRight className="w-5 h-5 text-red-600" />
            </div>
          </div>
          <p className="text-[28px] font-semibold mt-2 text-red-700">{formatCurrency(totalPayable)}</p>
          <p className="text-[12px] text-[#86868b] mt-1">
            {partyBalances.filter(p => p.balance < 0).length} parties you owe
          </p>
        </div>

        <div className="liquid-glass rounded-2xl p-5">
          <div className="flex items-center justify-between">
            <p className="text-[14px] text-[#86868b] font-medium">Due in 30 Days</p>
            <div className="w-9 h-9 rounded-xl bg-orange-50 flex items-center justify-center">
              <Clock className="w-5 h-5 text-orange-600" />
            </div>
          </div>
          <p className="text-[28px] font-semibold mt-2 text-orange-700">{formatCurrency(dueSoonAmount)}</p>
          <p className="text-[12px] text-[#86868b] mt-1">{dueSoon.length} entries upcoming</p>
        </div>
      </div>

      {/* Overdue alerts */}
      {overdue.length > 0 && (
        <div className="liquid-glass rounded-2xl p-4 border border-red-200 bg-red-50/50">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="w-4 h-4 text-red-600" />
            <p className="text-sm font-medium text-red-800">Overdue ({overdue.length})</p>
          </div>
          <div className="space-y-1">
            {overdue.slice(0, 3).map(tx => (
              <p key={tx.id} className="text-[12px] text-red-700">
                {tx.party?.name} — {formatCurrency(Number(tx.amount))} (due {new Date(tx.due_date!).toLocaleDateString("en-IN", { day: "numeric", month: "short" })})
              </p>
            ))}
            {overdue.length > 3 && (
              <p className="text-[12px] text-red-600">+{overdue.length - 3} more</p>
            )}
          </div>
        </div>
      )}

      {/* Tab switcher */}
      <div className="flex bg-[#f5f5f7] rounded-xl p-1">
        <button
          onClick={() => setTab("transactions")}
          className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${
            tab === "transactions" ? "bg-white text-[#1d1d1f] shadow-sm" : "text-[#86868b]"
          }`}
        >
          Transactions
        </button>
        <button
          onClick={() => setTab("parties")}
          className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${
            tab === "parties" ? "bg-white text-[#1d1d1f] shadow-sm" : "text-[#86868b]"
          }`}
        >
          Parties ({parties.length})
        </button>
      </div>

      {/* Transactions tab */}
      {tab === "transactions" && (
        <div className="space-y-2">
          {transactions.length === 0 ? (
            <div className="liquid-glass rounded-2xl p-8 text-center">
              <HandCoins className="w-10 h-10 text-[#86868b] mx-auto" />
              <p className="text-[15px] font-medium text-[#1d1d1f] mt-3">No party transactions yet</p>
              <p className="text-[13px] text-[#86868b] mt-1">Start tracking money given & received</p>
              <button
                onClick={() => setShowAddTransaction(true)}
                className="mt-4 px-5 py-2.5 rounded-xl bg-[#1d1d1f] text-white text-sm font-medium hover:opacity-90 transition-all"
              >
                Add First Entry
              </button>
            </div>
          ) : (
            transactions.map(tx => {
              const config = typeConfig[tx.type]
              const Icon = config.icon
              const isOverdue = tx.due_date && new Date(tx.due_date) < today && (tx.type === "lent" || tx.type === "borrowed")
              return (
                <div key={tx.id} className="liquid-glass rounded-2xl p-4 flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl ${config.bg} flex items-center justify-center flex-shrink-0`}>
                    <Icon className={`w-5 h-5 ${config.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-[14px] font-medium text-[#1d1d1f] truncate">{tx.party?.name}</p>
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-md ${config.bg} ${config.color}`}>
                        {config.label}
                      </span>
                      {isOverdue && (
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-red-100 text-red-700">
                          Overdue
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <p className="text-[12px] text-[#86868b]">
                        {new Date(tx.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                      </p>
                      {tx.due_date && (
                        <p className="text-[12px] text-[#86868b]">
                          · Due {new Date(tx.due_date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                        </p>
                      )}
                      {tx.notes && (
                        <p className="text-[12px] text-[#86868b] truncate">· {tx.notes}</p>
                      )}
                    </div>
                  </div>
                  <p className={`text-[16px] font-semibold tabular-nums ${
                    tx.type === "lent" || tx.type === "paid_back" ? "text-red-600" : "text-green-600"
                  }`}>
                    {tx.type === "lent" || tx.type === "paid_back" ? "-" : "+"}₹{Number(tx.amount).toLocaleString("en-IN")}
                  </p>
                  <button
                    onClick={() => handleDelete(tx.id)}
                    className="p-2 rounded-lg hover:bg-[#f5f5f7] transition-all flex-shrink-0"
                  >
                    <Trash2 className="w-4 h-4 text-[#86868b]" />
                  </button>
                </div>
              )
            })
          )}
        </div>
      )}

      {/* Parties tab */}
      {tab === "parties" && (
        <div className="space-y-2">
          {partyBalances.length === 0 ? (
            <div className="liquid-glass rounded-2xl p-8 text-center">
              <User className="w-10 h-10 text-[#86868b] mx-auto" />
              <p className="text-[15px] font-medium text-[#1d1d1f] mt-3">No parties yet</p>
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
                      className="p-1.5 rounded-lg hover:bg-[#f5f5f7] transition-all"
                    >
                      <ChevronLeft className="w-5 h-5 text-[#1d1d1f]" />
                    </button>
                    <div className="w-10 h-10 rounded-xl bg-[#f5f5f7] flex items-center justify-center flex-shrink-0">
                      <span className="text-[15px] font-semibold text-[#1d1d1f]">
                        {party.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[16px] font-semibold text-[#1d1d1f]">{party.name}</p>
                      {party.phone && <p className="text-[12px] text-[#86868b]">{party.phone}</p>}
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
                      className="flex-1 py-2.5 rounded-xl bg-[#f5f5f7] text-[13px] font-medium text-[#1d1d1f] hover:bg-[#e8e8ed] transition-all"
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
                    const isOverdue = tx.due_date && new Date(tx.due_date) < today && (tx.type === "lent" || tx.type === "borrowed")
                    return (
                      <div key={tx.id} className="liquid-glass rounded-2xl p-4 flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-xl ${config.bg} flex items-center justify-center flex-shrink-0`}>
                          <Icon className={`w-4 h-4 ${config.color}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={`text-[11px] font-medium px-1.5 py-0.5 rounded-md ${config.bg} ${config.color}`}>
                              {config.label}
                            </span>
                            {isOverdue && (
                              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-red-100 text-red-700">
                                Overdue
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <p className="text-[12px] text-[#86868b]">
                              {new Date(tx.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                            </p>
                            {tx.due_date && (
                              <p className="text-[12px] text-[#86868b]">
                                · Due {new Date(tx.due_date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                              </p>
                            )}
                            {tx.notes && (
                              <p className="text-[12px] text-[#86868b] truncate">· {tx.notes}</p>
                            )}
                          </div>
                        </div>
                        <p className={`text-[15px] font-semibold tabular-nums ${
                          tx.type === "lent" || tx.type === "paid_back" ? "text-red-600" : "text-green-600"
                        }`}>
                          {tx.type === "lent" || tx.type === "paid_back" ? "-" : "+"}₹{Number(tx.amount).toLocaleString("en-IN")}
                        </p>
                        <button
                          onClick={() => handleDelete(tx.id)}
                          className="p-2 rounded-lg hover:bg-[#f5f5f7] transition-all flex-shrink-0"
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
            partyBalances.map(({ party, balance, txCount }) => (
              <div
                key={party.id}
                className="liquid-glass rounded-2xl p-4 flex items-center gap-3 cursor-pointer hover:shadow-md transition-all"
                onClick={() => setSelectedPartyId(party.id)}
              >
                <div className="w-10 h-10 rounded-xl bg-[#f5f5f7] flex items-center justify-center flex-shrink-0">
                  <span className="text-[15px] font-semibold text-[#1d1d1f]">
                    {party.name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-medium text-[#1d1d1f] truncate">{party.name}</p>
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
                    className="px-3 py-1.5 rounded-lg bg-[#f5f5f7] text-[12px] font-medium text-[#1d1d1f] hover:bg-[#e8e8ed] transition-all flex-shrink-0"
                  >
                    Settle
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Modals */}
      {showAddTransaction && (
        <AddPartyTransactionModal
          onClose={() => { setShowAddTransaction(false); setSettlePartyId(null) }}
          onSave={() => { setShowAddTransaction(false); setSettlePartyId(null); loadData() }}
          preselectedPartyId={settlePartyId || undefined}
          preselectedType={settlePartyId ? settleType : undefined}
        />
      )}
      {showAddParty && (
        <AddPartyModal
          onClose={() => setShowAddParty(false)}
          onSave={() => { setShowAddParty(false); loadData() }}
        />
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
