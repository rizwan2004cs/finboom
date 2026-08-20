"use client"

import { useMemo, useState } from "react"
import { useUser } from "@/hooks/use-auth"
import { useProfile } from "@/hooks/use-profile"
import { useAccounts } from "@/hooks/use-accounts"
import { useOfflineQuery } from "@/hooks/use-offline-query"
import { deleteRow, updateRow } from "@/lib/offline"
import { useQueryClient } from "@tanstack/react-query"
import {
  Plus, Landmark, Banknote, Trash2, Edit2, ArrowLeftRight,
  SlidersHorizontal, ChevronDown, Star,
} from "lucide-react"
import { getPrimaryAccountId, setPrimaryAccountId } from "@/lib/accounts/default-account"
import type { Account, Transaction } from "@/lib/types"
import { accountBalance, accountLedger } from "@/lib/finance/accounts"
import { useAppDialog } from "@/components/app-dialog"
import { useCurrency } from "@/hooks/use-currency"
import { AddAccountModal } from "@/components/modals/add-account-modal"
import { TransferModal } from "@/components/modals/transfer-modal"
import { AdjustBalanceModal } from "@/components/modals/adjust-balance-modal"

export default function AccountsPage() {
  const { formatCurrency } = useCurrency()
  const { user } = useUser()
  const { activeProfile } = useProfile()
  const queryClient = useQueryClient()
  const { accounts, isLoading: loadingAccounts } = useAccounts()

  const pf = activeProfile
    ? [{ column: "profile_id", op: "eq" as const, value: activeProfile.id }]
    : undefined
  const { data: transactions = [], isLoading: loadingTransactions } = useOfflineQuery<Transaction>(
    "transactions", user?.id, { filters: pf, enabled: !!activeProfile }
  )

  const [showAccountForm, setShowAccountForm] = useState(false)
  const [editAccount, setEditAccount] = useState<Account | null>(null)
  const [showTransfer, setShowTransfer] = useState(false)
  const [transferFromId, setTransferFromId] = useState<string | undefined>(undefined)
  const [adjustAccount, setAdjustAccount] = useState<Account | null>(null)
  const [openLedgerId, setOpenLedgerId] = useState<string | null>(null)
  // Explicit default money source (UPI-style primary). Wins over "last used"
  // in the transaction modals and the assistant. Derived from storage with a
  // version bump on writes (a setState-in-effect here trips the lint rule).
  const [primaryVersion, setPrimaryVersion] = useState(0)
  const primaryId = useMemo(
    () => (activeProfile ? getPrimaryAccountId(activeProfile.id) : ""),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- primaryVersion invalidates the storage read
    [activeProfile, primaryVersion]
  )

  function togglePrimary(accountId: string) {
    if (!activeProfile) return
    setPrimaryAccountId(activeProfile.id, primaryId === accountId ? null : accountId)
    setPrimaryVersion((v) => v + 1)
  }

  const loading = loadingAccounts || loadingTransactions || !user || !activeProfile
  const { showConfirm } = useAppDialog()

  const balances = useMemo(() => {
    const map = new Map<string, number>()
    for (const a of accounts) map.set(a.id, accountBalance(a, transactions))
    return map
  }, [accounts, transactions])

  const totalBalance = accounts.reduce((s, a) => s + (balances.get(a.id) ?? 0), 0)

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["accounts"] })
    queryClient.invalidateQueries({ queryKey: ["transactions"] })
  }

  async function deleteAccount(account: Account) {
    await showConfirm(
      `Delete "${account.name}"? Its transactions are kept but will no longer be linked to any account.`,
      {
        destructive: true,
        onConfirm: async () => {
          // Unlink cached transactions first so the local view matches the
          // server's on-delete-set-null immediately (the FK bump only reaches
          // this device via delta sync; offline it would never arrive).
          for (const t of transactions.filter(t => t.account_id === account.id)) {
            await updateRow("transactions", t.id, { account_id: null })
          }
          await deleteRow("accounts", account.id)
          invalidate()
        },
      },
    )
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="skeleton h-7 w-36 rounded-lg" />
        {[1, 2, 3].map(i => (
          <div key={i} className="liquid-glass rounded-2xl p-5 space-y-3">
            <div className="flex items-center gap-3">
              <div className="skeleton h-9 w-9 rounded-xl" />
              <div className="skeleton h-5 w-40 rounded-lg" />
            </div>
            <div className="skeleton h-3 w-56 rounded-lg" />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#1d1d1f]">Cash &amp; Bank</h1>
          <p className="text-sm text-[#86868b]">
            {accounts.length > 0
              ? `Total balance ${formatCurrency(totalBalance)} across ${accounts.length} account${accounts.length === 1 ? "" : "s"}`
              : "Track where your money actually sits"}
          </p>
        </div>
        <div className="flex gap-2">
          {accounts.length >= 2 && (
            <button
              onClick={() => { setTransferFromId(undefined); setShowTransfer(true) }}
              className="flex items-center gap-1.5 liquid-glass rounded-full px-3 py-2 text-sm font-medium text-[#1d1d1f] hover:shadow-md transition-all"
            >
              <ArrowLeftRight className="w-4 h-4" />
              <span className="hidden sm:inline">Transfer</span>
            </button>
          )}
          <button
            onClick={() => { setEditAccount(null); setShowAccountForm(true) }}
            className="flex items-center gap-1.5 liquid-glass-btn-primary"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Add Account</span>
          </button>
        </div>
      </div>

      {/* Account cards */}
      {accounts.length === 0 ? (
        <div className="liquid-glass rounded-2xl p-8 text-center">
          <div className="w-12 h-12 rounded-xl bg-white/50 backdrop-blur-sm flex items-center justify-center mx-auto mb-3">
            <Landmark className="w-6 h-6 text-[#86868b]" strokeWidth={1.5} />
          </div>
          <p className="font-medium text-[#1d1d1f]">No accounts yet</p>
          <p className="text-sm text-[#86868b] mt-1">
            Add your cash drawer and bank accounts, then tag transactions to keep every balance matching reality
          </p>
          <button
            onClick={() => setShowAccountForm(true)}
            className="mt-4 liquid-glass-btn-primary"
          >
            Add Account
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {accounts.map((account) => {
            const balance = balances.get(account.id) ?? 0
            const Icon = account.type === "cash" ? Banknote : Landmark
            const ledgerOpen = openLedgerId === account.id
            const ledger = ledgerOpen ? accountLedger(account, transactions) : []
            return (
              <div key={account.id} className="liquid-glass rounded-2xl p-5">
                <div className="flex items-start justify-between gap-3">
                  <button
                    onClick={() => setOpenLedgerId(ledgerOpen ? null : account.id)}
                    className="flex items-center gap-3 min-w-0 text-left flex-1"
                    aria-expanded={ledgerOpen}
                  >
                    <div className="w-10 h-10 rounded-xl bg-white/50 backdrop-blur-sm flex items-center justify-center flex-shrink-0">
                      <Icon className="w-5 h-5 text-[#1d1d1f]" strokeWidth={1.5} />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-[#1d1d1f] truncate">
                        {account.name}
                        {primaryId === account.id && (
                          <span className="ml-2 inline-block align-middle text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-400">
                            Default
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-[#86868b]">
                        {account.type === "cash" ? "Cash" : "Bank"} · tap for ledger
                      </p>
                    </div>
                    <ChevronDown
                      className={`w-4 h-4 text-[#86868b] flex-shrink-0 transition-transform ${ledgerOpen ? "rotate-180" : ""}`}
                    />
                  </button>
                  <div className="text-right flex-shrink-0">
                    <p className={`font-semibold ${balance < 0 ? "text-red-600 dark:text-red-400" : "text-[#1d1d1f]"}`}>
                      {formatCurrency(balance)}
                    </p>
                    <div className="flex gap-1 mt-1 justify-end">
                      <button
                        onClick={() => togglePrimary(account.id)}
                        className="p-1.5 rounded-lg hover:bg-[#f5f5f7] transition-all"
                        aria-label={
                          primaryId === account.id
                            ? `Unset ${account.name} as default account`
                            : `Set ${account.name} as default account`
                        }
                        title={primaryId === account.id ? "Default account" : "Set as default"}
                      >
                        <Star
                          className={`w-3.5 h-3.5 ${
                            primaryId === account.id
                              ? "text-amber-500 fill-amber-500"
                              : "text-[#86868b]"
                          }`}
                        />
                      </button>
                      <button
                        onClick={() => setAdjustAccount(account)}
                        className="p-1.5 rounded-lg hover:bg-[#f5f5f7] transition-all"
                        aria-label={`Adjust ${account.name} balance`}
                      >
                        <SlidersHorizontal className="w-3.5 h-3.5 text-[#86868b]" />
                      </button>
                      {accounts.length >= 2 && (
                        <button
                          onClick={() => { setTransferFromId(account.id); setShowTransfer(true) }}
                          className="p-1.5 rounded-lg hover:bg-[#f5f5f7] transition-all"
                          aria-label={`Transfer from ${account.name}`}
                        >
                          <ArrowLeftRight className="w-3.5 h-3.5 text-[#86868b]" />
                        </button>
                      )}
                      <button
                        onClick={() => { setEditAccount(account); setShowAccountForm(true) }}
                        className="p-1.5 rounded-lg hover:bg-[#f5f5f7] transition-all"
                        aria-label={`Edit ${account.name}`}
                      >
                        <Edit2 className="w-3.5 h-3.5 text-[#86868b]" />
                      </button>
                      <button
                        onClick={() => deleteAccount(account)}
                        className="p-1.5 rounded-lg hover:bg-[#f5f5f7] transition-all"
                        aria-label={`Delete ${account.name}`}
                      >
                        <Trash2 className="w-3.5 h-3.5 text-[#86868b]" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Ledger */}
                {ledgerOpen && (
                  <div className="mt-4 pt-3 border-t border-black/[0.04] dark:border-white/[0.06]">
                    {ledger.length === 0 ? (
                      <p className="text-sm text-[#86868b] text-center py-2">
                        No transactions yet — tag a transaction with this account and it will show up here
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {ledger.map(({ transaction: t, balanceAfter }) => (
                          <div key={t.id} className="flex items-center gap-3 text-sm">
                            <div className="flex-1 min-w-0">
                              <p className="text-[#1d1d1f] truncate">{t.description || t.category}</p>
                              <p className="text-[11px] text-[#86868b]">
                                {new Date(`${t.date}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                              </p>
                            </div>
                            <p className={`font-medium tabular-nums ${t.type === "income" ? "text-green-700 dark:text-green-400" : "text-[#6e6e73] dark:text-[#aeaeb2]"}`}>
                              {t.type === "income" ? "+" : "-"}{formatCurrency(Number(t.amount))}
                            </p>
                            <p className="w-24 text-right text-[11px] text-[#86868b] tabular-nums">
                              {formatCurrency(balanceAfter)}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="flex items-center justify-between mt-3 pt-2 border-t border-dashed border-black/[0.06] dark:border-white/[0.08]">
                      <span className="text-[11px] text-[#86868b]">
                        Opening balance ({new Date(`${account.opening_date}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })})
                      </span>
                      <span className="text-[11px] text-[#86868b] tabular-nums">
                        {formatCurrency(Number(account.opening_balance))}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Modals */}
      {showAccountForm && (
        <AddAccountModal
          account={editAccount}
          onClose={() => { setShowAccountForm(false); setEditAccount(null) }}
          onSave={() => { setShowAccountForm(false); setEditAccount(null); invalidate() }}
        />
      )}
      {showTransfer && (
        <TransferModal
          accounts={accounts}
          defaultFromId={transferFromId}
          onClose={() => setShowTransfer(false)}
          onSave={() => { setShowTransfer(false); invalidate() }}
        />
      )}
      {adjustAccount && (
        <AdjustBalanceModal
          account={adjustAccount}
          currentBalance={balances.get(adjustAccount.id) ?? 0}
          onClose={() => setAdjustAccount(null)}
          onSave={() => { setAdjustAccount(null); invalidate() }}
        />
      )}
    </div>
  )
}
