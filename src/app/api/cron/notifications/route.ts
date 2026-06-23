import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/utils/supabase/admin"
import { processUserNotifications } from "@/lib/notifications/generate"
import { sendReminderDigests, type ReminderDigestEntry } from "@/lib/email/send"

const CRON_SECRET = process.env.CRON_SECRET

// GET /api/cron/notifications — runs for ALL users, called by the platform cron.
export async function GET(req: NextRequest) {
  // Fail closed: the endpoint uses the service-role client (bypasses RLS), so it
  // must never be open. Require CRON_SECRET to be configured AND matched.
  const authHeader = req.headers.get("authorization")
  if (!CRON_SECRET || authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const supabase = createAdminClient()

  const { data: users } = await supabase.from("profiles").select("user_id")
  const uniqueUserIds = [...new Set((users || []).map((u) => u.user_id))]

  let totalCreated = 0
  // Email is sent only from the cron path — the in-app bell check also calls
  // processUserNotifications, but emailing a user who is actively in the app
  // would be redundant. Collect per-user digests, then send in one batched
  // fan-out (single Clerk + preferences lookup, bounded concurrency).
  const digestEntries: ReminderDigestEntry[] = []
  for (const userId of uniqueUserIds) {
    const created = await processUserNotifications(supabase, userId)
    totalCreated += created.length
    if (created.length > 0) {
      digestEntries.push({
        userId,
        items: created.map((n) => ({
          type: n.type,
          title: n.title,
          body: n.body,
          url: String(n.data.url ?? "/dashboard"),
        })),
      })
    }
  }

  const emailsSent = await sendReminderDigests(digestEntries)

  return NextResponse.json({
    ok: true,
    users_checked: uniqueUserIds.length,
    notifications_created: totalCreated,
    emails_sent: emailsSent,
  })
}
