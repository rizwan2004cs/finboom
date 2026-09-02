import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/utils/supabase/admin"
import { loadUserNetWorthReport } from "@/lib/finance/net-worth-baseline"
import { sendWeeklyReports, type WeeklyReportEntry } from "@/lib/email/send"

const CRON_SECRET = process.env.CRON_SECRET

function formatINR(value: number): string {
  const sign = value < 0 ? "-" : ""
  return `${sign}₹${Math.abs(value).toLocaleString("en-IN")}`
}

function formatPercent(pct: number): string {
  const sign = pct > 0 ? "+" : pct < 0 ? "-" : ""
  return `${sign}${Math.abs(pct).toFixed(1)}%`
}

// Monthly net-worth report (email only). Scheduled a few hours after the
// monthly-snapshot cron so the new snapshot exists; month-over-month change is
// measured against a snapshot from ~3 weeks ago (last month's).
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization")
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const supabase = createAdminClient()
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

  // Compare against the most recent snapshot from at least ~20 days ago, so we
  // skip this month's fresh snapshot and land on last month's.
  const cutoff = new Date(Date.now() - 20 * 86400000).toISOString().slice(0, 10)
  const reportEntries: WeeklyReportEntry[] = []

  for (const userId of uniqueUserIds) {
    const profiles = profilesByUser.get(userId) ?? []
    const [report, { data: assets }] = await Promise.all([
      loadUserNetWorthReport(supabase, userId, profiles, cutoff),
      supabase
        .from("assets")
        .select("name, current_value")
        .eq("user_id", userId)
        .in("profile_id", profiles.map((p) => p.id)),
    ])
    const { totalAssets, totalLiabilities, netWorth: currentNetWorth, comparableNetWorth, previousNetWorth } = report

    let change: WeeklyReportEntry["change"] = null
    if (previousNetWorth !== null) {
      // Old snapshots predate the cash & bank / card-dues formula; diff like-for-like.
      const diff = comparableNetWorth - previousNetWorth
      const pctChange = previousNetWorth !== 0 ? (diff / Math.abs(previousNetWorth)) * 100 : 0
      change = {
        direction: diff > 0 ? "up" : diff < 0 ? "down" : "flat",
        amountLabel: formatINR(Math.abs(diff)),
        pctLabel: formatPercent(pctChange),
      }
    }

    const topMovers = [...(assets || [])]
      .map((a) => ({ label: (a as { name?: string }).name || "Asset", value: Number(a.current_value) }))
      .sort((x, y) => y.value - x.value)
      .slice(0, 3)
      .map((a) => ({ label: a.label, valueLabel: formatINR(a.value) }))

    reportEntries.push({
      userId,
      period: "month",
      netWorthLabel: formatINR(currentNetWorth),
      assetsLabel: formatINR(totalAssets),
      liabilitiesLabel: formatINR(totalLiabilities),
      change,
      topMovers,
      profiles: report.profiles.map((p) => ({ name: p.name, netWorthLabel: formatINR(p.netWorth) })),
    })
  }

  const emailsSent = await sendWeeklyReports(reportEntries)

  return NextResponse.json({
    ok: true,
    users_checked: uniqueUserIds.length,
    emails_sent: emailsSent,
  })
}
