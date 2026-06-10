import { NextResponse } from "next/server"
import { requireEditorRole } from "@/lib/blog/admin-auth"
import { runBlogAutomation } from "@/lib/blog/run-automation"

export const maxDuration = 60

// POST /api/admin/blog-automation/trigger - Manually runs the daily blog
// pipeline. Admin/editor only. Bypasses the once-per-24h guard.
export async function POST() {
  const denied = await requireEditorRole()
  if (denied) {
    return NextResponse.json({ error: denied.error }, { status: denied.status })
  }

  try {
    const result = await runBlogAutomation({ force: true })

    if (result.status === "no_topic") {
      return NextResponse.json(
        { error: "No topic available from seed list or fallback generation." },
        { status: 500 }
      )
    }

    if (result.status === "skipped") {
      return NextResponse.json({ ok: true, skipped: true, reason: result.reason })
    }

    return NextResponse.json({
      ok: true,
      published: true,
      topic: result.topic,
      topicSource: result.topicSource,
      title: result.title,
      slug: result.slug,
      notification: result.notification,
      queue: result.queue,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown blog automation error."
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
