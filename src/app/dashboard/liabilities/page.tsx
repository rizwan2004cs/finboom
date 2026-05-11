"use client"

import { useState } from "react"
import { useUser } from "@/hooks/use-auth"
import { useProfile } from "@/hooks/use-profile"
import { insertRow, updateRow } from "@/lib/offline"
import { useOfflineQuery } from "@/hooks/use-offline-query"
import { useDeleteMutation } from "@/hooks/use-offline-mutation"
import { useQueryClient } from "@tanstack/react-query"
import { Plus, Trash2, Edit2, CreditCard } from "lucide-react"
import type { Liability } from "@/lib/types"
import { LIABILITY_TYPES } from "@/lib/constants"
import { CategoryIcon } from "@/components/category-icon"
import { useAppDialog } from "@/components/app-dialog"
import { useCurrency } from "@/hooks/use-currency"

export default function LiabilitiesPage() {
  const { formatCompact: formatCurrency } = useCurrency()
  const { user } = useUser()
  const { activeProfile } = useProfile()
  const queryClient = useQueryClient()
  const [showAddModal, setShowAddModal] = useState(false)
  const [editLiability, setEditLiability] = useState<Liability | null>(null)

  const pf = activeProfile ? [{ column: "profile_id", op: "eq" as const, value: activeProfile.id }] : undefined
  const { data: liabilities = [], isLoading: loading } = useOfflineQuery<Liability>(
    "liabilities", user?.id, {
      order: { column: "outstanding_amount", ascending: false },
      filters: pf,
      enabled: !!activeProfile,
    }
  )
  const deleteMut = useDeleteMutation("liabilities")

  const { showConfirm } = useAppDialog()

  async function deleteLiability(id: string) {
    await showConfirm("Delete this liability?", {
      destructive: true,
      onConfirm: async () => { await deleteMut.mutateAsync(id) },
    })
  }

  const totalOutstanding = liabilities.reduce((sum, l) => sum + Number(l.outstanding_amount), 0)
  const totalOriginal = liabilities.reduce((sum, l) => sum + Number(l.original_amount), 0)
  const totalEmi = liabilities.reduce((sum, l) => sum + Number(l.emi_amount || 0), 0)
  const paidOff = totalOriginal - totalOutstanding

  if (loading || !user || !activeProfile) {
    return (
      <div className="space-y-4">
        <div className="skeleton h-7 w-28 rounded-lg" />
        {[1, 2, 3].map(i => (
          <div key={i} className="liquid-glass rounded-2xl p-4 flex items-center gap-4">
            <div className="skeleton h-10 w-10 rounded-xl" />
            <div className="flex-1 space-y-2">
              <div className="skeleton h-4 w-32 rounded-lg" />
              <div className="skeleton h-3 w-24 rounded-lg" />
            </div>
            <div className="skeleton h-5 w-20 rounded-lg" />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4" data-tour-page="liabilities">
      {/* Header */}
      <div className="flex items-center justify-between" data-tour-el="liabilities-header">
        <div>
          <h1 className="text-xl font-bold text-[#1d1d1f] dark:text-white">Liabilities</h1>
          <p className="text-sm text-[#86868b]">{liabilities.length} active loans</p>
        </div>
        <button
          onClick={() => { setEditLiability(null); setShowAddModal(true) }}
          className="flex items-center gap-2 liquid-glass-btn-primary"
        >
          <Plus className="w-4 h-4" />
          Add Loan
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="liquid-glass rounded-2xl p-4">
          <p className="text-xs text-[#86868b] font-medium">Total Outstanding</p>
          <p className="text-xl font-bold text-[#1d1d1f] dark:text-white mt-1">{formatCurrency(totalOutstanding)}</p>
        </div>
        <div className="liquid-glass rounded-2xl p-4">
          <p className="text-xs text-[#86868b] font-medium">Monthly EMI</p>
          <p className="text-xl font-bold text-[#1d1d1f] dark:text-white mt-1">{formatCurrency(totalEmi)}</p>
        </div>
        <div className="liquid-glass rounded-2xl p-4">
          <p className="text-xs text-[#86868b] font-medium">Paid Off</p>
          <p className="text-xl font-bold text-[#1d1d1f] dark:text-white mt-1">{formatCurrency(paidOff)}</p>
          {totalOriginal > 0 && (
            <div className="mt-2 h-1.5 bg-white/50 dark:bg-white/[0.08] rounded-full overflow-hidden">
              <div
                className="h-full bg-[#1d1d1f] dark:bg-white rounded-full transition-all"
                style={{ width: `${Math.min((paidOff / totalOriginal) * 100, 100)}%` }}
              />
            </div>
          )}
        </div>
      </div>

      {/* Liability List */}
      {liabilities.length === 0 ? (
        <div className="liquid-glass rounded-2xl p-8 text-center">
          <div className="w-12 h-12 rounded-xl bg-white/50 backdrop-blur-sm flex items-center justify-center mx-auto mb-3">
            <CreditCard className="w-6 h-6 text-[#86868b]" strokeWidth={1.5} />
          </div>
          <p className="font-medium text-[#1d1d1f] dark:text-white">No liabilities</p>
          <p className="text-sm text-[#86868b] mt-1">Track your loans and EMIs</p>
          <button
            onClick={() => setShowAddModal(true)}
            className="mt-4 liquid-glass-btn-primary"
          >
            Add Loan
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {liabilities.map((liability) => {
            const type = LIABILITY_TYPES.find(t => t.id === liability.liability_type)
            const progress = Number(liability.original_amount) > 0
              ? ((Number(liability.original_amount) - Number(liability.outstanding_amount)) / Number(liability.original_amount)) * 100
              : 0
            return (
              <div key={liability.id} className="liquid-glass rounded-2xl p-4 transition-all">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/50 dark:bg-white/[0.06] backdrop-blur-sm flex items-center justify-center">
                    <CategoryIcon name={type?.icon || "MoreHorizontal"} className="w-4.5 h-4.5 text-[#1d1d1f] dark:text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-[#1d1d1f] dark:text-white truncate">{liability.name}</p>
                    <p className="text-xs text-[#86868b]">{type?.label || liability.liability_type}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-[#1d1d1f] dark:text-white">{formatCurrency(Number(liability.outstanding_amount))}</p>
                    <p className="text-xs text-[#86868b]">
                      {liability.interest_rate}% p.a.
                      {liability.emi_amount ? ` · ₹${Number(liability.emi_amount).toLocaleString("en-IN")}/mo` : ""}
                    </p>
                  </div>
                  <div className="flex gap-1 ml-2">
                    <button
                      onClick={() => { setEditLiability(liability); setShowAddModal(true) }}
                      className="p-1.5 rounded-lg hover:bg-white/60 dark:hover:bg-white/[0.08] transition-all"
                    >
                      <Edit2 className="w-3.5 h-3.5 text-[#86868b]" />
                    </button>
                    <button
                      onClick={() => deleteLiability(liability.id)}
                      className="p-1.5 rounded-lg hover:bg-white/60 dark:hover:bg-white/[0.08] transition-all"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-[#86868b]" />
                    </button>
                  </div>
                </div>
                {/* Progress bar */}
                <div className="mt-3 h-1.5 bg-white/50 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#1d1d1f] rounded-full transition-all"
                    style={{ width: `${Math.min(progress, 100)}%` }}
                  />
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-[10px] text-[#86868b]">{progress.toFixed(0)}% paid</span>
                  <span className="text-[10px] text-[#86868b]">
                    {liability.end_date ? `Due ${new Date(liability.end_date).toLocaleDateString("en-IN", { month: "short", year: "numeric" })}` : ""}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Add/Edit Modal */}
      {showAddModal && (
        <AddLiabilityModal
          liability={editLiability}
          onClose={() => { setShowAddModal(false); setEditLiability(null) }}
          onSave={() => { setShowAddModal(false); setEditLiability(null); queryClient.invalidateQueries({ queryKey: ["liabilities"] }) }}
        />
      )}
    </div>
  )
}

function AddLiabilityModal({
  liability,
  onClose,
  onSave,
}: {
  liability: Liability | null
  onClose: () => void
  onSave: () => void
}) {
  const { user } = useUser()
  const { activeProfile } = useProfile()
  const [form, setForm] = useState({
    name: liability?.name || "",
    liability_type: liability?.liability_type || "home_loan",
    outstanding_amount: liability?.outstanding_amount?.toString() || "",
    original_amount: liability?.original_amount?.toString() || "",
    interest_rate: liability?.interest_rate?.toString() || "",
    emi_amount: liability?.emi_amount?.toString() || "",
    start_date: liability?.start_date || "",
    end_date: liability?.end_date || "",
    notes: liability?.notes || "",
  })
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!user || !form.name || !form.outstanding_amount) return
    setSaving(true)

    const payload = {
      user_id: user.id,
      profile_id: activeProfile!.id,
      name: form.name,
      outstanding_amount: parseFloat(form.outstanding_amount) || 0,
      original_amount: parseFloat(form.original_amount) || 0,
      interest_rate: parseFloat(form.interest_rate) || 0,
      emi_amount: form.emi_amount ? parseFloat(form.emi_amount) : null,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      notes: form.notes || null,
    }

    if (liability) {
      await updateRow("liabilities", liability.id, payload)
    } else {
      await insertRow("liabilities", payload)
    }

    setSaving(false)
    onSave()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={onClose} />
      <form
        onSubmit={handleSubmit}
        className="relative w-full max-w-md bg-white/80 dark:bg-[#1c1c1e]/95 backdrop-blur-2xl rounded-2xl p-6 border border-white/40 dark:border-white/[0.08] shadow-2xl shadow-black/[0.08] space-y-4 max-h-[90vh] overflow-y-auto"
      >
        <h2 className="text-lg font-bold text-[#1d1d1f] dark:text-white">
          {liability ? "Edit Liability" : "Add Liability"}
        </h2>

        <div>
          <label className="text-sm font-medium text-[#1d1d1f] dark:text-[#98989d]">Name</label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
            placeholder="e.g. Home Loan - SBI"
            className="mt-1 w-full px-4 py-3 rounded-xl bg-white/50 dark:bg-[#2c2c2e] border border-white/40 dark:border-white/[0.06] text-sm text-[#1d1d1f] dark:text-white placeholder:text-[#86868b] focus:outline-none focus:ring-2 focus:ring-[#1d1d1f]/10 dark:focus:ring-white/10"
            required
          />
        </div>

        <div>
          <label className="text-sm font-medium text-[#1d1d1f] dark:text-[#98989d]">Type</label>
          <div className="grid grid-cols-3 gap-2 mt-2">
            {LIABILITY_TYPES.map(type => (
              <button
                key={type.id}
                type="button"
                onClick={() => setForm(prev => ({ ...prev, liability_type: type.id }))}
                className={`flex flex-col items-center gap-1 p-2.5 rounded-xl text-center transition-all ${
                  form.liability_type === type.id
                    ? "bg-[#1d1d1f]/[0.08] dark:bg-white/[0.12] border-2 border-[#1d1d1f] dark:border-white"
                    : "bg-white/50 dark:bg-[#2c2c2e] border-2 border-transparent"
                }`}
              >
                <CategoryIcon name={type.icon} className="w-4 h-4 text-[#1d1d1f] dark:text-white" />
                <span className="text-[10px] text-[#86868b] leading-tight">{type.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium text-[#1d1d1f] dark:text-[#98989d]">Outstanding Amount</label>
            <input
              type="number"
              value={form.outstanding_amount}
              onChange={(e) => setForm(prev => ({ ...prev, outstanding_amount: e.target.value }))}
              placeholder="₹"
              className="mt-1 w-full px-4 py-3 rounded-xl bg-white/50 dark:bg-[#2c2c2e] border border-white/40 dark:border-white/[0.06] text-sm text-[#1d1d1f] dark:text-white placeholder:text-[#86868b] focus:outline-none focus:ring-2 focus:ring-[#1d1d1f]/10 dark:focus:ring-white/10"
              required
            />
          </div>
          <div>
            <label className="text-sm font-medium text-[#1d1d1f] dark:text-[#98989d]">Original Amount</label>
            <input
              type="number"
              value={form.original_amount}
              onChange={(e) => setForm(prev => ({ ...prev, original_amount: e.target.value }))}
              placeholder="₹"
              className="mt-1 w-full px-4 py-3 rounded-xl bg-white/50 dark:bg-[#2c2c2e] border border-white/40 dark:border-white/[0.06] text-sm text-[#1d1d1f] dark:text-white placeholder:text-[#86868b] focus:outline-none focus:ring-2 focus:ring-[#1d1d1f]/10 dark:focus:ring-white/10"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium text-[#1d1d1f] dark:text-[#98989d]">Interest Rate (%)</label>
            <input
              type="number"
              step="0.01"
              value={form.interest_rate}
              onChange={(e) => setForm(prev => ({ ...prev, interest_rate: e.target.value }))}
              placeholder="8.5"
              className="mt-1 w-full px-4 py-3 rounded-xl bg-white/50 dark:bg-[#2c2c2e] border border-white/40 dark:border-white/[0.06] text-sm text-[#1d1d1f] dark:text-white placeholder:text-[#86868b] focus:outline-none focus:ring-2 focus:ring-[#1d1d1f]/10 dark:focus:ring-white/10"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-[#1d1d1f] dark:text-[#98989d]">EMI Amount</label>
            <input
              type="number"
              value={form.emi_amount}
              onChange={(e) => setForm(prev => ({ ...prev, emi_amount: e.target.value }))}
              placeholder="₹/month"
              className="mt-1 w-full px-4 py-3 rounded-xl bg-white/50 dark:bg-[#2c2c2e] border border-white/40 dark:border-white/[0.06] text-sm text-[#1d1d1f] dark:text-white placeholder:text-[#86868b] focus:outline-none focus:ring-2 focus:ring-[#1d1d1f]/10 dark:focus:ring-white/10"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium text-[#1d1d1f] dark:text-[#98989d]">Start Date</label>
            <input
              type="date"
              value={form.start_date}
              onChange={(e) => setForm(prev => ({ ...prev, start_date: e.target.value }))}
              onFocus={(e) => setTimeout(() => e.target.scrollIntoView({ behavior: "smooth", block: "center" }), 100)}
              className="mt-1 w-full px-4 py-3 rounded-xl bg-white/50 dark:bg-[#2c2c2e] border border-white/40 dark:border-white/[0.06] text-sm text-[#1d1d1f] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#1d1d1f]/10 dark:focus:ring-white/10 dark:[color-scheme:dark]"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-[#1d1d1f] dark:text-[#98989d]">End Date</label>
            <input
              type="date"
              value={form.end_date}
              onChange={(e) => setForm(prev => ({ ...prev, end_date: e.target.value }))}
              onFocus={(e) => setTimeout(() => e.target.scrollIntoView({ behavior: "smooth", block: "center" }), 100)}
              className="mt-1 w-full px-4 py-3 rounded-xl bg-white/50 dark:bg-[#2c2c2e] border border-white/40 dark:border-white/[0.06] text-sm text-[#1d1d1f] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#1d1d1f]/10 dark:focus:ring-white/10 dark:[color-scheme:dark]"
            />
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-[#1d1d1f] dark:text-[#98989d]">Notes (optional)</label>
          <textarea
            value={form.notes}
            onChange={(e) => setForm(prev => ({ ...prev, notes: e.target.value }))}
            placeholder="Any additional details..."
            rows={2}
            className="mt-1 w-full px-4 py-3 rounded-xl bg-white/50 dark:bg-[#2c2c2e] border border-white/40 dark:border-white/[0.06] text-sm text-[#1d1d1f] dark:text-white placeholder:text-[#86868b] focus:outline-none focus:ring-2 focus:ring-[#1d1d1f]/10 dark:focus:ring-white/10 resize-none"
          />
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 rounded-xl text-sm font-medium text-[#1d1d1f] dark:text-white bg-white/50 dark:bg-[#2c2c2e] border border-white/40 dark:border-white/[0.06] hover:bg-white/70 dark:hover:bg-[#3a3a3c] transition-all"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving || !form.name || !form.outstanding_amount}
            className="flex-1 py-3 rounded-xl text-sm font-medium text-white bg-[#1d1d1f] hover:bg-[#2d2d2f] disabled:opacity-50 transition-all"
          >
            {saving ? "Saving..." : liability ? "Update" : "Add Liability"}
          </button>
        </div>
      </form>
    </div>
  )
}
