import { NextRequest, NextResponse } from "next/server"
import { runBlogAutomation } from "@/lib/blog/run-automation"

// The multi-step pipeline (outline -> draft -> optional expand -> images
// -> hero upload) makes several model calls, so allow extra headroom.
export const maxDuration = 300

const CRON_SECRET = process.env.CRON_SECRET

function ensureCronAuth(req: NextRequest) {
  const authHeader = req.headers.get("authorization")
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return false
  }
  return true
}

// GET /api/cron/blog-post - Generates and publishes one post every 24h.
export async function GET(req: NextRequest) {
  if (!ensureCronAuth(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const result = await runBlogAutomation()

    if (result.status === "skipped") {
      return NextResponse.json({
        ok: true,
        skipped: true,
        reason: result.reason,
        latestTitle: result.latestTitle,
        publishedAt: result.publishedAt,
      })
    }

    if (result.status === "no_topic") {
      return NextResponse.json(
        { error: "No topic available from seed list or fallback generation." },
        { status: 500 }
      )
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
