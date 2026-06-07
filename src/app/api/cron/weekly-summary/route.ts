import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import webpush from "web-push"

webpush.setVapidDetails(
  "mailto:rizwan22cse@gmail.com",
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
)

const CRON_SECRET = process.env.CRON_SECRET

function formatINR(value: number): string {
  return `₹${Math.abs(value).toLocaleString("en-IN")}`
}

function formatPercent(pct: number): string {
  return `${Math.abs(pct).toFixed(1)}%`
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization")
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  )

  const { data: users } = await supabase
    .from("profiles")
    .select("user_id")

  const uniqueUserIds = [...new Set((users || []).map((u) => u.user_id))]

  let notificationsSent = 0
  let subscriptionsCleaned = 0

  for (const userId of uniqueUserIds) {
    const [{ data: assets }, { data: liabilities }] = await Promise.all([
      supabase
        .from("assets")
        .select("current_value")
        .eq("user_id", userId),
      supabase
        .from("liabilities")
        .select("outstanding_amount")
        .eq("user_id", userId),
    ])

    const totalAssets = (assets || []).reduce(
      (sum, a) => sum + Number(a.current_value),
      0
    )
    const totalLiabilities = (liabilities || []).reduce(
      (sum, l) => sum + Number(l.outstanding_amount),
      0
    )
    const currentNetWorth = totalAssets - totalLiabilities

    const { data: latestSnapshots } = await supabase
      .from("snapshots")
      .select("net_worth, snapshot_date")
      .eq("user_id", userId)
      .order("snapshot_date", { ascending: false })
      .limit(1)

    let body: string
    const previousSnapshot = latestSnapshots?.[0]

    if (!previousSnapshot) {
      body = `Your net worth is ${formatINR(currentNetWorth)}`
    } else {
      const previousNetWorth = Number(previousSnapshot.net_worth)
      const diff = currentNetWorth - previousNetWorth
      const pctChange =
        previousNetWorth !== 0 ? (diff / Math.abs(previousNetWorth)) * 100 : 0

      if (diff > 0) {
        body = `Your net worth is ${formatINR(currentNetWorth)} (↑${formatINR(diff)} this week, +${formatPercent(pctChange)})`
      } else if (diff < 0) {
        body = `Your net worth is ${formatINR(currentNetWorth)} (↓${formatINR(diff)} this week, -${formatPercent(pctChange)})`
      } else {
        body = `Your net worth is ${formatINR(currentNetWorth)} (no change this week)`
      }
    }

    const payload = JSON.stringify({
      title: "Weekly Summary",
      body,
      icon: "/icons/icon-192.svg",
      data: { url: "/dashboard" },
    })

    const { data: subs } = await supabase
      .from("push_subscriptions")
      .select("*")
      .eq("user_id", userId)

    if (subs?.length) {
      for (const sub of subs) {
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.keys_p256dh, auth: sub.keys_auth },
            },
            payload
          )
          notificationsSent++
        } catch (err: unknown) {
          if (
            err &&
            typeof err === "object" &&
            "statusCode" in err &&
            (err as { statusCode: number }).statusCode === 410
          ) {
            await supabase
              .from("push_subscriptions")
              .delete()
              .eq("id", sub.id)
            subscriptionsCleaned++
          }
        }
      }
    }
  }

  return NextResponse.json({
    ok: true,
    users_checked: uniqueUserIds.length,
    notifications_sent: notificationsSent,
    subscriptions_cleaned: subscriptionsCleaned,
  })
}
