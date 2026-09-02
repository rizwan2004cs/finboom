import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/utils/supabase/admin"
import { computeNetWorth, NET_WORTH_SNAPSHOT_META } from "@/lib/finance/net-worth"

const CRON_SECRET = process.env.CRON_SECRET

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization")
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const supabase = createAdminClient()

  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .slice(0, 10)
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    .toISOString()
    .slice(0, 10)
  const snapshotDate = monthStart

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, user_id")

  if (!profiles?.length) {
    return NextResponse.json({ ok: true, snapshots_created: 0, skipped: 0 })
  }

  let created = 0
  let skipped = 0

  for (const profile of profiles) {
    const { data: existing } = await supabase
      .from("snapshots")
      .select("id")
      .eq("profile_id", profile.id)
      .gte("snapshot_date", monthStart)
      .lte("snapshot_date", monthEnd)
      .limit(1)

    if (existing?.length) {
      skipped++
      continue
    }

    const [{ data: assets }, { data: liabilities }, { data: accounts }, { data: transactions }] =
      await Promise.all([
        supabase
          .from("assets")
          .select("current_value, asset_class")
          .eq("user_id", profile.user_id)
          .eq("profile_id", profile.id),
        supabase
          .from("liabilities")
          .select("outstanding_amount")
          .eq("user_id", profile.user_id)
          .eq("profile_id", profile.id),
        supabase
          .from("accounts")
          .select("id, type, opening_balance, opening_date")
          .eq("user_id", profile.user_id)
          .eq("profile_id", profile.id),
        supabase
          .from("transactions")
          .select("account_id, type, amount, date")
          .eq("user_id", profile.user_id)
          .eq("profile_id", profile.id)
          .not("account_id", "is", null),
      ])

    // Same formula as the dashboard and the manual "Take snapshot" button.
    const wealth = computeNetWorth({
      assets: assets || [],
      liabilities: liabilities || [],
      accounts: accounts || [],
      transactions: transactions || [],
    })

    const breakdown: Record<string, number> = {}
    for (const a of assets || []) {
      const cls = a.asset_class
      breakdown[cls] = (breakdown[cls] || 0) + Number(a.current_value)
    }
    breakdown[NET_WORTH_SNAPSHOT_META.cashAndBank] = wealth.cashAndBank
    breakdown[NET_WORTH_SNAPSHOT_META.cardDues] = wealth.cardDues

    await supabase.from("snapshots").insert({
      user_id: profile.user_id,
      profile_id: profile.id,
      total_assets: wealth.totalAssets,
      total_liabilities: wealth.totalLiabilities,
      net_worth: wealth.netWorth,
      asset_breakdown: breakdown,
      currency: "INR",
      snapshot_date: snapshotDate,
    })

    created++
  }

  return NextResponse.json({
    ok: true,
    profiles_checked: profiles.length,
    snapshots_created: created,
    skipped,
  })
}
