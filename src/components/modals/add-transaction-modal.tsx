"use client"

import { useState } from "react"
import { useUser } from "@clerk/nextjs"
import { createClient } from "@/utils/supabase/client"
import { X } from "lucide-react"
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from "@/lib/constants"
import { CategoryIcon } from "@/components/category-icon"

interface Props {
  onClose: () => void
  onSave: () => void
}

export function AddTransactionModal({ onClose, onSave }: Props) {
  const { user } = useUser()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    type: "expense" as "income" | "expense",
    category: "",
    amount: "",
    description: "",
    date: new Date().toISOString().slice(0, 10),
  })

  const categories = form.type === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return
    setSaving(true)

    const supabase = createClient()
    await supabase.from("transactions").insert({
      user_id: user.id,
      type: form.type,
      category: form.category || categories[0].id,
      amount: parseFloat(form.amount) || 0,
      description: form.description || null,
      date: form.date,
      currency: "INR",
    })

    setSaving(false)
    onSave()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-2xl border border-white/40 shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="sm:hidden flex justify-center pt-3">
          <div className="w-10 h-1 rounded-full bg-black/[0.08]" />
        </div>

        <div className="flex items-center justify-between p-5 border-b border-black/[0.04]">
          <h2 className="text-lg font-bold text-[#1d1d1f]">Add Transaction</h2>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-[#f5f5f7] transition-all">
            <X className="w-5 h-5 text-[#86868b]" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Type toggle */}
          <div className="flex bg-[#f5f5f7] rounded-xl p-1">
            <button
              type="button"
              onClick={() => setForm(prev => ({ ...prev, type: "expense", category: "" }))}
              className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${
                form.type === "expense" ? "bg-white text-[#1d1d1f] shadow-sm" : "text-[#86868b]"
              }`}
            >
              Expense
            </button>
            <button
              type="button"
              onClick={() => setForm(prev => ({ ...prev, type: "income", category: "" }))}
              className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${
                form.type === "income" ? "bg-white text-[#1d1d1f] shadow-sm" : "text-[#86868b]"
              }`}
            >
              Income
            </button>
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

          {/* Category */}
          <div>
            <label className="text-sm font-medium text-[#1d1d1f]">Category</label>
            <div className="grid grid-cols-4 gap-2 mt-2">
              {categories.map(cat => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setForm(prev => ({ ...prev, category: cat.id }))}
                  className={`flex flex-col items-center gap-1 p-2.5 rounded-xl text-center transition-all ${
                    form.category === cat.id
                      ? "bg-[#1d1d1f]/[0.08] border-2 border-[#1d1d1f]"
                      : "bg-[#f5f5f7] border-2 border-transparent"
                  }`}
                >
                  <CategoryIcon name={cat.icon} className="w-4 h-4 text-[#1d1d1f]" />
                  <span className="text-[10px] text-[#86868b] leading-tight">{cat.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="text-sm font-medium text-[#1d1d1f]">Description (optional)</label>
            <input
              type="text"
              value={form.description}
              onChange={(e) => setForm(prev => ({ ...prev, description: e.target.value }))}
              placeholder="e.g. Swiggy order"
              className="mt-1 w-full px-4 py-3 rounded-xl bg-[#f5f5f7] border-0 text-sm text-[#1d1d1f] placeholder:text-[#86868b] focus:outline-none focus:ring-2 focus:ring-[#1d1d1f]/10"
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

          {/* Submit */}
          <button
            type="submit"
            disabled={saving || !form.amount}
            className="w-full py-3 rounded-xl bg-[#1d1d1f] text-white font-medium hover:opacity-90 transition-all disabled:opacity-50"
          >
            {saving ? "Saving..." : "Add Transaction"}
          </button>
        </form>
      </div>
    </div>
  )
}
