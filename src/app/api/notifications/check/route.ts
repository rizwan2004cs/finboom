import { NextResponse } from "next/server"
import { createClient } from "@/utils/supabase/server"
import { cookies } from "next/headers"
import { auth } from "@clerk/nextjs/server"
import { processUserNotifications } from "@/lib/notifications/generate"

// POST /api/notifications/check — generates notifications for the authenticated
// user on demand (called when the notification bell is opened / on app focus).
export async function POST() {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  const created = await processUserNotifications(supabase, userId)

  return NextResponse.json({
    created: created.length,
    types: created.map((n) => n.type),
  })
}
