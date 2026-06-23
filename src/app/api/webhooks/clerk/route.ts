import { NextRequest, NextResponse } from "next/server"
import { Webhook } from "svix"
import { sendWelcomeEmail } from "@/lib/email/send"

const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET

interface ClerkEmailAddress {
  id: string
  email_address: string
}
interface ClerkUserData {
  id: string
  first_name: string | null
  email_addresses?: ClerkEmailAddress[]
  primary_email_address_id?: string | null
}
interface ClerkWebhookEvent {
  type: string
  data: ClerkUserData
}

/**
 * Clerk webhook receiver. Configure in the Clerk dashboard → Webhooks with the
 * endpoint `/api/webhooks/clerk` and the `user.created` event, then set
 * CLERK_WEBHOOK_SECRET. Currently sends the welcome email to new users.
 */
export async function POST(req: NextRequest) {
  if (!WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 })
  }

  const svixId = req.headers.get("svix-id")
  const svixTimestamp = req.headers.get("svix-timestamp")
  const svixSignature = req.headers.get("svix-signature")
  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json({ error: "Missing svix headers" }, { status: 400 })
  }

  const payload = await req.text()
  let evt: ClerkWebhookEvent
  try {
    const wh = new Webhook(WEBHOOK_SECRET)
    evt = wh.verify(payload, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    }) as ClerkWebhookEvent
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 })
  }

  if (evt.type === "user.created") {
    const data = evt.data
    const email =
      data.email_addresses?.find((e) => e.id === data.primary_email_address_id)?.email_address ??
      data.email_addresses?.[0]?.email_address
    if (email) {
      // Don't fail the webhook if the mail transport hiccups — Clerk retries on 5xx.
      try {
        await sendWelcomeEmail(email, data.first_name ?? null)
      } catch {
        // Swallow: a missed welcome email shouldn't trigger endless retries.
      }
    }
  }

  return NextResponse.json({ ok: true })
}
