"use client"

import { useState } from "react"
import { useUser } from "@/hooks/use-auth"
import { insertRow, updateRow } from "@/lib/offline"
import { X, Loader2 } from "lucide-react"
import type { FeatureIdea } from "@/lib/types"

const STATUSES: { value: FeatureIdea["status"]; label: string }[] = [
  { value: "idea", label: "Idea" },
  { value: "planned", label: "Planned" },
  { value: "done", label: "Done" },
]

interface Props {
  idea?: FeatureIdea | null
  onClose: () => void
  onSave: () => void
}

export function AddFeatureIdeaModal({ idea, onClose, onSave }: Readonly<Props>) {
  const isEditing = !!idea
  const { user } = useUser()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({
    title: idea?.title || "",
    description: idea?.description || "",
    status: idea?.status || ("idea" as FeatureIdea["status"]),
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return
    setSaving(true)
    setError(null)

    const data = {
      user_id: user.id,
      title: form.title.trim(),
      description: form.description.trim() || null,
      status: form.status,
      updated_at: new Date().toISOString(),
    }

    const res = idea
      ? await updateRow("feature_ideas", idea.id, data)
      : await insertRow("feature_ideas", data)

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
          <h2 className="text-lg font-bold text-[#1d1d1f] dark:text-white">{isEditing ? "Edit Idea" : "Add Idea"}</h2>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-[#f5f5f7] dark:hover:bg-white/[0.08] transition-all">
            <X className="w-5 h-5 text-[#86868b]" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 pb-8 sm:pb-5 space-y-4">
          {/* Title */}
          <div>
            <label className="text-sm font-medium text-[#1d1d1f] dark:text-[#98989d]">Title</label>
            <input
              type="text"
              required
              value={form.title}
              onChange={(e) => setForm(prev => ({ ...prev, title: e.target.value }))}
              placeholder="e.g. Export transactions to CSV"
              className="mt-1 w-full px-4 py-3 rounded-xl bg-[#f5f5f7] dark:bg-white/[0.06] border-0 text-sm text-[#1d1d1f] dark:text-white placeholder:text-[#86868b] focus:outline-none focus:ring-2 focus:ring-[#1d1d1f]/10 dark:focus:ring-white/10"
            />
          </div>

          {/* Description */}
          <div>
            <label className="text-sm font-medium text-[#1d1d1f] dark:text-[#98989d]">Description (optional)</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm(prev => ({ ...prev, description: e.target.value }))}
              rows={4}
              placeholder="What it should do, why you want it, rough notes..."
              className="mt-1 w-full px-4 py-3 rounded-xl bg-[#f5f5f7] dark:bg-white/[0.06] border-0 text-sm text-[#1d1d1f] dark:text-white placeholder:text-[#86868b] focus:outline-none focus:ring-2 focus:ring-[#1d1d1f]/10 dark:focus:ring-white/10 resize-none"
            />
          </div>

          {/* Status */}
          <div>
            <label className="text-sm font-medium text-[#1d1d1f] dark:text-[#98989d]">Status</label>
            <div className="mt-1 grid grid-cols-3 gap-2">
              {STATUSES.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => setForm(prev => ({ ...prev, status: s.value }))}
                  className={`py-2.5 rounded-xl text-sm font-medium transition-all ${
                    form.status === s.value
                      ? "bg-[#1d1d1f] dark:bg-white text-white dark:text-[#1c1c1e]"
                      : "bg-[#f5f5f7] dark:bg-white/[0.06] text-[#86868b] hover:text-[#1d1d1f] dark:hover:text-white"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 rounded-xl px-4 py-3">
              Couldn&apos;t save idea: {error}
            </p>
          )}

          <button
            type="submit"
            disabled={saving || !form.title.trim()}
            className="w-full py-3 rounded-xl bg-[#1d1d1f] dark:bg-white/[0.12] text-white font-medium hover:opacity-90 transition-all disabled:opacity-50"
          >
            {saving && <><Loader2 className="w-4 h-4 animate-spin inline mr-2" />Saving...</>}
            {!saving && (isEditing ? "Update Idea" : "Add Idea")}
          </button>
        </form>
      </div>
    </div>
  )
}
