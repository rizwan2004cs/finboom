"use client"

import { useState } from "react"
import { useUser } from "@/hooks/use-auth"
import { useProfile } from "@/hooks/use-profile"
import { deleteRow, insertRow } from "@/lib/offline"
import { isValidISODate, isFutureISODate, todayLocalISO } from "@/lib/utils"
import { X, Loader2, ArrowDown } from "lucide-react"
import { CREDIT_CARD_BILL_CATEGORY, TRANSFER_CATEGORY } from "@/lib/constants"
import type { Account, Transaction } from "@/lib/types"
import { cashAndBankAccounts, isCreditCard, untrackedCardDues } from "@/lib/finance/accounts"
import { CustomSelect } from "@/components/custom-select"
import { useCurrency } from "@/hooks/use-currency"

interface Props {
  accounts: Account[]
  /** Account preselected as the source (e.g. the card the action came from). */
  defaultFromId?: string
  /** Account preselected as the destination (e.g. a credit card being paid). */
  defaultToId?: string
  /** Prefilled amount in INR (e.g. a card's outstanding balance). */
  defaultAmountInr?: number
  /** Profile transactions — needed to work out how much of a card payment
   *  clears pre-tracking dues (logged as an expense, not a transfer). */
  transactions?: Transaction[]
  onClose: () => void
  onSave: () => void
}

/** Move money between two own accounts. Creates two linked transaction legs
 *  sharing a transfer_group_id: an expense out of the source account and an
 *  income into the destination — neither counts as real cashflow. */
