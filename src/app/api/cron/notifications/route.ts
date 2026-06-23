import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/utils/supabase/admin"
import { processUserNotifications } from "@/lib/notifications/generate"

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
  for (const userId of uniqueUserIds) {
    const created = await processUserNotifications(supabase, userId)
    totalCreated += created.length
  }

  return NextResponse.json({
    ok: true,
    users_checked: uniqueUserIds.length,
    notifications_created: totalCreated,
  })
}
