import { NextResponse } from "next/server"
import { requireEditorRole } from "@/lib/blog/admin-auth"
import { addManualTopicToQueue, skipQueueTopic } from "@/lib/blog/topic-queue"

// POST /api/admin/blog-automation/topics - Adds a topic to the front of the queue.
export async function POST(request: Request) {
  const denied = await requireEditorRole()
  if (denied) {
    return NextResponse.json({ error: denied.error }, { status: denied.status })
  }

  const body = await request.json().catch(() => null)
  const title = typeof body?.title === "string" ? body.title.trim() : ""
  if (!title) {
    return NextResponse.json({ error: "Topic title is required." }, { status: 400 })
  }
  if (title.length > 200) {
    return NextResponse.json({ error: "Topic title must be under 200 characters." }, { status: 400 })
  }

  const result = await addManualTopicToQueue(title)
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}

// PATCH /api/admin/blog-automation/topics - Skips a pending topic by id.
export async function PATCH(request: Request) {
  const denied = await requireEditorRole()
  if (denied) {
    return NextResponse.json({ error: denied.error }, { status: denied.status })
  }

  const body = await request.json().catch(() => null)
  const id = typeof body?.id === "string" ? body.id : ""
  if (!id) {
    return NextResponse.json({ error: "Topic id is required." }, { status: 400 })
  }

  const result = await skipQueueTopic(id)
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
