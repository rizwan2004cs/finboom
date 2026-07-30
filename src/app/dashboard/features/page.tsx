"use client"

import { useState } from "react"
import { useUser } from "@/hooks/use-auth"
import { useOfflineQuery } from "@/hooks/use-offline-query"
import { useDeleteMutation, useUpdateMutation } from "@/hooks/use-offline-mutation"
import { useQueryClient } from "@tanstack/react-query"
import { Plus, Lightbulb, Trash2, Edit2, Check, Undo2 } from "lucide-react"
import type { FeatureIdea } from "@/lib/types"
import { useAppDialog } from "@/components/app-dialog"
import { AddFeatureIdeaModal } from "@/components/modals/add-feature-idea-modal"

type StatusFilter = "all" | FeatureIdea["status"]

const FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "idea", label: "Ideas" },
  { value: "planned", label: "Planned" },
  { value: "done", label: "Done" },
]

const STATUS_BADGE: Record<FeatureIdea["status"], { label: string; className: string }> = {
  idea: { label: "Idea", className: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-400" },
  planned: { label: "Planned", className: "bg-blue-100 text-blue-800 dark:bg-blue-500/15 dark:text-blue-400" },
  done: { label: "Done", className: "bg-green-100 text-green-800 dark:bg-green-500/15 dark:text-green-400" },
}

export default function FeatureBoardPage() {
  const { user } = useUser()
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [editIdea, setEditIdea] = useState<FeatureIdea | null>(null)
  const [filter, setFilter] = useState<StatusFilter>("all")

  const { data: ideas = [], isLoading } = useOfflineQuery<FeatureIdea>(
    "feature_ideas", user?.id, {
      order: { column: "created_at", ascending: false },
    }
  )
  const loading = isLoading || !user
  const deleteMut = useDeleteMutation("feature_ideas")
  const updateMut = useUpdateMutation("feature_ideas")
  const { showConfirm } = useAppDialog()

  const openCount = ideas.filter(i => i.status !== "done").length
  const visible = filter === "all" ? ideas : ideas.filter(i => i.status === filter)

  async function deleteIdea(id: string) {
    await showConfirm("Delete this idea?", {
      destructive: true,
      onConfirm: async () => { await deleteMut.mutateAsync(id) },
    })
  }

  async function toggleDone(idea: FeatureIdea) {
    await updateMut.mutateAsync({
      id: idea.id,
      data: {
        status: idea.status === "done" ? "idea" : "done",
        updated_at: new Date().toISOString(),
      },
    })
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="skeleton h-7 w-36 rounded-lg" />
        {[1, 2, 3].map(i => (
          <div key={i} className="liquid-glass rounded-2xl p-5 space-y-3">
            <div className="flex items-center gap-3">
              <div className="skeleton h-9 w-9 rounded-xl" />
              <div className="skeleton h-5 w-40 rounded-lg" />
            </div>
            <div className="skeleton h-3 w-56 rounded-lg" />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#1d1d1f]">Feature Board</h1>
          <p className="text-sm text-[#86868b]">
            {ideas.length > 0
              ? `${openCount} open idea${openCount === 1 ? "" : "s"} of ${ideas.length}`
              : "Jot down features you want to build later"}
          </p>
        </div>
        <button
          onClick={() => { setEditIdea(null); setShowForm(true) }}
          className="flex items-center gap-1.5 liquid-glass-btn-primary"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Add Idea</span>
        </button>
      </div>

      {/* Status filter */}
      {ideas.length > 0 && (
        <div className="flex gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                filter === f.value
                  ? "bg-[#1d1d1f] text-white"
                  : "liquid-glass text-[#86868b] hover:text-[#1d1d1f]"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      )}

      {/* Idea list */}
      {visible.length === 0 ? (
        <div className="liquid-glass rounded-2xl p-8 text-center">
          <div className="w-12 h-12 rounded-xl bg-white/50 backdrop-blur-sm flex items-center justify-center mx-auto mb-3">
            <Lightbulb className="w-6 h-6 text-[#86868b]" strokeWidth={1.5} />
          </div>
          <p className="font-medium text-[#1d1d1f]">
            {ideas.length === 0 ? "No ideas yet" : "Nothing here"}
          </p>
          <p className="text-sm text-[#86868b] mt-1">
            {ideas.length === 0
              ? "Save feature ideas as they come to you, so you can pick one up whenever you're ready to build"
              : "No ideas match this filter"}
          </p>
          {ideas.length === 0 && (
            <button
              onClick={() => setShowForm(true)}
              className="mt-4 liquid-glass-btn-primary"
            >
              Add Idea
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map((idea) => (
            <div key={idea.id} className={`liquid-glass rounded-2xl p-5 ${idea.status === "done" ? "opacity-60" : ""}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-white/50 backdrop-blur-sm flex items-center justify-center flex-shrink-0">
                    <Lightbulb className="w-5 h-5 text-[#1d1d1f]" strokeWidth={1.5} />
                  </div>
                  <div className="min-w-0">
                    <p className={`font-semibold text-[#1d1d1f] ${idea.status === "done" ? "line-through" : ""}`}>
                      {idea.title}
                    </p>
                    {idea.description && (
                      <p className="text-sm text-[#86868b] mt-1 whitespace-pre-wrap">{idea.description}</p>
                    )}
                  </div>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <button
                    onClick={() => toggleDone(idea)}
                    className="p-1.5 rounded-lg hover:bg-[#f5f5f7] transition-all"
                    aria-label={idea.status === "done" ? "Reopen idea" : "Mark idea as done"}
                  >
                    {idea.status === "done"
                      ? <Undo2 className="w-3.5 h-3.5 text-[#86868b]" />
                      : <Check className="w-3.5 h-3.5 text-[#86868b]" />}
                  </button>
                  <button
                    onClick={() => { setEditIdea(idea); setShowForm(true) }}
                    className="p-1.5 rounded-lg hover:bg-[#f5f5f7] transition-all"
                    aria-label="Edit idea"
                  >
                    <Edit2 className="w-3.5 h-3.5 text-[#86868b]" />
                  </button>
                  <button
                    onClick={() => deleteIdea(idea.id)}
                    className="p-1.5 rounded-lg hover:bg-[#f5f5f7] transition-all"
                    aria-label="Delete idea"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-[#86868b]" />
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between mt-3">
                <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${STATUS_BADGE[idea.status].className}`}>
                  {STATUS_BADGE[idea.status].label}
                </span>
                <span className="text-[11px] text-[#86868b]">
                  {new Date(idea.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Idea Modal */}
      {showForm && (
        <AddFeatureIdeaModal
          idea={editIdea}
          onClose={() => { setShowForm(false); setEditIdea(null) }}
          onSave={() => { setShowForm(false); setEditIdea(null); queryClient.invalidateQueries({ queryKey: ["feature_ideas"] }) }}
        />
      )}
    </div>
  )
}
