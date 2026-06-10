"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"

type TriggerState =
  | { phase: "idle" }
  | { phase: "running" }
  | { phase: "done"; title: string; slug: string; pushesSent: number }
  | { phase: "error"; message: string }

// API errors can be multi-KB JSON dumps; show a readable summary instead.
function summarizeError(raw: string): string {
  // The aggregate provider error carries per-provider reasons - keep them.
  if (raw.startsWith("All AI providers failed")) {
    return raw.length > 400 ? `${raw.slice(0, 400)}...` : raw
  }
  const quotaHit = /429|quota|RESOURCE_EXHAUSTED/i.test(raw)
  if (quotaHit) {
    return "The AI model hit its rate limit. Wait a minute and try again - if it persists, the free-tier quota for today may be used up."
  }
  const firstSentence = raw.split(/[.\n]/, 1)[0]?.trim() || "Failed to generate post."
  return firstSentence.length > 180 ? `${firstSentence.slice(0, 180)}...` : firstSentence
}

export function TriggerButton() {
  const router = useRouter()
  const [state, setState] = useState<TriggerState>({ phase: "idle" })

  async function trigger() {
    if (state.phase === "running") return
    if (!window.confirm("Generate and publish a post right now? This publishes live and notifies all subscribers.")) {
      return
    }

    setState({ phase: "running" })
    try {
      const res = await fetch("/api/admin/blog-automation/trigger", { method: "POST" })
      const data = await res.json()

      if (!res.ok) {
        setState({ phase: "error", message: summarizeError(data.error || "Failed to generate post.") })
        return
      }

      setState({
        phase: "done",
        title: data.title,
        slug: data.slug,
        pushesSent: data.notification?.pushesSent ?? 0,
      })
      router.refresh()
    } catch {
      setState({ phase: "error", message: "Network error - the run may still be in progress." })
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <button
        onClick={trigger}
        disabled={state.phase === "running"}
        className="inline-flex items-center justify-center gap-2 self-start rounded-xl bg-[#1d1d1f] dark:bg-white px-5 py-2.5 text-[15px] font-medium text-white dark:text-black transition-all duration-200 hover:opacity-85 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {state.phase === "running" ? (
          <>
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            Generating... (about a minute)
          </>
        ) : (
          "Generate post now"
        )}
      </button>

      {state.phase === "done" && (
        <p className="text-sm text-[#1d1d1f] dark:text-white">
          Published <span className="font-semibold">{state.title}</span>
          {" - "}
          <Link href={`/blog/${state.slug}`} className="text-accent hover:opacity-80">
            open post
          </Link>
          {state.pushesSent > 0 && (
            <span className="text-[#86868b]"> ({state.pushesSent} push notifications sent)</span>
          )}
        </p>
      )}

      {state.phase === "error" && (
        <p className="text-sm text-red-600 dark:text-red-400">{state.message}</p>
      )}
    </div>
  )
}
