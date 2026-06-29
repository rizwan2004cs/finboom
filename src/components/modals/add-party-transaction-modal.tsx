"use client"

import { useState, useEffect } from "react"
import { useUser } from "@/hooks/use-auth"
import { useProfile } from "@/hooks/use-profile"
import { fetchTable, insertRow, updateRow } from "@/lib/offline"
import { createClient } from "@/utils/supabase/client"
import {
  sanitizePhone,
  isValidPhone,
  isValidISODate,
  isFutureISODate,
  todayLocalISO,
  PHONE_MAX_LENGTH,
} from "@/lib/utils"
import { X, ArrowUpRight, ArrowDownLeft, ArrowDownRight, ArrowUpLeft, Plus, Loader2 } from "lucide-react"
import type { Party } from "@/lib/types"
import { PARTY_TRANSACTION_TYPES } from "@/lib/constants"
import { CustomSelect } from "@/components/custom-select"
import { useCurrency } from "@/hooks/use-currency"

const typeIcons = {
  lent: ArrowUpRight,
  received_back: ArrowDownLeft,
  borrowed: ArrowDownRight,
  paid_back: ArrowUpLeft,
}

interface Props {
  onClose: () => void
  onSave: () => void
  preselectedPartyId?: string
  preselectedType?: "lent" | "received_back" | "borrowed" | "paid_back"
}

