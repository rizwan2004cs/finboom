import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { createAdminClient } from "@/utils/supabase/admin"

// Native (Expo) push device registration. The mobile app authenticates with a
// Clerk bearer token (clerkMiddleware in src/proxy.ts reads it), so `auth()`
// resolves the user without a Supabase cookie session. Writes go through the
// service-role client but are always scoped to the authenticated user_id.

// Save / refresh an Expo push token for this device.
export async function POST(request: Request) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { token, platform } = await request.json()
  if (!token || typeof token !== "string") {
    return NextResponse.json({ error: "Invalid token" }, { status: 400 })
  }

  const supabase = createAdminClient()
  const { error } = await supabase.from("device_tokens").upsert(
    {
      user_id: userId,
      token,
      platform: typeof platform === "string" ? platform : null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "token" }
  )

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

// Remove a device token (e.g. on sign-out).
export async function DELETE(request: Request) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { token } = await request.json()
  if (!token || typeof token !== "string") {
    return NextResponse.json({ error: "Invalid token" }, { status: 400 })
  }

  const supabase = createAdminClient()
  await supabase.from("device_tokens").delete().eq("token", token).eq("user_id", userId)

  return NextResponse.json({ success: true })
}
