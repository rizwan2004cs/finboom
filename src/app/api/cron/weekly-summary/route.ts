import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/utils/supabase/admin"
import { loadUserNetWorthReport } from "@/lib/finance/net-worth-baseline"
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

  // Snapshots are per profile, so the live number and its baseline are both
  // built per profile and summed (see lib/finance/net-worth-baseline.ts).
  const { data: profileRows } = await supabase.from("profiles").select("id, user_id, name")
  const profilesByUser = new Map<string, { id: string; name: string }[]>()
  for (const p of (profileRows || []) as { id: string; user_id: string; name: string }[]) {
    const list = profilesByUser.get(p.user_id)
    if (list) list.push({ id: p.id, name: p.name })
    else profilesByUser.set(p.user_id, [{ id: p.id, name: p.name }])
  }
  const uniqueUserIds = [...profilesByUser.keys()]

  let notificationsSent = 0
  let subscriptionsCleaned = 0
  const reportEntries: WeeklyReportEntry[] = []

  for (const userId of uniqueUserIds) {
    const profiles = profilesByUser.get(userId) ?? []
    const [report, { data: assets }] = await Promise.all([
      loadUserNetWorthReport(supabase, userId, profiles),
      supabase
        .from("assets")
        .select("name, current_value")
        .eq("user_id", userId)
        .in("profile_id", profiles.map((p) => p.id)),
    ])
    const { totalAssets, totalLiabilities, netWorth: currentNetWorth, comparableNetWorth, previousNetWorth } = report

    let body: string
    let change: WeeklyReportEntry["change"] = null

    if (previousNetWorth === null) {
      body = `Your net worth is ${formatINR(currentNetWorth)}`
    } else {
      // Old snapshots predate the cash & bank / card-dues formula; diff like-for-like.
      const diff = comparableNetWorth - previousNetWorth
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
      profiles: report.profiles.map((p) => ({ name: p.name, netWorthLabel: formatINR(p.netWorth) })),
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
