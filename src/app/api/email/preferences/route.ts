import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { getEmailPrefs, updateEmailPrefs, type EmailChannel } from "@/lib/email/preferences"

const CHANNELS: EmailChannel[] = ["reminders", "weekly_summary", "blog"]

// GET /api/email/preferences — current user's email channel toggles.
export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const prefs = await getEmailPrefs(userId)
  return NextResponse.json({
    reminders: prefs.reminders,
    weekly_summary: prefs.weekly_summary,
    blog: prefs.blog,
  })
}

// POST /api/email/preferences — patch one or more channel toggles.
export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const patch: Partial<Record<EmailChannel, boolean>> = {}
  for (const channel of CHANNELS) {
    if (typeof body[channel] === "boolean") patch[channel] = body[channel] as boolean
  }
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "No valid preferences provided" }, { status: 400 })
  }

  const updated = await updateEmailPrefs(userId, patch)
  if (!updated) {
    return NextResponse.json(
      { error: "Email preferences are unavailable. Apply the email_preferences migration." },
      { status: 503 },
    )
  }
  return NextResponse.json({
    reminders: updated.reminders,
    weekly_summary: updated.weekly_summary,
    blog: updated.blog,
  })
}
