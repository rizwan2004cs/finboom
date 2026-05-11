"use client"

import { useState } from "react"
import { useUser } from "@/hooks/use-auth"
import { useProfile } from "@/hooks/use-profile"
import { insertRow, updateRow } from "@/lib/offline"
import { useOfflineQuery } from "@/hooks/use-offline-query"
import { useDeleteMutation } from "@/hooks/use-offline-mutation"
import { useQueryClient } from "@tanstack/react-query"
import { Plus, Target, Trash2, Edit2, TrendingUp, Calendar } from "lucide-react"
import type { Goal, Asset } from "@/lib/types"
import { useAppDialog } from "@/components/app-dialog"
import { useCurrency } from "@/hooks/use-currency"

function calculateInflationAdjusted(target: number, years: number, rate: number) {
  return target * Math.pow(1 + rate / 100, years)
}

export default function GoalsPage() {
  const { formatCompact: formatCurrency } = useCurrency()
  const { user } = useUser()
  const { activeProfile } = useProfile()
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [editGoal, setEditGoal] = useState<Goal | null>(null)

  const pf = activeProfile ? [{ column: "profile_id", op: "eq" as const, value: activeProfile.id }] : undefined
  const { data: goals = [], isLoading: loadingGoals } = useOfflineQuery<Goal>(
    "goals", user?.id, {
      order: { column: "target_date", ascending: true },
      filters: pf,
      enabled: !!activeProfile,
    }
  )
  const { data: assets = [] } = useOfflineQuery<Asset>(
    "assets", user?.id, {
      filters: pf,
      enabled: !!activeProfile,
    }
  )
  const loading = loadingGoals || !user || !activeProfile
  const deleteMut = useDeleteMutation("goals")

  const { showConfirm } = useAppDialog()

  async function deleteGoal(id: string) {
    await showConfirm("Delete this goal?", {
      destructive: true,
      onConfirm: async () => { await deleteMut.mutateAsync(id) },
    })
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="skeleton h-7 w-24 rounded-lg" />
        {[1, 2, 3].map(i => (
          <div key={i} className="liquid-glass rounded-2xl p-5 space-y-3">
            <div className="flex items-center gap-3">
              <div className="skeleton h-9 w-9 rounded-xl" />
              <div className="skeleton h-5 w-32 rounded-lg" />
            </div>
            <div className="skeleton h-2 w-full rounded-full" />
            <div className="flex justify-between">
              <div className="skeleton h-3 w-16 rounded-lg" />
              <div className="skeleton h-3 w-20 rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4" data-tour-page="goals">
      {/* Header */}
      <div className="flex items-center justify-between" data-tour-el="goals-header">
        <div>
          <h1 className="text-xl font-bold text-[#1d1d1f]">Goals</h1>
          <p className="text-sm text-[#86868b]">Track your financial goals</p>
        </div>
        <button
          onClick={() => { setEditGoal(null); setShowForm(true) }}
          className="flex items-center gap-1.5 liquid-glass-btn-primary"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Add Goal</span>
        </button>
      </div>

      {/* Goals List */}
      {goals.length === 0 ? (
        <div className="liquid-glass rounded-2xl p-8 text-center">
          <div className="w-12 h-12 rounded-xl bg-white/50 backdrop-blur-sm flex items-center justify-center mx-auto mb-3">
            <Target className="w-6 h-6 text-[#86868b]" strokeWidth={1.5} />
          </div>
          <p className="font-medium text-[#1d1d1f]">No goals set</p>
          <p className="text-sm text-[#86868b] mt-1">
            Set goals like retirement, education, or dream home
          </p>
          <button
            onClick={() => setShowForm(true)}
            className="mt-4 liquid-glass-btn-primary"
          >
            Create Goal
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {goals.map((goal) => {
            const progress = Number(goal.target_amount) > 0 
              ? (Number(goal.current_amount) / Number(goal.target_amount)) * 100 
              : 0
            const targetDate = new Date(goal.target_date)
            const yearsLeft = Math.max(0, (targetDate.getTime() - Date.now()) / (365.25 * 24 * 60 * 60 * 1000))
            const inflationAdjusted = calculateInflationAdjusted(
              Number(goal.target_amount), yearsLeft, Number(goal.inflation_rate)
            )
            const remaining = Number(goal.target_amount) - Number(goal.current_amount)
            const monthlyRequired = yearsLeft > 0 ? remaining / (yearsLeft * 12) : remaining

            return (
              <div key={goal.id} className="liquid-glass rounded-2xl p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white/50 backdrop-blur-sm flex items-center justify-center">
                      <Target className="w-5 h-5 text-[#1d1d1f]" strokeWidth={1.5} />
                    </div>
                    <div>
                      <p className="font-semibold text-[#1d1d1f]">{goal.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Calendar className="w-3 h-3 text-[#86868b]" />
                        <p className="text-xs text-[#86868b]">
                          {targetDate.toLocaleDateString("en-IN", { month: "short", year: "numeric" })}
                          {yearsLeft > 0 && ` (${yearsLeft.toFixed(1)} yrs left)`}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => { setEditGoal(goal); setShowForm(true) }}
                      className="p-1.5 rounded-lg hover:bg-[#f5f5f7] transition-all"
                    >
                      <Edit2 className="w-3.5 h-3.5 text-[#86868b]" />
                    </button>
                    <button
                      onClick={() => deleteGoal(goal.id)}
                      className="p-1.5 rounded-lg hover:bg-[#f5f5f7] transition-all"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-[#86868b]" />
                    </button>
                  </div>
                </div>

                {/* Progress */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[#86868b]">
                      {formatCurrency(Number(goal.current_amount))} of {formatCurrency(Number(goal.target_amount))}
                    </span>
                    <span className="font-medium text-[#1d1d1f]">{Math.min(progress, 100).toFixed(0)}%</span>
                  </div>
                  <div className="h-2.5 bg-[#f5f5f7] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700 bg-[#1d1d1f]"
                      style={{ width: `${Math.min(progress, 100)}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-xs text-[#86868b]">
                    <span className="flex items-center gap-1">
                      <TrendingUp className="w-3 h-3" />
                      ₹{Math.round(monthlyRequired).toLocaleString("en-IN")}/mo needed
                    </span>
                    {Number(goal.inflation_rate) > 0 && (
                      <span>Inflation-adj: {formatCurrency(inflationAdjusted)}</span>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Add/Edit Goal Form Modal */}
      {showForm && (
        <GoalFormModal
          goal={editGoal}
          assets={assets}
          onClose={() => { setShowForm(false); setEditGoal(null) }}
          onSave={() => { setShowForm(false); setEditGoal(null); queryClient.invalidateQueries({ queryKey: ["goals"] }) }}
        />
      )}
    </div>
  )
}

function GoalFormModal({ goal, assets, onClose, onSave }: {
  goal: Goal | null
  assets: Asset[]
  onClose: () => void
  onSave: () => void
}) {
  const { user } = useUser()
  const { activeProfile } = useProfile()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    name: goal?.name || "",
    target_amount: goal?.target_amount?.toString() || "",
    current_amount: goal?.current_amount?.toString() || "",
    target_date: goal?.target_date || new Date(Date.now() + 5 * 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    inflation_rate: goal?.inflation_rate?.toString() || "6",
    linked_assets: goal?.linked_assets || [],
    notes: goal?.notes || "",
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return
    setSaving(true)

    const data = {
      user_id: user.id,
      profile_id: activeProfile!.id,
      name: form.name,
      current_amount: parseFloat(form.current_amount) || 0,
      target_date: form.target_date,
      inflation_rate: parseFloat(form.inflation_rate) || 6,
      linked_assets: form.linked_assets,
      notes: form.notes || null,
      currency: "INR",
      updated_at: new Date().toISOString(),
    }

    if (goal) {
      await updateRow("goals", goal.id, data)
    } else {
      await insertRow("goals", data)
    }

    setSaving(false)
    onSave()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-md glass-elevated rounded-t-3xl sm:rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="sm:hidden flex justify-center pt-3">
          <div className="w-10 h-1 rounded-full bg-black/[0.08] dark:bg-white/20" />
        </div>

        <div className="flex items-center justify-between p-5 border-b border-black/[0.04] dark:border-white/[0.06]">
          <h2 className="text-lg font-bold text-[#1d1d1f] dark:text-white">
            {goal ? "Edit Goal" : "Add Goal"}
          </h2>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-all">
            <span className="text-[#515154] dark:text-[#98989d] text-lg">&times;</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 pb-24 sm:pb-5 space-y-4">
          <div>
            <label className="text-sm font-medium text-[#1d1d1f]">Goal Name</label>
            <input
              type="text"
              required
              value={form.name}
              onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
              placeholder="e.g. Retirement Fund"
              className="mt-1 w-full px-4 py-3 rounded-xl bg-[#f5f5f7] border-0 text-sm text-[#1d1d1f] placeholder:text-[#86868b] focus:outline-none focus:ring-2 focus:ring-[#1d1d1f]/10"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-[#1d1d1f]">Target Amount</label>
              <input
                type="number"
                required
                value={form.target_amount}
                onChange={(e) => setForm(prev => ({ ...prev, target_amount: e.target.value }))}
                placeholder="₹0"
                className="mt-1 w-full px-4 py-3 rounded-xl bg-[#f5f5f7] border-0 text-sm text-[#1d1d1f] placeholder:text-[#86868b] focus:outline-none focus:ring-2 focus:ring-[#1d1d1f]/10"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-[#1d1d1f]">Current Amount</label>
              <input
                type="number"
                value={form.current_amount}
                onChange={(e) => setForm(prev => ({ ...prev, current_amount: e.target.value }))}
                placeholder="₹0"
                className="mt-1 w-full px-4 py-3 rounded-xl bg-[#f5f5f7] border-0 text-sm text-[#1d1d1f] placeholder:text-[#86868b] focus:outline-none focus:ring-2 focus:ring-[#1d1d1f]/10"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-[#1d1d1f]">Target Date</label>
              <input
                type="date"
                required
                value={form.target_date}
                onChange={(e) => setForm(prev => ({ ...prev, target_date: e.target.value }))}
                onFocus={(e) => setTimeout(() => e.target.scrollIntoView({ behavior: "smooth", block: "center" }), 100)}
                className="mt-1 w-full px-4 py-3 rounded-xl bg-[#f5f5f7] border-0 text-sm text-[#1d1d1f] focus:outline-none focus:ring-2 focus:ring-[#1d1d1f]/10"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-[#1d1d1f]">Inflation Rate (%)</label>
              <input
                type="number"
                step="0.1"
                value={form.inflation_rate}
                onChange={(e) => setForm(prev => ({ ...prev, inflation_rate: e.target.value }))}
                className="mt-1 w-full px-4 py-3 rounded-xl bg-[#f5f5f7] border-0 text-sm text-[#1d1d1f] focus:outline-none focus:ring-2 focus:ring-[#1d1d1f]/10"
              />
            </div>
          </div>

          {/* Link Assets */}
          {assets.length > 0 && (
            <div>
              <label className="text-sm font-medium text-[#1d1d1f]">Link Assets (optional)</label>
              <div className="mt-2 max-h-32 overflow-y-auto space-y-1.5">
                {assets.map(asset => (
                  <label key={asset.id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-[#f5f5f7] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.linked_assets.includes(asset.id)}
                      onChange={(e) => {
                        setForm(prev => ({
                          ...prev,
                          linked_assets: e.target.checked
                            ? [...prev.linked_assets, asset.id]
                            : prev.linked_assets.filter(id => id !== asset.id)
                        }))
                      }}
                      className="rounded"
                    />
                    <span className="text-sm text-[#1d1d1f]">{asset.name}</span>
                    <span className="text-xs text-[#86868b] ml-auto">
                      ₹{Number(asset.current_value).toLocaleString("en-IN")}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="text-sm font-medium text-[#1d1d1f]">Notes (optional)</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm(prev => ({ ...prev, notes: e.target.value }))}
              rows={2}
              className="mt-1 w-full px-4 py-3 rounded-xl bg-[#f5f5f7] border-0 text-sm text-[#1d1d1f] placeholder:text-[#86868b] focus:outline-none focus:ring-2 focus:ring-[#1d1d1f]/10 resize-none"
            />
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full liquid-glass-btn-primary disabled:opacity-50"
          >
            {saving ? "Saving..." : goal ? "Update Goal" : "Create Goal"}
          </button>
        </form>
      </div>
    </div>
  )
}
