import { NextResponse } from "next/server"
import { auth, clerkClient } from "@clerk/nextjs/server"
import { createAdminClient } from "@/utils/supabase/admin"

// Permanently delete the authenticated user's account and ALL their data.
// Works for both the web (cookie session) and the mobile app (Clerk bearer
// token, read by clerkMiddleware in src/proxy.ts). Runs server-side with the
// service-role client so deletion is complete per table — the old client-side
// flow in the web settings page missed several tables and never removed the
// Clerk user.

// Ordered so child rows are removed before the profiles they may reference.
const OWNER_TABLES = [
  "assets",
  "liabilities",
  "transactions",
  // accounts after transactions: transactions.account_id is on delete set null,
  // so deleting accounts first would churn every transaction row for nothing.
  "accounts",
  "goals",
  "snapshots",
  "party_transactions",
  "parties",
  "budgets",
  "sip_payments",
  "sips",
  "health_checks",
  "notifications",
  "push_subscriptions",
  "device_tokens",
  "feature_ideas",
  "email_preferences",
  "profiles",
]

export async function POST() {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const supabase = createAdminClient()

  for (const table of OWNER_TABLES) {
    const { error } = await supabase.from(table).delete().eq("user_id", userId)
    if (error) {
      return NextResponse.json({ error: `${table}: ${error.message}` }, { status: 500 })
    }
  }

  // shared_access is keyed on owner_user_id rather than user_id.
  await supabase.from("shared_access").delete().eq("owner_user_id", userId)

  // Remove the Clerk account last so the data is already gone if this fails.
  try {
    const client = await clerkClient()
    await client.users.deleteUser(userId)
  } catch {
    // Data is deleted; the Clerk user can be cleaned up out-of-band if needed.
  }

  return NextResponse.json({ success: true })
}
