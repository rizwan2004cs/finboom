"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

export function AddTopicForm() {
  const router = useRouter()
  const [title, setTitle] = useState("")
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = title.trim()
    if (!trimmed || busy) return

    setBusy(true)
    setMessage(null)
    try {
      const res = await fetch("/api/admin/blog-automation/topics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: trimmed }),
      })
      const data = await res.json()
      if (!res.ok) {
        setMessage({ kind: "error", text: data.error || "Failed to add topic." })
        return
      }
      setTitle("")
      setMessage({ kind: "ok", text: "Topic queued - it will be picked for the next post." })
      router.refresh()
    } catch {
      setMessage({ kind: "error", text: "Network error - please try again." })
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2">
      <div className="flex gap-2">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. How to ladder fixed deposits for steady income"
          maxLength={200}
          className="flex-1 rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-white/5 px-4 py-2.5 text-[15px] text-[#1d1d1f] dark:text-white placeholder:text-[#86868b] focus:outline-none focus:ring-2 focus:ring-accent/40"
        />
        <button
          type="submit"
          disabled={busy || !title.trim()}
          className="rounded-xl bg-[#1d1d1f] dark:bg-white px-4 py-2.5 text-[15px] font-medium text-white dark:text-black transition-all duration-200 hover:opacity-85 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {busy ? "Adding..." : "Add topic"}
        </button>
      </div>
      {message && (
        <p
          className={
            message.kind === "ok"
              ? "text-sm text-[#1d1d1f] dark:text-white"
              : "text-sm text-red-600 dark:text-red-400"
          }
        >
          {message.text}
        </p>
      )}
    </form>
  )
}

export function SkipTopicButton({ topicId }: { topicId: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function skip() {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch("/api/admin/blog-automation/topics", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: topicId }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || "Failed to skip topic.")
        return
      }
      router.refresh()
    } catch {
      setError("Network error - please try again.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={skip}
        disabled={busy}
        className="rounded-xl border border-black/10 dark:border-white/10 px-3 py-1.5 text-sm font-medium text-[#1d1d1f] dark:text-white transition-all duration-200 hover:bg-black/[0.05] dark:hover:bg-white/[0.08] disabled:opacity-50"
      >
        {busy ? "Skipping..." : "Skip this topic"}
      </button>
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
    </div>
  )
}
