"use client"

import { useState } from "react"
import { useUser } from "@/hooks/use-auth"
import { useProfile } from "@/hooks/use-profile"
import { insertRow, updateRow } from "@/lib/offline"
import { X, Loader2 } from "lucide-react"
import type { Sip } from "@/lib/types"
import { useCurrency } from "@/hooks/use-currency"

interface Props {
  sip?: Sip | null
  onClose: () => void
  onSave: () => void
}

export function AddSipModal({ sip, onClose, onSave }: Readonly<Props>) {
  const isEditing = !!sip
  const { symbol } = useCurrency()
  const { user } = useUser()
  const { activeProfile } = useProfile()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    name: sip?.name || "",
    fund_name: sip?.fund_name || "",
    amount: sip?.amount?.toString() || "",
    sip_day: sip?.sip_day?.toString() || "1",
    active: sip?.active ?? true,
    reminder_enabled: sip?.reminder_enabled ?? true,
    notes: sip?.notes || "",
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!user || !activeProfile) return
    setSaving(true)

    const day = Math.min(31, Math.max(1, Number.parseInt(form.sip_day, 10) || 1))
    const data = {
      user_id: user.id,
      profile_id: activeProfile.id,
      name: form.name,
      fund_name: form.fund_name || null,
      amount: Number.parseFloat(form.amount) || 0,
      sip_day: day,
      active: form.active,
      reminder_enabled: form.reminder_enabled,
      notes: form.notes || null,
      currency: "INR",
      updated_at: new Date().toISOString(),
    }

    if (sip) {
      await updateRow("sips", sip.id, data)
    } else {
      await insertRow("sips", data)
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
          <h2 className="text-lg font-bold text-[#1d1d1f] dark:text-white">{isEditing ? "Edit SIP" : "Add SIP"}</h2>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-[#f5f5f7] dark:hover:bg-white/[0.08] transition-all">
            <X className="w-5 h-5 text-[#86868b]" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 pb-8 sm:pb-5 space-y-4">
          {/* Name */}
          <div>
            <label className="text-sm font-medium text-[#1d1d1f] dark:text-[#98989d]">SIP Name</label>
            <input
              type="text"
              required
              value={form.name}
              onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
              placeholder="e.g. Monthly Index SIP"
              className="mt-1 w-full px-4 py-3 rounded-xl bg-[#f5f5f7] dark:bg-white/[0.06] border-0 text-sm text-[#1d1d1f] dark:text-white placeholder:text-[#86868b] focus:outline-none focus:ring-2 focus:ring-[#1d1d1f]/10 dark:focus:ring-white/10"
            />
          </div>

          {/* Fund name */}
          <div>
            <label className="text-sm font-medium text-[#1d1d1f] dark:text-[#98989d]">Fund Name (optional)</label>
            <input
              type="text"
              value={form.fund_name}
              onChange={(e) => setForm(prev => ({ ...prev, fund_name: e.target.value }))}
              placeholder="e.g. UTI Nifty 50 Index Fund"
              className="mt-1 w-full px-4 py-3 rounded-xl bg-[#f5f5f7] dark:bg-white/[0.06] border-0 text-sm text-[#1d1d1f] dark:text-white placeholder:text-[#86868b] focus:outline-none focus:ring-2 focus:ring-[#1d1d1f]/10 dark:focus:ring-white/10"
            />
          </div>

          {/* Amount + day */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-[#1d1d1f] dark:text-[#98989d]">Amount ({symbol})</label>
              <input
                type="number"
                required
                min="1"
                step="any"
                value={form.amount}
                onChange={(e) => setForm(prev => ({ ...prev, amount: e.target.value }))}
                placeholder="0"
                className="mt-1 w-full px-4 py-3 rounded-xl bg-[#f5f5f7] dark:bg-white/[0.06] border-0 text-sm text-[#1d1d1f] dark:text-white placeholder:text-[#86868b] focus:outline-none focus:ring-2 focus:ring-[#1d1d1f]/10 dark:focus:ring-white/10"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-[#1d1d1f] dark:text-[#98989d]">Day of month</label>
              <input
                type="number"
                required
                min="1"
                max="31"
                value={form.sip_day}
                onChange={(e) => setForm(prev => ({ ...prev, sip_day: e.target.value }))}
                placeholder="1"
                className="mt-1 w-full px-4 py-3 rounded-xl bg-[#f5f5f7] dark:bg-white/[0.06] border-0 text-sm text-[#1d1d1f] dark:text-white placeholder:text-[#86868b] focus:outline-none focus:ring-2 focus:ring-[#1d1d1f]/10 dark:focus:ring-white/10"
              />
            </div>
          </div>
          <p className="text-[11px] text-[#86868b] -mt-2">Days after the 28th fall back to the last day in shorter months.</p>

          {/* Toggles */}
          <SipToggle
            label="Active"
            description="Counts toward your monthly total"
            checked={form.active}
            onChange={(v) => setForm(prev => ({ ...prev, active: v }))}
          />
          <SipToggle
            label="Reminders"
            description="Push notification before the SIP date"
            checked={form.reminder_enabled}
            onChange={(v) => setForm(prev => ({ ...prev, reminder_enabled: v }))}
          />

          {/* Notes */}
          <div>
            <label className="text-sm font-medium text-[#1d1d1f] dark:text-[#98989d]">Notes (optional)</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm(prev => ({ ...prev, notes: e.target.value }))}
              rows={2}
              className="mt-1 w-full px-4 py-3 rounded-xl bg-[#f5f5f7] dark:bg-white/[0.06] border-0 text-sm text-[#1d1d1f] dark:text-white placeholder:text-[#86868b] focus:outline-none focus:ring-2 focus:ring-[#1d1d1f]/10 dark:focus:ring-white/10 resize-none"
            />
          </div>

          <button
            type="submit"
            disabled={saving || !form.amount || !form.name}
            className="w-full py-3 rounded-xl bg-[#1d1d1f] dark:bg-white/[0.12] text-white font-medium hover:opacity-90 transition-all disabled:opacity-50"
          >
            {saving && <><Loader2 className="w-4 h-4 animate-spin inline mr-2" />Saving...</>}
            {!saving && (isEditing ? "Update SIP" : "Add SIP")}
          </button>
        </form>
      </div>
    </div>
  )
}

function SipToggle({ label, description, checked, onChange }: Readonly<{
  label: string
  description: string
  checked: boolean
  onChange: (v: boolean) => void
}>) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className="w-full flex items-center justify-between gap-3 text-left"
    >
      <span>
        <span className="block text-sm font-medium text-[#1d1d1f] dark:text-white">{label}</span>
        <span className="block text-[11px] text-[#86868b]">{description}</span>
      </span>
      <span
        className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors ${checked ? "bg-[#1d1d1f] dark:bg-white" : "bg-[#d1d1d6] dark:bg-white/20"}`}
      >
        <span className={`inline-block h-5 w-5 transform rounded-full bg-white dark:bg-[#1c1c1e] shadow transition-transform ${checked ? "translate-x-[22px]" : "translate-x-0.5"}`} />
      </span>
    </button>
  )
}
