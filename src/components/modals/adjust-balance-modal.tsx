"use client"

import { useState } from "react"
import { useUser } from "@/hooks/use-auth"
import { useProfile } from "@/hooks/use-profile"
import { insertRow } from "@/lib/offline"
import { isValidISODate, isFutureISODate, todayLocalISO } from "@/lib/utils"
import { X, Loader2 } from "lucide-react"
import { ADJUSTMENT_CATEGORY } from "@/lib/constants"
import type { Account, Transaction } from "@/lib/types"
import { formatLedgerBalance, isCreditCard } from "@/lib/finance/accounts"
import { useCurrency } from "@/hooks/use-currency"

interface Props {
  account: Account
  /** Live derived balance of the account, in INR. */
  currentBalance: number
  onClose: () => void
  onSave: () => void
}

/** Vyapar-style "Adjust Cash/Bank": add or reduce money to bring the account
 *  balance back in line with reality. Stored as a single transaction with the
 *  special adjustment category, so it moves the balance without counting as
 *  real income or expense.
 *
 *  For a credit card the same row is presented in "dues" terms: a card's
 *  balance is money owed, so "dues went up" is an expense leg (balance down)
 *  and "dues went down" an income leg (balance up). Stored semantics are
 *  identical to cash/bank — only the labels flip. */
