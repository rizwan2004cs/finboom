import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/utils/supabase/admin"
import { computeNetWorth } from "@/lib/finance/net-worth"
import webpush from "web-push"
import { sendWeeklyReports, type WeeklyReportEntry } from "@/lib/email/send"

const CRON_SECRET = process.env.CRON_SECRET

// Configure web-push lazily so a missing VAPID key disables push instead of
// crashing the whole route at import time (email can still go out).
let webPushReady: boolean | null = null
function configureWebPush(): boolean {
  if (webPushReady !== null) return webPushReady
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  if (!publicKey || !privateKey) {
    webPushReady = false
    return false
  }
  webpush.setVapidDetails("mailto:rizwan22cse@gmail.com", publicKey, privateKey)
  webPushReady = true
  return true
}

function formatINR(value: number): string {
  const sign = value < 0 ? "-" : ""
  return `${sign}₹${Math.abs(value).toLocaleString("en-IN")}`
}

function formatPercent(pct: number): string {
  const sign = pct > 0 ? "+" : pct < 0 ? "-" : ""
  return `${sign}${Math.abs(pct).toFixed(1)}%`
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization")
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const supabase = createAdminClient()
  const pushEnabled = configureWebPush()

  const { data: users } = await supabase.from("profiles").select("user_id")
  const uniqueUserIds = [...new Set((users || []).map((u) => u.user_id))]

  let notificationsSent = 0
  let subscriptionsCleaned = 0
  const reportEntries: WeeklyReportEntry[] = []

  for (const userId of uniqueUserIds) {
    const [{ data: assets }, { data: liabilities }, { data: accounts }, { data: transactions }] =
      await Promise.all([
        supabase.from("assets").select("name, current_value").eq("user_id", userId),
        supabase.from("liabilities").select("outstanding_amount").eq("user_id", userId),
        supabase.from("accounts").select("id, type, opening_balance, opening_date").eq("user_id", userId),
        supabase
          .from("transactions")
          .select("account_id, type, amount, date")
          .eq("user_id", userId)
          .not("account_id", "is", null),
      ])

    // Same formula as the dashboard — see lib/finance/net-worth.ts.
    const { totalAssets, totalLiabilities, netWorth: currentNetWorth } = computeNetWorth({
      assets: assets || [],
      liabilities: liabilities || [],
      accounts: accounts || [],
      transactions: transactions || [],
    })

    const { data: latestSnapshots } = await supabase
      .from("snapshots")
      .select("net_worth, snapshot_date")
      .eq("user_id", userId)
      .order("snapshot_date", { ascending: false })
      .limit(1)

    const previousSnapshot = latestSnapshots?.[0]
    let body: string
    let change: WeeklyReportEntry["change"] = null

    if (!previousSnapshot) {
      body = `Your net worth is ${formatINR(currentNetWorth)}`
    } else {
      const previousNetWorth = Number(previousSnapshot.net_worth)
      const diff = currentNetWorth - previousNetWorth
      const pctChange = previousNetWorth !== 0 ? (diff / Math.abs(previousNetWorth)) * 100 : 0
      change = {
        direction: diff > 0 ? "up" : diff < 0 ? "down" : "flat",
        amountLabel: formatINR(Math.abs(diff)),
        pctLabel: formatPercent(pctChange),
      }
      if (diff > 0) {
        body = `Your net worth is ${formatINR(currentNetWorth)} (↑${formatINR(diff)} this week, ${formatPercent(pctChange)})`
      } else if (diff < 0) {
        body = `Your net worth is ${formatINR(currentNetWorth)} (↓${formatINR(Math.abs(diff))} this week, ${formatPercent(pctChange)})`
      } else {
        body = `Your net worth is ${formatINR(currentNetWorth)} (no change this week)`
      }
    }

    // Top 3 holdings by current value, for the email breakdown.
    const topMovers = [...(assets || [])]
      .map((a) => ({ label: (a as { name?: string }).name || "Asset", value: Number(a.current_value) }))
      .sort((x, y) => y.value - x.value)
      .slice(0, 3)
      .map((a) => ({ label: a.label, valueLabel: formatINR(a.value) }))

    reportEntries.push({
      userId,
      period: "week",
      netWorthLabel: formatINR(currentNetWorth),
      assetsLabel: formatINR(totalAssets),
      liabilitiesLabel: formatINR(totalLiabilities),
      change,
      topMovers,
    })

    if (!pushEnabled) continue

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
            { endpoint: sub.endpoint, keys: { p256dh: sub.keys_p256dh, auth: sub.keys_auth } },
            payload,
          )
          notificationsSent++
        } catch (err: unknown) {
          if (
            err &&
            typeof err === "object" &&
            "statusCode" in err &&
            (err as { statusCode: number }).statusCode === 410
          ) {
            await supabase.from("push_subscriptions").delete().eq("id", sub.id)
            subscriptionsCleaned++
          }
        }
      }
    }
  }

  const emailsSent = await sendWeeklyReports(reportEntries)

  return NextResponse.json({
    ok: true,
    users_checked: uniqueUserIds.length,
    notifications_sent: notificationsSent,
    subscriptions_cleaned: subscriptionsCleaned,
    emails_sent: emailsSent,
  })
}
