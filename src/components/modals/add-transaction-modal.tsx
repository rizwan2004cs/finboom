"use client"

import { useState, useEffect } from "react"
import { useUser } from "@/hooks/use-auth"
import { useProfile } from "@/hooks/use-profile"
import { deleteRow, fetchTable, insertRow, updateRow } from "@/lib/offline"
import {
  sanitizePhone,
  isValidPhone,
  isValidISODate,
  isFutureISODate,
  todayLocalISO,
  PHONE_MAX_LENGTH,
} from "@/lib/utils"
import { X, Plus, Loader2 } from "lucide-react"
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from "@/lib/constants"
import { CategoryIcon } from "@/components/category-icon"
import type { Party, Transaction } from "@/lib/types"
import { CustomSelect } from "@/components/custom-select"
import { useCurrency } from "@/hooks/use-currency"

interface Props {
  transaction?: Transaction | null
  onClose: () => void
  onSave: () => void
}

export function AddTransactionModal({ transaction, onClose, onSave }: Props) {
  const isEditing = !!transaction
  const { symbol, currency, toINR, convert } = useCurrency()
  const { user } = useUser()
  const { activeProfile } = useProfile()
  const [saving, setSaving] = useState(false)
  const [parties, setParties] = useState<Party[]>([])
  const [showNewParty, setShowNewParty] = useState(false)
  const [newPartyName, setNewPartyName] = useState("")
  const [newPartyPhone, setNewPartyPhone] = useState("")
  const [newPartyNotes, setNewPartyNotes] = useState("")
  const [form, setForm] = useState({
    type: (transaction?.type || "expense") as "income" | "expense",
    category: transaction?.category || "",
    // Stored amounts are INR; the field is labeled in the display currency, so
    // prefill the converted value when editing (round-trips through toINR on save).
    amount: transaction?.amount != null
      ? String(Math.round(convert(Number(transaction.amount)) * 100) / 100)
      : "",
    description: transaction?.description || "",
    date: transaction?.date || todayLocalISO(),
    spent_for_party_id: "",
    due_date: "",
  })
  const [error, setError] = useState("")

  const newPartyPhoneInvalid = newPartyPhone.length > 0 && !isValidPhone(newPartyPhone)
  const todayStr = todayLocalISO()

  useEffect(() => {
    if (!user) return
    fetchTable<Party>("parties", user.id, { order: { column: "name", ascending: true } })
      .then(data => setParties(data))
  }, [user])

  const categories = form.type === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES

  async function handleCreateParty() {
    if (!user || !newPartyName.trim()) return
    const phone = sanitizePhone(newPartyPhone)
    if (!isValidPhone(phone)) return
    const { data } = await insertRow<Party>("parties", {
      user_id: user.id,
      name: newPartyName.trim(),
      phone: phone || null,
      notes: newPartyNotes.trim() || null,
    })
    if (data) {
      setParties(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)))
      setForm(prev => ({ ...prev, spent_for_party_id: data.id }))
      setShowNewParty(false)
      setNewPartyName("")
      setNewPartyPhone("")
      setNewPartyNotes("")
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return

    const amount = parseFloat(form.amount)
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Enter an amount greater than 0.")
      return
    }
    if (!isValidISODate(form.date) || isFutureISODate(form.date)) {
      setError("Pick a valid date — it cannot be in the future.")
      return
    }
    if (form.spent_for_party_id && form.due_date && (!isValidISODate(form.due_date) || form.due_date < form.date)) {
      setError("Due date cannot be before the transaction date.")
      return
    }
    setError("")
    setSaving(true)

    // The field is labeled in the display currency — normalise to INR for
    // storage (the whole app aggregates in INR). No-op when currency is INR.
    const amountInr = Math.round(toINR(amount, currency) * 100) / 100

    if (isEditing) {
      await updateRow("transactions", transaction.id, {
        type: form.type,
        category: form.category || categories[0].id,
        amount: amountInr,
        description: form.description || null,
        date: form.date,
      })
      // Keep any linked party receivable/payable in sync with the edited amount
      // and date, so editing a "spent for someone" expense doesn't leave a stale
      // party balance behind. If the transaction was flipped to income it can no
      // longer back a receivable — remove the link instead of updating it.
      const linked = (await fetchTable<{ id: string; linked_transaction_id?: string }>(
        "party_transactions", user.id
      )).filter((pt) => pt.linked_transaction_id === transaction.id)
      for (const pt of linked) {
        if (form.type === "income") {
          await deleteRow("party_transactions", pt.id)
        } else {
          await updateRow("party_transactions", pt.id, { amount: amountInr, date: form.date })
        }
      }
    } else {
      const { data: txData } = await insertRow("transactions", {
        user_id: user.id,
        profile_id: activeProfile!.id,
        type: form.type,
        category: form.category || categories[0].id,
        amount: amountInr,
        description: form.description || null,
        date: form.date,
        currency: "INR",
      })

      // If expense was "spent for" a party, also create a party_transaction (lent)
      if (form.type === "expense" && form.spent_for_party_id && txData) {
        await insertRow("party_transactions", {
          user_id: user.id,
          party_id: form.spent_for_party_id,
          type: "lent",
          amount: amountInr,
          currency: "INR",
          date: form.date,
          due_date: form.due_date || null,
          notes: form.description || null,
          linked_transaction_id: txData.id,
        })
      }
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
          <h2 className="text-lg font-bold text-[#1d1d1f] dark:text-white">{isEditing ? "Edit Transaction" : "Add Transaction"}</h2>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-[#f5f5f7] dark:hover:bg-white/[0.08] transition-all">
            <X className="w-5 h-5 text-[#86868b]" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 pb-8 sm:pb-5 space-y-4">
          {/* Type toggle */}
          <div className="flex bg-[#f5f5f7] dark:bg-white/[0.06] rounded-xl p-1">
            <button
              type="button"
              onClick={() => setForm(prev => ({ ...prev, type: "expense", category: "" }))}
              className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${
                form.type === "expense" ? "bg-white dark:bg-white/[0.12] text-[#1d1d1f] dark:text-white shadow-sm" : "text-[#86868b]"
              }`}
            >
              Expense
            </button>
            <button
              type="button"
              onClick={() => setForm(prev => ({ ...prev, type: "income", category: "" }))}
              className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${
                form.type === "income" ? "bg-white dark:bg-white/[0.12] text-[#1d1d1f] dark:text-white shadow-sm" : "text-[#86868b]"
              }`}
            >
              Income
            </button>
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
              onChange={(e) => { setForm(prev => ({ ...prev, amount: e.target.value })); setError("") }}
              placeholder="0"
              className="mt-1 w-full px-4 py-3 rounded-xl bg-[#f5f5f7] dark:bg-white/[0.06] border-0 text-2xl font-bold text-[#1d1d1f] dark:text-white placeholder:text-[#86868b] focus:outline-none focus:ring-2 focus:ring-[#1d1d1f]/10 dark:focus:ring-white/10 text-center"
            />
          </div>

          {/* Category */}
          <div>
            <label className="text-sm font-medium text-[#1d1d1f] dark:text-[#98989d]">Category</label>
            <div className="grid grid-cols-4 gap-2 mt-2">
              {categories.map(cat => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setForm(prev => ({ ...prev, category: cat.id }))}
                  className={`flex flex-col items-center gap-1 p-2.5 rounded-xl text-center transition-all ${
                    form.category === cat.id
                      ? "bg-[#1d1d1f]/[0.08] dark:bg-white/[0.12] border-2 border-[#1d1d1f] dark:border-white/60"
                      : "bg-[#f5f5f7] dark:bg-white/[0.06] border-2 border-transparent"
                  }`}
                >
                  <CategoryIcon name={cat.icon} className="w-4 h-4 text-[#1d1d1f] dark:text-white" />
                  <span className="text-[10px] text-[#86868b] leading-tight">{cat.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="text-sm font-medium text-[#1d1d1f] dark:text-[#98989d]">Description (optional)</label>
            <input
              type="text"
              value={form.description}
              onChange={(e) => setForm(prev => ({ ...prev, description: e.target.value }))}
              placeholder="e.g. Swiggy order"
              className="mt-1 w-full px-4 py-3 rounded-xl bg-[#f5f5f7] dark:bg-white/[0.06] border-0 text-sm text-[#1d1d1f] dark:text-white placeholder:text-[#86868b] focus:outline-none focus:ring-2 focus:ring-[#1d1d1f]/10 dark:focus:ring-white/10"
            />
          </div>

          {/* Date */}
          <div>
            <label className="text-sm font-medium text-[#1d1d1f] dark:text-[#98989d]">Date</label>
            <input
              type="date"
              required
              max={todayStr}
              value={form.date}
              onChange={(e) => { setForm(prev => ({ ...prev, date: e.target.value })); setError("") }}
              onFocus={(e) => setTimeout(() => e.target.scrollIntoView({ behavior: "smooth", block: "center" }), 100)}
              className="mt-1 w-full px-4 py-3 rounded-xl bg-[#f5f5f7] dark:bg-white/[0.06] border-0 text-sm text-[#1d1d1f] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#1d1d1f]/10 dark:focus:ring-white/10 dark:[color-scheme:dark]"
            />
          </div>

          {/* Spent For — new expenses only. In edit mode the selection was
              silently discarded on save (no link is created on update), so
              don't offer it there rather than break the promise in the hint. */}
          {!isEditing && form.type === "expense" && (
            <div>
              <label className="text-sm font-medium text-[#1d1d1f] dark:text-[#98989d]">Spent for (optional)</label>
              <p className="text-[11px] text-[#86868b] mt-0.5">If spent for someone else, it will be tracked as receivable</p>
              <div className="flex gap-2 mt-1">
                <CustomSelect
                  value={form.spent_for_party_id}
                  onChange={(val) => setForm(prev => ({ ...prev, spent_for_party_id: val }))}
                  options={[{ value: "", label: "For myself" }, ...parties.map(p => ({ value: p.id, label: p.name }))]}
                  placeholder="For myself"
                  className="flex-1"
                />
                <button
                  type="button"
                  onClick={() => setShowNewParty(!showNewParty)}
                  className="p-3 rounded-xl bg-[#f5f5f7] dark:bg-white/[0.06] hover:bg-[#e8e8ed] dark:hover:bg-white/[0.1] transition-all"
                >
                  <Plus className="w-4 h-4 text-[#1d1d1f] dark:text-white" />
                </button>
              </div>
              {showNewParty && (
                <div className="mt-2 space-y-2 p-3 rounded-xl bg-[#f5f5f7]/50 dark:bg-white/[0.03] border border-black/[0.04] dark:border-white/[0.06]">
                  <input
                    type="text"
                    value={newPartyName}
                    onChange={(e) => setNewPartyName(e.target.value)}
                    placeholder="Name *"
                    autoFocus
                    className="w-full px-4 py-2.5 rounded-xl bg-[#f5f5f7] dark:bg-white/[0.06] border-0 text-sm text-[#1d1d1f] dark:text-white placeholder:text-[#86868b] focus:outline-none focus:ring-2 focus:ring-[#1d1d1f]/10 dark:focus:ring-white/10"
                  />
                  <input
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel"
                    maxLength={PHONE_MAX_LENGTH}
                    pattern="[0-9]{6,15}"
                    value={newPartyPhone}
                    onChange={(e) => setNewPartyPhone(sanitizePhone(e.target.value))}
                    placeholder="Phone (optional)"
                    className="w-full px-4 py-2.5 rounded-xl bg-[#f5f5f7] dark:bg-white/[0.06] border-0 text-sm text-[#1d1d1f] dark:text-white placeholder:text-[#86868b] focus:outline-none focus:ring-2 focus:ring-[#1d1d1f]/10 dark:focus:ring-white/10"
                  />
                  {newPartyPhoneInvalid && (
                    <p className="text-xs text-red-600 dark:text-red-400">
                      Enter a valid phone number — 6 to 15 digits.
                    </p>
                  )}
                  <input
                    type="text"
                    value={newPartyNotes}
                    onChange={(e) => setNewPartyNotes(e.target.value)}
                    placeholder="Notes (optional)"
                    className="w-full px-4 py-2.5 rounded-xl bg-[#f5f5f7] dark:bg-white/[0.06] border-0 text-sm text-[#1d1d1f] dark:text-white placeholder:text-[#86868b] focus:outline-none focus:ring-2 focus:ring-[#1d1d1f]/10 dark:focus:ring-white/10"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleCreateParty}
                      disabled={!newPartyName.trim() || newPartyPhoneInvalid}
                      className="flex-1 py-2.5 rounded-xl bg-[#1d1d1f] text-white text-sm font-medium hover:opacity-90 transition-all disabled:opacity-50"
                    >
                      Add Party
                    </button>
                    <button
                      type="button"
                      onClick={() => { setShowNewParty(false); setNewPartyName(""); setNewPartyPhone(""); setNewPartyNotes("") }}
                      className="py-2.5 px-4 rounded-xl bg-[#f5f5f7] dark:bg-white/[0.06] text-sm font-medium text-[#86868b] hover:bg-[#e8e8ed] dark:hover:bg-white/[0.1] transition-all"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
              {form.spent_for_party_id && (
                <div className="mt-3">
                  <label className="text-sm font-medium text-[#1d1d1f] dark:text-[#98989d]">
                    Due Date <span className="text-[#86868b] font-normal">(optional)</span>
                  </label>
                  <input
                    type="date"
                    min={form.date || todayStr}
                    value={form.due_date}
                    onChange={(e) => { setForm(prev => ({ ...prev, due_date: e.target.value })); setError("") }}
                    onFocus={(e) => setTimeout(() => e.target.scrollIntoView({ behavior: "smooth", block: "center" }), 100)}
                    className="mt-1 w-full px-4 py-3 rounded-xl bg-[#f5f5f7] dark:bg-white/[0.06] border-0 text-sm text-[#1d1d1f] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#1d1d1f]/10 dark:focus:ring-white/10 dark:[color-scheme:dark]"
                  />
                  {form.due_date && form.due_date < form.date && (
                    <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                      Due date cannot be before the transaction date.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Submit */}
          {error && (
            <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
          )}
          <button
            type="submit"
            disabled={saving || !form.amount || !!error}
            className="w-full py-3 rounded-xl bg-[#1d1d1f] dark:bg-white/[0.12] text-white font-medium hover:opacity-90 transition-all disabled:opacity-50"
          >
            {saving ? <><Loader2 className="w-4 h-4 animate-spin inline mr-2" />Saving...</> : isEditing ? "Update Transaction" : "Add Transaction"}
          </button>
        </form>
      </div>
    </div>
  )
}