export function AdjustBalanceModal({ account, currentBalance, onClose, onSave }: Readonly<Props>) {
  const { symbol, currency, toINR, formatCurrency } = useCurrency()
  const { user } = useUser()
  const { activeProfile } = useProfile()
  const card = isCreditCard(account)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({
    // Reconciling a card statement usually means more dues were found.
    mode: (card ? "reduce" : "add") as "add" | "reduce",
    amount: "",
    date: todayLocalISO(),
    note: "",
  })

  const todayStr = todayLocalISO()

  const amountNum = parseFloat(form.amount)
  const amountInr = Number.isFinite(amountNum) && amountNum > 0
    ? Math.round(toINR(amountNum, currency) * 100) / 100
    : 0
  const newBalance = currentBalance + (form.mode === "add" ? amountInr : -amountInr)
  // Cards read "₹X due" / "₹X credit" / "No dues"; cash/bank the plain number.
  const balanceLabel = (n: number) => formatLedgerBalance(card, n, formatCurrency)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!user || !activeProfile) return

    const amount = parseFloat(form.amount)
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Enter an amount greater than 0.")
      return
    }
    if (!isValidISODate(form.date) || isFutureISODate(form.date)) {
      setError("Pick a valid date — it cannot be in the future.")
      return
    }
    if (form.date < account.opening_date) {
      // Balance math starts at the opening as-of date — an earlier adjustment
      // would be silently ignored.
      setError(`This account's balance starts on ${account.opening_date} — pick a date on or after it.`)
      return
    }
    setError(null)
    setSaving(true)

    const res = await insertRow<Transaction>("transactions", {
      user_id: user.id,
      profile_id: activeProfile.id,
      type: form.mode === "add" ? "income" : "expense",
      category: ADJUSTMENT_CATEGORY,
      amount: Math.round(toINR(amount, currency) * 100) / 100,
      currency: "INR",
      description: form.note.trim() || "Balance adjustment",
      date: form.date,
      account_id: account.id,
      updated_at: new Date().toISOString(),
    })

    setSaving(false)
    if (res.error) {
      setError(res.error)
      return
    }
    onSave()
  }

  return (
    <div className="fixed inset-0 z-60 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-md bg-[#ffffff] dark:bg-[#1c1c1e] rounded-t-3xl sm:rounded-2xl border border-white/40 dark:border-white/[0.08] shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="sm:hidden flex justify-center pt-3">
          <div className="w-10 h-1 rounded-full bg-black/[0.08] dark:bg-white/[0.12]" />
        </div>

        <div className="flex items-center justify-between p-5 border-b border-black/[0.04] dark:border-white/[0.06]">
          <h2 className="text-lg font-bold text-[#1d1d1f] dark:text-white">Adjust {account.name}</h2>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-[#f5f5f7] dark:hover:bg-white/[0.08] transition-all">
            <X className="w-5 h-5 text-[#86868b]" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 pb-8 sm:pb-5 space-y-4">
          <p className="text-sm text-[#86868b]">
            {card ? "Outstanding" : "Current balance"}:{" "}
            <span className="font-semibold text-[#1d1d1f] dark:text-white">{balanceLabel(currentBalance)}</span>
          </p>

          {/* Add / Reduce toggle (cards: dues up / dues down) */}
          <div className="flex bg-[#f5f5f7] dark:bg-white/[0.06] rounded-xl p-1">
            {(card ? (["reduce", "add"] as const) : (["add", "reduce"] as const)).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setForm(prev => ({ ...prev, mode: m }))}
                className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  form.mode === m ? "bg-white dark:bg-white/[0.12] text-[#1d1d1f] dark:text-white shadow-sm" : "text-[#86868b]"
                }`}
              >
                {card
                  ? (m === "reduce" ? "Dues went up" : "Dues went down")
                  : (m === "add" ? "Add money" : "Reduce money")}
              </button>
            ))}
          </div>

          {/* Amount */}
          <div>
            <label className="text-sm font-medium text-[#1d1d1f] dark:text-[#98989d]">Amount ({symbol})</label>
            <input
              type="number"
              required
              step="0.01"
              min="0.01"
              inputMode="decimal"
              value={form.amount}
              onChange={(e) => { setForm(prev => ({ ...prev, amount: e.target.value })); setError(null) }}
              placeholder="0"
              className="mt-1 w-full px-4 py-3 rounded-xl bg-[#f5f5f7] dark:bg-white/[0.06] border-0 text-2xl font-bold text-[#1d1d1f] dark:text-white placeholder:text-[#86868b] focus:outline-none focus:ring-2 focus:ring-[#1d1d1f]/10 dark:focus:ring-white/10 text-center"
            />
            {amountInr > 0 && (
              <p className="text-[11px] text-[#86868b] mt-1 text-center">
                {card ? "New outstanding" : "New balance"}: {balanceLabel(newBalance)}
              </p>
            )}
          </div>

          {/* Date */}
          <div>
            <label className="text-sm font-medium text-[#1d1d1f] dark:text-[#98989d]">Date</label>
            <input
              type="date"
              required
              min={account.opening_date}
              max={todayStr}
              value={form.date}
              onChange={(e) => { setForm(prev => ({ ...prev, date: e.target.value })); setError(null) }}
              onFocus={(e) => setTimeout(() => e.target.scrollIntoView({ behavior: "smooth", block: "center" }), 100)}
              className="mt-1 w-full px-4 py-3 rounded-xl bg-[#f5f5f7] dark:bg-white/[0.06] border-0 text-sm text-[#1d1d1f] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#1d1d1f]/10 dark:focus:ring-white/10 dark:[color-scheme:dark]"
            />
          </div>

          {/* Note */}
          <div>
            <label className="text-sm font-medium text-[#1d1d1f] dark:text-[#98989d]">Note (optional)</label>
            <input
              type="text"
              value={form.note}
              onChange={(e) => setForm(prev => ({ ...prev, note: e.target.value }))}
              placeholder={card ? "e.g. Match card statement" : "e.g. Counted cash drawer"}
              className="mt-1 w-full px-4 py-3 rounded-xl bg-[#f5f5f7] dark:bg-white/[0.06] border-0 text-sm text-[#1d1d1f] dark:text-white placeholder:text-[#86868b] focus:outline-none focus:ring-2 focus:ring-[#1d1d1f]/10 dark:focus:ring-white/10"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 rounded-xl px-4 py-3">
              Couldn&apos;t adjust {card ? "dues" : "balance"}: {error}
            </p>
          )}

          <button
            type="submit"
            disabled={saving || !form.amount}
            className="w-full py-3 rounded-xl bg-[#1d1d1f] dark:bg-white/[0.12] text-white font-medium hover:opacity-90 transition-all disabled:opacity-50"
          >
            {saving && <><Loader2 className="w-4 h-4 animate-spin inline mr-2" />Adjusting...</>}
            {!saving && (card
              ? (form.mode === "reduce" ? "Increase Dues" : "Reduce Dues")
              : (form.mode === "add" ? "Add to Balance" : "Reduce Balance"))}
          </button>
        </form>
      </div>
    </div>
  )
}
