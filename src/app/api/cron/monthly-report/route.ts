import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/utils/supabase/admin"
import { computeNetWorth } from "@/lib/finance/net-worth"
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
  const { data: users } = await supabase.from("profiles").select("user_id")
  const uniqueUserIds = [...new Set((users || []).map((u) => u.user_id))]

  // Compare against the most recent snapshot from at least ~20 days ago, so we
  // skip this month's fresh snapshot and land on last month's.
  const cutoff = new Date(Date.now() - 20 * 86400000).toISOString().slice(0, 10)
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

    const { data: priorSnapshots } = await supabase
      .from("snapshots")
      .select("net_worth, snapshot_date")
      .eq("user_id", userId)
      .lte("snapshot_date", cutoff)
      .order("snapshot_date", { ascending: false })
      .limit(1)

    let change: WeeklyReportEntry["change"] = null
    const prior = priorSnapshots?.[0]
    if (prior) {
      const previousNetWorth = Number(prior.net_worth)
      const diff = currentNetWorth - previousNetWorth
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
    })
  }

  const emailsSent = await sendWeeklyReports(reportEntries)

  return NextResponse.json({
    ok: true,
    users_checked: uniqueUserIds.length,
    emails_sent: emailsSent,
  })
}