export function TransferModal({ accounts, defaultFromId, defaultToId, defaultAmountInr, transactions = [], onClose, onSave }: Readonly<Props>) {
  const { symbol, currency, toINR, convert, formatCurrency } = useCurrency()
  const { user } = useUser()
  const { activeProfile } = useProfile()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState(() => {
    // Preselections come from stored ids (e.g. the starred primary account)
    // that may point at a deleted account — only honour ones in the list.
    const known = (id?: string) => (id && accounts.some(a => a.id === id) ? id : "")
    const toId = known(defaultToId)
    const fromId =
      known(defaultFromId) ||
      // Paying a card: default the source to the first cash/bank account.
      (toId ? cashAndBankAccounts(accounts).find(a => a.id !== toId)?.id : undefined) ||
      accounts.find(a => a.id !== toId)?.id ||
      ""
    const resolvedTo = toId || accounts.find(a => a.id !== fromId)?.id || ""
    const amount = defaultAmountInr && defaultAmountInr > 0
      ? String(Math.round(convert(defaultAmountInr) * 100) / 100)
      : ""
    return { from_id: fromId, to_id: resolvedTo, amount, date: todayLocalISO(), note: "" }
  })

  const todayStr = todayLocalISO()
  const toAccount = accounts.find(a => a.id === form.to_id)
  const payingCard = !!toAccount && isCreditCard(toAccount)
  // Portion of this payment that clears dues from before the card was tracked.
  const untrackedDues = payingCard && toAccount ? untrackedCardDues(toAccount, transactions) : 0
  const enteredInr = Math.round(toINR(parseFloat(form.amount) || 0, currency) * 100) / 100
  const expensePortion = payingCard ? Math.min(Math.max(0, enteredInr), untrackedDues) : 0
  const options = accounts.map(a => ({ value: a.id, label: isCreditCard(a) ? `${a.name} (card)` : a.name }))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!user || !activeProfile) return

    const amount = parseFloat(form.amount)
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Enter an amount greater than 0.")
      return
    }
    if (!form.from_id || !form.to_id) {
      setError("Pick both accounts.")
      return
    }
    if (form.from_id === form.to_id) {
      setError("Pick two different accounts.")
      return
    }
    if (!isValidISODate(form.date) || isFutureISODate(form.date)) {
      setError("Pick a valid date — it cannot be in the future.")
      return
    }
    // Both legs must fall on/after their account's opening as-of date, or the
    // transfer would apply to one balance but be ignored by the other.
    const fromAcc = accounts.find(a => a.id === form.from_id)
    const toAcc = accounts.find(a => a.id === form.to_id)
    if (!fromAcc || !toAcc) {
      setError("One of these accounts no longer exists — pick again.")
      return
    }
    const floor = [fromAcc, toAcc]
      .map(a => a.opening_date || "")
      .sort()
      .pop()!
    if (form.date < floor) {
      setError(`These accounts track balances from ${floor} — pick a date on or after it.`)
      return
    }
    setError(null)
    setSaving(true)

    const amountInr = Math.round(toINR(amount, currency) * 100) / 100
    const fromName = fromAcc.name
    const toName = toAcc.name
    const note = form.note.trim()
    const transferGroupId = crypto.randomUUID()
    const common = {
      user_id: user.id,
      profile_id: activeProfile.id,
      category: TRANSFER_CATEGORY,
      amount: amountInr,
      currency: "INR",
      date: form.date,
      transfer_group_id: transferGroupId,
      updated_at: new Date().toISOString(),
    }

    // Money leaving the source account. For a card bill, the slice that clears
    // pre-tracking dues is a real expense (those swipes were never logged);
    // anything beyond it was already expensed at swipe time, so it's a transfer.
    const expenseInr = payingCard ? Math.min(amountInr, untrackedCardDues(toAcc, transactions)) : 0
    const transferOutInr = Math.round((amountInr - expenseInr) * 100) / 100
    const created: string[] = []
    const rollback = async () => {
      for (const id of created) await deleteRow("transactions", id)
    }

    if (expenseInr > 0) {
      const billLeg = await insertRow<Transaction>("transactions", {
        ...common,
        type: "expense",
        category: CREDIT_CARD_BILL_CATEGORY,
        amount: expenseInr,
        account_id: form.from_id,
        description: note || `Credit card bill · ${toName}`,
      })
      if (billLeg.error) {
        setSaving(false)
        setError(billLeg.error)
        return
      }
      if (billLeg.data?.id) created.push(billLeg.data.id)
    }

    if (transferOutInr > 0) {
      const outLeg = await insertRow<Transaction>("transactions", {
        ...common,
        type: "expense",
        amount: transferOutInr,
        account_id: form.from_id,
        description: note || (payingCard ? `Card bill · ${toName}` : `Transfer to ${toName}`),
      })
      if (outLeg.error) {
        await rollback()
        setSaving(false)
        setError(outLeg.error)
        return
      }
      if (outLeg.data?.id) created.push(outLeg.data.id)
    }

    const inLeg = await insertRow<Transaction>("transactions", {
      ...common,
      type: "income",
      account_id: form.to_id,
      description: note || (payingCard ? `Bill payment from ${fromName}` : `Transfer from ${fromName}`),
    })
    if (inLeg.error) {
      // Don't leave a one-sided transfer behind — roll back what was written.
      await rollback()
      setSaving(false)
      setError(inLeg.error)
      return
    }

    setSaving(false)
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
          <h2 className="text-lg font-bold text-[#1d1d1f] dark:text-white">{payingCard ? "Pay Card Bill" : "Transfer Money"}</h2>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-[#f5f5f7] dark:hover:bg-white/[0.08] transition-all">
            <X className="w-5 h-5 text-[#86868b]" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 pb-8 sm:pb-5 space-y-4">
          {/* From / To */}
          <div>
            <label className="text-sm font-medium text-[#1d1d1f] dark:text-[#98989d]">From</label>
            <CustomSelect
              value={form.from_id}
              onChange={(val) => { setForm(prev => ({ ...prev, from_id: val })); setError(null) }}
              options={options}
              placeholder="Source account"
              className="mt-1"
              searchable
            />
          </div>
          <div className="flex justify-center -my-1">
            <ArrowDown className="w-4 h-4 text-[#86868b]" />
          </div>
          <div>
            <label className="text-sm font-medium text-[#1d1d1f] dark:text-[#98989d]">To</label>
            <CustomSelect
              value={form.to_id}
              onChange={(val) => { setForm(prev => ({ ...prev, to_id: val })); setError(null) }}
              options={options.filter(o => o.value !== form.from_id)}
              placeholder="Destination account"
              className="mt-1"
              searchable
            />
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
          </div>

          {payingCard && expensePortion > 0 && (
            <p className="text-[11px] text-[#86868b] bg-[#f5f5f7] dark:bg-white/[0.06] rounded-xl px-3 py-2">
              {formatCurrency(expensePortion)} of this clears dues from before you started tracking this card, so it is
              recorded as a <span className="font-medium text-[#1d1d1f] dark:text-white">Credit Card Bill</span> expense
              {enteredInr > expensePortion ? "; the rest was already logged when you spent it, so it moves as a transfer." : "."}
            </p>
          )}

          {/* Date */}
          <div>
            <label className="text-sm font-medium text-[#1d1d1f] dark:text-[#98989d]">Date</label>
            <input
              type="date"
              required
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
              placeholder={payingCard ? "e.g. August statement" : "e.g. ATM withdrawal"}
              className="mt-1 w-full px-4 py-3 rounded-xl bg-[#f5f5f7] dark:bg-white/[0.06] border-0 text-sm text-[#1d1d1f] dark:text-white placeholder:text-[#86868b] focus:outline-none focus:ring-2 focus:ring-[#1d1d1f]/10 dark:focus:ring-white/10"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 rounded-xl px-4 py-3">
              Couldn&apos;t {payingCard ? "pay" : "transfer"}: {error}
            </p>
          )}

          <button
            type="submit"
            disabled={saving || !form.amount || !form.from_id || !form.to_id || form.from_id === form.to_id}
            className="w-full py-3 rounded-xl bg-[#1d1d1f] dark:bg-white/[0.12] text-white font-medium hover:opacity-90 transition-all disabled:opacity-50"
          >
            {saving && <><Loader2 className="w-4 h-4 animate-spin inline mr-2" />{payingCard ? "Paying..." : "Transferring..."}</>}
            {!saving && (payingCard ? "Pay Bill" : "Transfer")}
          </button>
        </form>
      </div>
    </div>
  )
}
