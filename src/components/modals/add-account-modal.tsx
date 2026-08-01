"use client"

import { useState } from "react"
import { useUser } from "@/hooks/use-auth"
import { useProfile } from "@/hooks/use-profile"
import { insertRow, updateRow } from "@/lib/offline"
import { isValidISODate, isFutureISODate, todayLocalISO } from "@/lib/utils"
import { X, Loader2 } from "lucide-react"
import { ACCOUNT_TYPES } from "@/lib/constants"
import { CategoryIcon } from "@/components/category-icon"
import type { Account } from "@/lib/types"
import { useCurrency } from "@/hooks/use-currency"

interface Props {
  account?: Account | null
  onClose: () => void
  onSave: () => void
}

export function AddAccountModal({ account, onClose, onSave }: Readonly<Props>) {
  const isEditing = !!account
  const { symbol, currency, toINR, convert } = useCurrency()
  const { user } = useUser()
  const { activeProfile } = useProfile()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Stored amounts are INR; the field is labeled in the display currency.
  // Keep the prefilled string so an untouched field saves the ORIGINAL INR
  // value — re-converting the 2-decimal display string would silently drift
  // the stored balance in non-INR display modes.
  const [initialOpening] = useState(() =>
    account ? String(Math.round(convert(Number(account.opening_balance)) * 100) / 100) : ""
  )
  const [form, setForm] = useState({
    name: account?.name || "",
    type: account?.type || ("bank" as Account["type"]),
    opening_balance: initialOpening,
    opening_date: account?.opening_date || todayLocalISO(),
  })

  const todayStr = todayLocalISO()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!user || !activeProfile) return

    const opening = form.opening_balance.trim() === "" ? 0 : parseFloat(form.opening_balance)
    if (!Number.isFinite(opening)) {
      setError("Enter a valid opening balance.")
      return
    }
    if (!isValidISODate(form.opening_date) || isFutureISODate(form.opening_date)) {
      setError("Pick a valid as-of date — it cannot be in the future.")
      return
    }
    setError(null)
    setSaving(true)

    const openingInr = account && form.opening_balance === initialOpening
      ? Number(account.opening_balance)
      : Math.round(toINR(opening, currency) * 100) / 100
    const data = {
      name: form.name.trim(),
      type: form.type,
      opening_balance: openingInr,
      opening_date: form.opening_date,
      updated_at: new Date().toISOString(),
    }

    const res = account
      ? await updateRow("accounts", account.id, data)
      : await insertRow("accounts", {
          ...data,
          user_id: user.id,
          profile_id: activeProfile.id,
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
          <h2 className="text-lg font-bold text-[#1d1d1f] dark:text-white">{isEditing ? "Edit Account" : "Add Account"}</h2>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-[#f5f5f7] dark:hover:bg-white/[0.08] transition-all">
            <X className="w-5 h-5 text-[#86868b]" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 pb-8 sm:pb-5 space-y-4">
          {/* Name */}
          <div>
            <label className="text-sm font-medium text-[#1d1d1f] dark:text-[#98989d]">Account name</label>
            <input
              type="text"
              required
              value={form.name}
              onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
              placeholder="e.g. HDFC Savings"
              className="mt-1 w-full px-4 py-3 rounded-xl bg-[#f5f5f7] dark:bg-white/[0.06] border-0 text-sm text-[#1d1d1f] dark:text-white placeholder:text-[#86868b] focus:outline-none focus:ring-2 focus:ring-[#1d1d1f]/10 dark:focus:ring-white/10"
            />
          </div>

          {/* Type */}
          <div>
            <label className="text-sm font-medium text-[#1d1d1f] dark:text-[#98989d]">Type</label>
            <div className="mt-1 grid grid-cols-2 gap-2">
              {ACCOUNT_TYPES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setForm(prev => ({ ...prev, type: t.id }))}
                  className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    form.type === t.id
                      ? "bg-[#1d1d1f] dark:bg-white text-white dark:text-[#1c1c1e]"
                      : "bg-[#f5f5f7] dark:bg-white/[0.06] text-[#86868b] hover:text-[#1d1d1f] dark:hover:text-white"
                  }`}
                >
                  <CategoryIcon name={t.icon} className="w-4 h-4" />
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Opening balance */}
          <div>
            <label className="text-sm font-medium text-[#1d1d1f] dark:text-[#98989d]">Opening balance ({symbol})</label>
            <p className="text-[11px] text-[#86868b] mt-0.5">The balance this account held on the as-of date — transactions move it from there</p>
            <input
              type="number"
              step="0.01"
              inputMode="decimal"
              value={form.opening_balance}
              onChange={(e) => { setForm(prev => ({ ...prev, opening_balance: e.target.value })); setError(null) }}
              placeholder="0"
              className="mt-1 w-full px-4 py-3 rounded-xl bg-[#f5f5f7] dark:bg-white/[0.06] border-0 text-2xl font-bold text-[#1d1d1f] dark:text-white placeholder:text-[#86868b] focus:outline-none focus:ring-2 focus:ring-[#1d1d1f]/10 dark:focus:ring-white/10 text-center"
            />
          </div>

          {/* As-of date */}
          <div>
            <label className="text-sm font-medium text-[#1d1d1f] dark:text-[#98989d]">As of date</label>
            <input
              type="date"
              required
              max={todayStr}
              value={form.opening_date}
              onChange={(e) => { setForm(prev => ({ ...prev, opening_date: e.target.value })); setError(null) }}
              onFocus={(e) => setTimeout(() => e.target.scrollIntoView({ behavior: "smooth", block: "center" }), 100)}
              className="mt-1 w-full px-4 py-3 rounded-xl bg-[#f5f5f7] dark:bg-white/[0.06] border-0 text-sm text-[#1d1d1f] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#1d1d1f]/10 dark:focus:ring-white/10 dark:[color-scheme:dark]"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 rounded-xl px-4 py-3">
              Couldn&apos;t save account: {error}
            </p>
          )}

          <button
            type="submit"
            disabled={saving || !form.name.trim()}
            className="w-full py-3 rounded-xl bg-[#1d1d1f] dark:bg-white/[0.12] text-white font-medium hover:opacity-90 transition-all disabled:opacity-50"
          >
            {saving && <><Loader2 className="w-4 h-4 animate-spin inline mr-2" />Saving...</>}
            {!saving && (isEditing ? "Update Account" : "Add Account")}
          </button>
        </form>
      </div>
    </div>
  )
}