export function AddPartyTransactionModal({ onClose, onSave, preselectedPartyId, preselectedType }: Props) {
  const { symbol } = useCurrency()
  const { user } = useUser()
  const { activeProfile } = useProfile()
  const [saving, setSaving] = useState(false)
  const [parties, setParties] = useState<Party[]>([])
  const [showNewParty, setShowNewParty] = useState(false)
  const [newPartyName, setNewPartyName] = useState("")
  const [newPartyPhone, setNewPartyPhone] = useState("")
  const [newPartyNotes, setNewPartyNotes] = useState("")
  const [form, setForm] = useState({
    party_id: preselectedPartyId || "",
    type: preselectedType || "lent" as "lent" | "received_back" | "borrowed" | "paid_back",
    amount: "",
    date: todayLocalISO(),
    due_date: "",
    notes: "",
  })
  const [error, setError] = useState("")

  const newPartyPhoneInvalid = newPartyPhone.length > 0 && !isValidPhone(newPartyPhone)
  const todayStr = todayLocalISO()

  useEffect(() => {
    if (!user) return
    fetchTable<Party>("parties", user.id, { order: { column: "name", ascending: true } })
      .then(data => setParties(data))
  }, [user])

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
      setForm(prev => ({ ...prev, party_id: data.id }))
      setShowNewParty(false)
      setNewPartyName("")
      setNewPartyPhone("")
      setNewPartyNotes("")
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!user || !form.party_id || !form.amount) return

    const amount = parseFloat(form.amount)
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Enter an amount greater than 0.")
      return
    }
    if (!isValidISODate(form.date) || isFutureISODate(form.date)) {
      setError("Pick a valid date — it cannot be in the future.")
      return
    }
    if (form.due_date && (!isValidISODate(form.due_date) || form.due_date < form.date)) {
      setError("Due date cannot be before the transaction date.")
      return
    }
    setError("")
    setSaving(true)

    try {
      const partyName = parties.find(p => p.id === form.party_id)?.name || "Party"

      // Create the party transaction
      const { data: ptData, error: ptError } = await insertRow<{ id: string }>("party_transactions", {
        user_id: user.id,
        party_id: form.party_id,
        type: form.type,
        amount,
        currency: "INR",
        date: form.date,
        due_date: form.due_date || null,
        notes: form.notes.trim() || null,
      })

      if (ptError) {
        console.error("[party-tx] Insert failed:", ptError)
        setSaving(false)
        return
      }

      // Auto-create linked income/expense transaction and store link
      if (ptData) {
        let profileId = activeProfile?.id
        // Fallback: fetch profile directly if not available from context
        if (!profileId) {
          const supabase = createClient()
          const { data: profiles } = await supabase
            .from("profiles")
            .select("id")
            .eq("user_id", user.id)
            .limit(1)
          profileId = profiles?.[0]?.id
        }

        if (profileId) {
          let txInsert: Record<string, unknown> | null = null

          if (form.type === "received_back") {
            txInsert = {
              user_id: user.id,
              profile_id: profileId,
              type: "income",
              category: "other",
              amount,
              description: `Received back from ${partyName}`,
              date: form.date,
              currency: "INR",
            }
          } else if (form.type === "paid_back") {
            txInsert = {
              user_id: user.id,
              profile_id: profileId,
              type: "expense",
              category: "other",
              amount,
              description: `Paid back to ${partyName}`,
              date: form.date,
              currency: "INR",
            }
          } else if (form.type === "lent") {
            txInsert = {
              user_id: user.id,
              profile_id: profileId,
              type: "expense",
              category: "other",
              amount,
              description: `Lent to ${partyName}`,
              date: form.date,
              currency: "INR",
            }
          } else if (form.type === "borrowed") {
            txInsert = {
              user_id: user.id,
              profile_id: profileId,
              type: "income",
              category: "other",
              amount,
              description: `Borrowed from ${partyName}`,
              date: form.date,
              currency: "INR",
            }
          }

          if (txInsert) {
            const { data: txData } = await insertRow<{ id: string }>("transactions", txInsert)
            // Link the party_transaction to the auto-created transaction through
            // the offline layer so the link is also recorded offline.
            if (txData) {
              await updateRow("party_transactions", ptData.id, { linked_transaction_id: txData.id })
            }
          }
        }
      }
    } catch (err) {
      console.error("[party-tx] handleSubmit error:", err)
    }

    setSaving(false)
    onSave()
  }

  return (
    <div className="fixed inset-0 z-60 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-md glass-elevated rounded-t-3xl sm:rounded-2xl shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="sm:hidden flex justify-center pt-3">
          <div className="w-10 h-1 rounded-full bg-black/[0.08] dark:bg-white/20" />
        </div>

        <div className="flex items-center justify-between p-5 border-b border-black/[0.04] dark:border-white/[0.06]">
          <h2 className="text-lg font-bold text-[#1d1d1f] dark:text-white">Party Transaction</h2>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-[#f5f5f7] dark:hover:bg-white/[0.08] transition-all">
            <X className="w-5 h-5 text-[#86868b]" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 pb-8 sm:pb-5 space-y-4">
          {/* Type selector */}
          <div>
            <label className="text-sm font-medium text-[#1d1d1f] dark:text-[#98989d]">Type</label>
            <div className="grid grid-cols-2 gap-2 mt-2">
              {PARTY_TRANSACTION_TYPES.map(t => {
                const Icon = typeIcons[t.id]
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setForm(prev => ({ ...prev, type: t.id }))}
                    className={`flex items-center gap-2 p-3 rounded-xl text-left transition-all ${
                      form.type === t.id
                        ? "bg-[#1d1d1f]/[0.08] dark:bg-white/[0.12] border-2 border-[#1d1d1f] dark:border-white"
                        : "bg-white/50 dark:bg-white/[0.06] border-2 border-transparent"
                    }`}
                  >
                    <Icon className="w-4 h-4 text-[#1d1d1f] dark:text-white flex-shrink-0" />
                    <div>
                      <p className="text-[12px] font-medium text-[#1d1d1f] dark:text-white">{t.label}</p>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Party selector */}
          <div>
            <label className="text-sm font-medium text-[#1d1d1f] dark:text-[#98989d]">Party</label>
            {!showNewParty ? (
              <div className="mt-1 flex gap-2">
                <CustomSelect
                  value={form.party_id}
                  onChange={(val) => setForm(prev => ({ ...prev, party_id: val }))}
                  required
                  options={parties.map(p => ({ value: p.id, label: p.name }))}
                  placeholder="Select person"
                  className="flex-1"
                  variant="glass"
                />
                <button
                  type="button"
                  onClick={() => setShowNewParty(true)}
                  className="p-3 rounded-xl bg-white/50 dark:bg-white/[0.06] border border-white/40 dark:border-white/[0.06] hover:bg-white/70 dark:hover:bg-white/[0.1] transition-all"
                  title="Add new party"
                >
                  <Plus className="w-5 h-5 text-[#1d1d1f] dark:text-white" />
                </button>
              </div>
            ) : (
              <div className="mt-1 space-y-2 p-3 rounded-xl bg-[#f5f5f7]/50 dark:bg-white/[0.03] border border-black/[0.04] dark:border-white/[0.06]">
                <input
                  type="text"
                  value={newPartyName}
                  onChange={(e) => setNewPartyName(e.target.value)}
                  placeholder="Name *"
                  autoFocus
                  className="w-full px-4 py-2.5 rounded-xl bg-[#f5f5f7] dark:bg-[#2c2c2e] border-0 text-sm text-[#1d1d1f] dark:text-white placeholder:text-[#86868b] focus:outline-none focus:ring-2 focus:ring-[#1d1d1f]/10 dark:focus:ring-white/10"
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
                  className="w-full px-4 py-2.5 rounded-xl bg-[#f5f5f7] dark:bg-[#2c2c2e] border-0 text-sm text-[#1d1d1f] dark:text-white placeholder:text-[#86868b] focus:outline-none focus:ring-2 focus:ring-[#1d1d1f]/10 dark:focus:ring-white/10"
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
                  className="w-full px-4 py-2.5 rounded-xl bg-[#f5f5f7] dark:bg-[#2c2c2e] border-0 text-sm text-[#1d1d1f] dark:text-white placeholder:text-[#86868b] focus:outline-none focus:ring-2 focus:ring-[#1d1d1f]/10 dark:focus:ring-white/10"
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
                    className="py-2.5 px-4 rounded-xl bg-[#f5f5f7] dark:bg-[#2c2c2e] text-sm font-medium text-[#86868b] hover:bg-[#e8e8ed] dark:hover:bg-[#3a3a3c] transition-all"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
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
              className="mt-1 w-full px-4 py-3 rounded-xl bg-white/50 dark:bg-white/[0.06] border border-white/40 dark:border-white/[0.06] text-2xl font-bold text-[#1d1d1f] dark:text-white placeholder:text-[#86868b] focus:outline-none focus:ring-2 focus:ring-[#1d1d1f]/10 dark:focus:ring-white/10 text-center"
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
              className="mt-1 w-full px-4 py-3 rounded-xl bg-white/50 dark:bg-white/[0.06] border border-white/40 dark:border-white/[0.06] text-sm text-[#1d1d1f] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#1d1d1f]/10 dark:focus:ring-white/10 dark:[color-scheme:dark]"
            />
          </div>

          {/* Due date — only for lent and borrowed */}
          {(form.type === "lent" || form.type === "borrowed") && (
            <div>
              <label className="text-sm font-medium text-[#1d1d1f] dark:text-[#98989d]">
                Reminder / Due Date <span className="text-[#86868b] font-normal">(optional)</span>
              </label>
              <input
                type="date"
                min={form.date || todayStr}
                value={form.due_date}
                onChange={(e) => { setForm(prev => ({ ...prev, due_date: e.target.value })); setError("") }}
                onFocus={(e) => setTimeout(() => e.target.scrollIntoView({ behavior: "smooth", block: "center" }), 100)}
                className="mt-1 w-full px-4 py-3 rounded-xl bg-white/50 dark:bg-white/[0.06] border border-white/40 dark:border-white/[0.06] text-sm text-[#1d1d1f] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#1d1d1f]/10 dark:focus:ring-white/10 dark:[color-scheme:dark]"
              />
              {form.due_date && form.due_date < form.date && (
                <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                  Due date cannot be before the transaction date.
                </p>
              )}
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="text-sm font-medium text-[#1d1d1f] dark:text-[#98989d]">Notes (optional)</label>
            <input
              type="text"
              value={form.notes}
              onChange={(e) => setForm(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="e.g. For trip expenses"
              className="mt-1 w-full px-4 py-3 rounded-xl bg-white/50 dark:bg-white/[0.06] border border-white/40 dark:border-white/[0.06] text-sm text-[#1d1d1f] dark:text-white placeholder:text-[#86868b] focus:outline-none focus:ring-2 focus:ring-[#1d1d1f]/10 dark:focus:ring-white/10"
            />
          </div>

          {/* Submit */}
          {error && (
            <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
          )}
          <button
            type="submit"
            disabled={saving || !form.amount || !form.party_id || !!error}
            className="w-full py-3 rounded-xl bg-[#1d1d1f] text-white font-medium hover:opacity-90 transition-all disabled:opacity-50"
          >
            {saving ? <><Loader2 className="w-4 h-4 animate-spin inline mr-2" />Saving...</> : "Add Entry"}
          </button>
        </form>
      </div>
    </div>
  )
}
