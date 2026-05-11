"use client"

import { useState } from "react"
import { updateRow } from "@/lib/offline"
import { X, Loader2 } from "lucide-react"
import type { Party } from "@/lib/types"

interface Props {
  party: Party
  onClose: () => void
  onSave: () => void
}

export function EditPartyModal({ party, onClose, onSave }: Props) {
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    name: party.name,
    phone: party.phone || "",
    notes: party.notes || "",
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) return
    setSaving(true)

    await updateRow("parties", party.id, {
      name: form.name.trim(),
      phone: form.phone.trim() || null,
      notes: form.notes.trim() || null,
    })

    setSaving(false)
    onSave()
  }

  return (
    <div className="fixed inset-0 z-60 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-md bg-[#ffffff] dark:bg-[#1c1c1e] rounded-t-3xl sm:rounded-2xl border border-white/40 dark:border-white/[0.08] shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="sm:hidden flex justify-center pt-3">
          <div className="w-10 h-1 rounded-full bg-black/[0.08] dark:bg-white/20" />
        </div>
        <div className="flex items-center justify-between p-5 border-b border-black/[0.04] dark:border-white/[0.06]">
          <h2 className="text-lg font-bold text-[#1d1d1f] dark:text-white">Edit Party</h2>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-[#f5f5f7] dark:hover:bg-white/[0.08] transition-all">
            <X className="w-5 h-5 text-[#86868b]" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 pb-8 sm:pb-5 space-y-4">
          <div>
            <label className="text-sm font-medium text-[#1d1d1f] dark:text-[#98989d]">Name *</label>
            <input
              type="text"
              required
              value={form.name}
              onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
              placeholder="e.g. Rahul, Mom, Ankit"
              className="mt-1 w-full px-4 py-3 rounded-xl bg-[#f5f5f7] dark:bg-[#2c2c2e] border-0 text-sm text-[#1d1d1f] dark:text-white placeholder:text-[#86868b] focus:outline-none focus:ring-2 focus:ring-[#1d1d1f]/10 dark:focus:ring-white/10"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-[#1d1d1f] dark:text-[#98989d]">Phone (optional)</label>
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => setForm(prev => ({ ...prev, phone: e.target.value }))}
              placeholder="e.g. 9876543210"
              className="mt-1 w-full px-4 py-3 rounded-xl bg-[#f5f5f7] dark:bg-[#2c2c2e] border-0 text-sm text-[#1d1d1f] dark:text-white placeholder:text-[#86868b] focus:outline-none focus:ring-2 focus:ring-[#1d1d1f]/10 dark:focus:ring-white/10"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-[#1d1d1f] dark:text-[#98989d]">Notes (optional)</label>
            <input
              type="text"
              value={form.notes}
              onChange={(e) => setForm(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="e.g. College friend"
              className="mt-1 w-full px-4 py-3 rounded-xl bg-[#f5f5f7] dark:bg-[#2c2c2e] border-0 text-sm text-[#1d1d1f] dark:text-white placeholder:text-[#86868b] focus:outline-none focus:ring-2 focus:ring-[#1d1d1f]/10 dark:focus:ring-white/10"
            />
          </div>
          <button
            type="submit"
            disabled={saving || !form.name.trim()}
            className="w-full py-3 rounded-xl bg-[#1d1d1f] text-white font-medium hover:opacity-90 transition-all disabled:opacity-50"
          >
            {saving ? <><Loader2 className="w-4 h-4 animate-spin inline mr-2" />Saving...</> : "Save Changes"}
          </button>
        </form>
      </div>
    </div>
  )
}
