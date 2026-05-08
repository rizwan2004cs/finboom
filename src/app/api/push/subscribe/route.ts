import { NextResponse } from "next/server"
import { createClient } from "@/utils/supabase/server"
import { cookies } from "next/headers"
import { auth } from "@clerk/nextjs/server"

// Save push subscription
export async function POST(request: Request) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  const { subscription } = await request.json()

  if (!subscription?.endpoint || !subscription?.keys) {
    return NextResponse.json({ error: "Invalid subscription" }, { status: 400 })
  }

  // Upsert by endpoint
  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      user_id: userId,
      endpoint: subscription.endpoint,
      keys_p256dh: subscription.keys.p256dh,
      keys_auth: subscription.keys.auth,
    },
    { onConflict: "endpoint" }
  )

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

// Remove push subscription
export async function DELETE(request: Request) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  const { endpoint } = await request.json()

  await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint).eq("user_id", userId)

  return NextResponse.json({ success: true })
}
