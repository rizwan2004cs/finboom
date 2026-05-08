"use client"

import { useState } from "react"
import { useUser } from "@clerk/nextjs"
import { createClient } from "@/utils/supabase/client"
import { X } from "lucide-react"
import { ASSET_CLASSES, CURRENCIES } from "@/lib/constants"
import type { Asset } from "@/lib/types"

interface Props {
  asset?: Asset | null
  onClose: () => void
  onSave: () => void
}

export function AddAssetModal({ asset, onClose, onSave }: Props) {
  const { user } = useUser()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    name: asset?.name || "",
    asset_class: asset?.asset_class || "stocks",
    current_value: asset?.current_value?.toString() || "",
    invested_value: asset?.invested_value?.toString() || "",
    currency: asset?.currency || "INR",
    units: asset?.units?.toString() || "",
    notes: asset?.notes || "",
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return
    setSaving(true)

    const supabase = createClient()
    const data = {
      user_id: user.id,
      name: form.name,
      asset_class: form.asset_class,
      current_value: parseFloat(form.current_value) || 0,
      invested_value: parseFloat(form.invested_value) || 0,
      currency: form.currency,
      units: form.units ? parseFloat(form.units) : null,
      notes: form.notes || null,
      updated_at: new Date().toISOString(),
    }

    if (asset) {
      await supabase.from("assets").update(data).eq("id", asset.id)
    } else {
      await supabase.from("assets").insert(data)
    }

    setSaving(false)
    onSave()
  }

  return (
    <div className="fixed inset-0 z-60 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-md glass-elevated rounded-t-3xl sm:rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Handle bar for mobile */}
        <div className="sm:hidden flex justify-center pt-3">
          <div className="w-10 h-1 rounded-full bg-black/[0.08] dark:bg-white/20" />
        </div>
        
        <div className="flex items-center justify-between p-5 border-b border-black/[0.04] dark:border-white/[0.06]">
          <h2 className="text-lg font-bold text-[#1d1d1f] dark:text-white">
            {asset ? "Edit Asset" : "Add Asset"}
          </h2>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-all">
            <X className="w-5 h-5 text-[#515154] dark:text-[#98989d]" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 pb-8 sm:pb-5 space-y-4">
          {/* Name */}
          <div>
            <label className="text-sm font-medium text-[#1d1d1f]">Name</label>
            <input
              type="text"
              required
              value={form.name}
              onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
              placeholder="e.g. Reliance Industries"
              className="mt-1 w-full px-4 py-3 rounded-xl bg-[#f5f5f7] border-0 text-sm text-[#1d1d1f] placeholder:text-[#86868b] focus:outline-none focus:ring-2 focus:ring-[#1d1d1f]/10"
            />
          </div>

          {/* Asset Class */}
          <div>
            <label className="text-sm font-medium text-[#1d1d1f]">Asset Class</label>
            <select
              value={form.asset_class}
              onChange={(e) => setForm(prev => ({ ...prev, asset_class: e.target.value }))}
              className="mt-1 w-full px-4 py-3 rounded-xl bg-[#f5f5f7] border-0 text-sm text-[#1d1d1f] focus:outline-none focus:ring-2 focus:ring-[#1d1d1f]/10"
            >
              {ASSET_CLASSES.map(cls => (
                <option key={cls.id} value={cls.id}>{cls.label}</option>
              ))}
            </select>
          </div>

          {/* Values */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-[#1d1d1f]">Current Value</label>
              <input
                type="number"
                required
                step="0.01"
                value={form.current_value}
                onChange={(e) => setForm(prev => ({ ...prev, current_value: e.target.value }))}
                placeholder="0"
                className="mt-1 w-full px-4 py-3 rounded-xl bg-[#f5f5f7] border-0 text-sm text-[#1d1d1f] placeholder:text-[#86868b] focus:outline-none focus:ring-2 focus:ring-[#1d1d1f]/10"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-[#1d1d1f]">Invested Value</label>
              <input
                type="number"
                step="0.01"
                value={form.invested_value}
                onChange={(e) => setForm(prev => ({ ...prev, invested_value: e.target.value }))}
                placeholder="0"
                className="mt-1 w-full px-4 py-3 rounded-xl bg-[#f5f5f7] border-0 text-sm text-[#1d1d1f] placeholder:text-[#86868b] focus:outline-none focus:ring-2 focus:ring-[#1d1d1f]/10"
              />
            </div>
          </div>

          {/* Currency & Units */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-[#1d1d1f]">Currency</label>
              <select
                value={form.currency}
                onChange={(e) => setForm(prev => ({ ...prev, currency: e.target.value }))}
                className="mt-1 w-full px-4 py-3 rounded-xl bg-[#f5f5f7] border-0 text-sm text-[#1d1d1f] focus:outline-none focus:ring-2 focus:ring-[#1d1d1f]/10"
              >
                {CURRENCIES.map(c => (
                  <option key={c.code} value={c.code}>{c.symbol} {c.code}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-[#1d1d1f]">Units (optional)</label>
              <input
                type="number"
                step="0.0001"
                value={form.units}
                onChange={(e) => setForm(prev => ({ ...prev, units: e.target.value }))}
                placeholder="e.g. 100"
                className="mt-1 w-full px-4 py-3 rounded-xl bg-[#f5f5f7] border-0 text-sm text-[#1d1d1f] placeholder:text-[#86868b] focus:outline-none focus:ring-2 focus:ring-[#1d1d1f]/10"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="text-sm font-medium text-[#1d1d1f]">Notes (optional)</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="Any additional details..."
              rows={2}
              className="mt-1 w-full px-4 py-3 rounded-xl bg-[#f5f5f7] border-0 text-sm text-[#1d1d1f] placeholder:text-[#86868b] focus:outline-none focus:ring-2 focus:ring-[#1d1d1f]/10 resize-none"
            />
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={saving}
            className="w-full py-3 rounded-xl bg-[#1d1d1f] text-white font-medium hover:opacity-90 transition-all disabled:opacity-50"
          >
            {saving ? "Saving..." : asset ? "Update Asset" : "Add Asset"}
          </button>
        </form>
      </div>
    </div>
  )
}
