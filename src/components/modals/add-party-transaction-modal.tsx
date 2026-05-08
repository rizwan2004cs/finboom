"use client"

import { useState, useEffect } from "react"
import { useUser } from "@clerk/nextjs"
import { fetchTable, insertRow } from "@/lib/offline"
import { X, ArrowUpRight, ArrowDownLeft, ArrowDownRight, ArrowUpLeft, Plus } from "lucide-react"
import type { Party } from "@/lib/types"
import { PARTY_TRANSACTION_TYPES } from "@/lib/constants"

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
  const { user } = useUser()
  const [saving, setSaving] = useState(false)
  const [parties, setParties] = useState<Party[]>([])
  const [showNewParty, setShowNewParty] = useState(false)
  const [newPartyName, setNewPartyName] = useState("")
  const [form, setForm] = useState({
    party_id: preselectedPartyId || "",
    type: preselectedType || "lent" as "lent" | "received_back" | "borrowed" | "paid_back",
    amount: "",
    date: new Date().toISOString().slice(0, 10),
    due_date: "",
    notes: "",
  })

  useEffect(() => {
    if (!user) return
    fetchTable<Party>("parties", user.id, { order: { column: "name", ascending: true } })
      .then(data => setParties(data))
  }, [user])

  async function handleCreateParty() {
    if (!user || !newPartyName.trim()) return
    const { data } = await insertRow<Party>("parties", { user_id: user.id, name: newPartyName.trim() })
    if (data) {
      setParties(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)))
      setForm(prev => ({ ...prev, party_id: data.id }))
      setShowNewParty(false)
      setNewPartyName("")
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!user || !form.party_id || !form.amount) return
    setSaving(true)

    await insertRow("party_transactions", {
      user_id: user.id,
      party_id: form.party_id,
      type: form.type,
      amount: parseFloat(form.amount),
      currency: "INR",
      date: form.date,
      due_date: form.due_date || null,
      notes: form.notes.trim() || null,
    })

    setSaving(false)
    onSave()
  }

  return (
    <div className="fixed inset-0 z-60 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-2xl border border-white/40 shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="sm:hidden flex justify-center pt-3">
          <div className="w-10 h-1 rounded-full bg-black/[0.08]" />
        </div>

        <div className="flex items-center justify-between p-5 border-b border-black/[0.04]">
          <h2 className="text-lg font-bold text-[#1d1d1f]">Party Transaction</h2>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-[#f5f5f7] transition-all">
            <X className="w-5 h-5 text-[#86868b]" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 pb-8 sm:pb-5 space-y-4">
          {/* Type selector */}
          <div>
            <label className="text-sm font-medium text-[#1d1d1f]">Type</label>
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
                        ? "bg-[#1d1d1f]/[0.08] border-2 border-[#1d1d1f]"
                        : "bg-[#f5f5f7] border-2 border-transparent"
                    }`}
                  >
                    <Icon className="w-4 h-4 text-[#1d1d1f] flex-shrink-0" />
                    <div>
                      <p className="text-[12px] font-medium text-[#1d1d1f]">{t.label}</p>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Party selector */}
          <div>
            <label className="text-sm font-medium text-[#1d1d1f]">Party</label>
            {!showNewParty ? (
              <div className="mt-1 flex gap-2">
                <select
                  value={form.party_id}
                  onChange={(e) => setForm(prev => ({ ...prev, party_id: e.target.value }))}
                  required
                  className="flex-1 px-4 py-3 rounded-xl bg-[#f5f5f7] border-0 text-sm text-[#1d1d1f] focus:outline-none focus:ring-2 focus:ring-[#1d1d1f]/10"
                >
                  <option value="">Select person</option>
                  {parties.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setShowNewParty(true)}
                  className="p-3 rounded-xl bg-[#f5f5f7] hover:bg-[#e8e8ed] transition-all"
                  title="Add new party"
                >
                  <Plus className="w-5 h-5 text-[#1d1d1f]" />
                </button>
              </div>
            ) : (
              <div className="mt-1 flex gap-2">
                <input
                  type="text"
                  value={newPartyName}
                  onChange={(e) => setNewPartyName(e.target.value)}
                  placeholder="Enter name"
                  autoFocus
                  className="flex-1 px-4 py-3 rounded-xl bg-[#f5f5f7] border-0 text-sm text-[#1d1d1f] placeholder:text-[#86868b] focus:outline-none focus:ring-2 focus:ring-[#1d1d1f]/10"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") { e.preventDefault(); handleCreateParty() }
                    if (e.key === "Escape") { setShowNewParty(false); setNewPartyName("") }
                  }}
                />
                <button
                  type="button"
                  onClick={handleCreateParty}
                  disabled={!newPartyName.trim()}
                  className="px-4 py-3 rounded-xl bg-[#1d1d1f] text-white text-sm font-medium hover:opacity-90 transition-all disabled:opacity-50"
                >
                  Add
                </button>
                <button
                  type="button"
                  onClick={() => { setShowNewParty(false); setNewPartyName("") }}
                  className="p-3 rounded-xl bg-[#f5f5f7] hover:bg-[#e8e8ed] transition-all"
                >
                  <X className="w-5 h-5 text-[#86868b]" />
                </button>
              </div>
            )}
          </div>

          {/* Amount */}
          <div>
            <label className="text-sm font-medium text-[#1d1d1f]">Amount (₹)</label>
            <input
              type="number"
              required
              step="0.01"
              value={form.amount}
              onChange={(e) => setForm(prev => ({ ...prev, amount: e.target.value }))}
              placeholder="0"
              className="mt-1 w-full px-4 py-3 rounded-xl bg-[#f5f5f7] border-0 text-2xl font-bold text-[#1d1d1f] placeholder:text-[#86868b] focus:outline-none focus:ring-2 focus:ring-[#1d1d1f]/10 text-center"
            />
          </div>

          {/* Date */}
          <div>
            <label className="text-sm font-medium text-[#1d1d1f]">Date</label>
            <input
              type="date"
              value={form.date}
              onChange={(e) => setForm(prev => ({ ...prev, date: e.target.value }))}
              className="mt-1 w-full px-4 py-3 rounded-xl bg-[#f5f5f7] border-0 text-sm text-[#1d1d1f] focus:outline-none focus:ring-2 focus:ring-[#1d1d1f]/10"
            />
          </div>

          {/* Due date — only for lent and borrowed */}
          {(form.type === "lent" || form.type === "borrowed") && (
            <div>
              <label className="text-sm font-medium text-[#1d1d1f]">
                Reminder / Due Date <span className="text-[#86868b] font-normal">(optional)</span>
              </label>
              <input
                type="date"
                value={form.due_date}
                onChange={(e) => setForm(prev => ({ ...prev, due_date: e.target.value }))}
                className="mt-1 w-full px-4 py-3 rounded-xl bg-[#f5f5f7] border-0 text-sm text-[#1d1d1f] focus:outline-none focus:ring-2 focus:ring-[#1d1d1f]/10"
              />
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="text-sm font-medium text-[#1d1d1f]">Notes (optional)</label>
            <input
              type="text"
              value={form.notes}
              onChange={(e) => setForm(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="e.g. For trip expenses"
              className="mt-1 w-full px-4 py-3 rounded-xl bg-[#f5f5f7] border-0 text-sm text-[#1d1d1f] placeholder:text-[#86868b] focus:outline-none focus:ring-2 focus:ring-[#1d1d1f]/10"
            />
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={saving || !form.amount || !form.party_id}
            className="w-full py-3 rounded-xl bg-[#1d1d1f] text-white font-medium hover:opacity-90 transition-all disabled:opacity-50"
          >
            {saving ? "Saving..." : "Add Entry"}
          </button>
        </form>
      </div>
    </div>
  )
}
