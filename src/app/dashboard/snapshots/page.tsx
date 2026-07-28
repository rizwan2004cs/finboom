"use client"

import { useMemo, useState } from "react"
import { useUser } from "@/hooks/use-auth"
import { useProfile } from "@/hooks/use-profile"
import { fetchTable, insertRow, updateRow } from "@/lib/offline"
import { useOfflineQuery } from "@/hooks/use-offline-query"
import { useDeleteMutation } from "@/hooks/use-offline-mutation"
import { useQueryClient } from "@tanstack/react-query"
import { Camera, TrendingUp, TrendingDown, Trash2 } from "lucide-react"
import type { Snapshot, Asset, Liability, Transaction, Sip, SipPayment } from "@/lib/types"
import { ASSET_CLASSES } from "@/lib/constants"
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts"
import { useAppDialog } from "@/components/app-dialog"
import { useCurrency } from "@/hooks/use-currency"
import { subMonths, subYears, todayLocalISO } from "@/lib/utils"
import {
  buildSnapshotBreakdown,
  isSnapshotMetaKey,
} from "@/lib/finance/monthly-cashflow"

type TimeRange = "1M" | "6M" | "1Y" | "3Y" | "5Y" | "All"
type ChartSeries = "net_worth" | "assets" | "liabilities" | string

const CHART_COLORS = ["#1d1d1f", "#0071e3", "#34c759", "#ff9500", "#af52de", "#ff2d55", "#5856d6"]

function getSmartDateLabel(d: Date, diffDays: number): string {
  if (diffDays <= 60) {
    // Data spans less than ~2 months: show day + month
    return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" })
  } else if (diffDays <= 365) {
    // Data spans less than a year: show day + month
    return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" })
  } else {
    // Multi-year data: show month + year
    return d.toLocaleDateString("en-IN", { month: "short", year: "2-digit" })
  }
}

export default function SnapshotsPage() {
  const { formatCompact: formatCurrency } = useCurrency()
  const { user } = useUser()
  const { activeProfile } = useProfile()
  const queryClient = useQueryClient()
  const [taking, setTaking] = useState(false)

  const pf = activeProfile ? [{ column: "profile_id", op: "eq" as const, value: activeProfile.id }] : undefined
  const { data: snapshots = [], isLoading: loading } = useOfflineQuery<Snapshot>(
    "snapshots", user?.id, {
      order: { column: "snapshot_date", ascending: false },
      filters: pf,
      enabled: !!activeProfile,
    }
  )
  const deleteMut = useDeleteMutation("snapshots")
  const [timeRange, setTimeRange] = useState<TimeRange>("All")
  const [chartSeries, setChartSeries] = useState<ChartSeries>("net_worth")

  async function takeSnapshot() {
    if (!user || !activeProfile) return
    setTaking(true)

    const pfFilter = { column: "profile_id", op: "eq" as const, value: activeProfile.id }
    // Fetch current assets and liabilities
    const [assetRows, liabilities, txRows, sipRows, paymentRes] = await Promise.all([
      fetchTable<Asset>("assets", user.id, { filters: [pfFilter] }),
      fetchTable<Liability>("liabilities", user.id, { filters: [pfFilter] }),
      fetchTable<Transaction>("transactions", user.id, { filters: [pfFilter] }),
      fetchTable<Sip>("sips", user.id, { filters: [pfFilter] }),
      fetch("/api/sip-payments").then(async (r) => {
        const j = await r.json()
        return (j.payments ?? []) as SipPayment[]
      }).catch(() => [] as SipPayment[]),
    ])
    const paymentRows = paymentRes

    const totalAssets = assetRows.reduce((sum, a) => sum + Number(a.current_value), 0)
    const totalLiabilities = liabilities.reduce((sum, l) => sum + Number(l.outstanding_amount), 0)
    const netWorth = totalAssets - totalLiabilities

    const todayStr = todayLocalISO()
    const breakdown = buildSnapshotBreakdown(assetRows, txRows, sipRows, new Date(), paymentRows)

    const payload = {
      user_id: user.id,
      profile_id: activeProfile.id,
      total_assets: totalAssets,
      total_liabilities: totalLiabilities,
      net_worth: netWorth,
      asset_breakdown: breakdown,
      currency: "INR",
      snapshot_date: todayStr,
    }

    // Find-then-update/insert — never upsert first. Upsert needs a DB unique
    // index on (profile_id, snapshot_date); without it Postgres errors and
    // upsertRow fires a toast even if a fallback would succeed afterward.
    const remoteToday = await fetchTable<Snapshot>("snapshots", user.id, {
      filters: [pfFilter, { column: "snapshot_date", op: "eq", value: todayStr }],
    })
    const localToday = snapshots.filter(
      (s) => s.profile_id === activeProfile.id && s.snapshot_date === todayStr,
    )
    const todayRow = remoteToday[0] ?? localToday[0]

    if (todayRow) {
      await updateRow("snapshots", todayRow.id, payload)
    } else {
      await insertRow("snapshots", payload)
    }

    setTaking(false)
    queryClient.invalidateQueries({ queryKey: ["snapshots"] })
  }

  const { showConfirm } = useAppDialog()

  async function deleteSnapshot(id: string) {
    await showConfirm("Delete this snapshot?", {
      destructive: true,
      onConfirm: async () => { await deleteMut.mutateAsync(id) },
    })
  }

  // Filter by time range
  const rangeMonthsMap: Record<TimeRange, number> = { "1M": 1, "6M": 6, "1Y": 12, "3Y": 36, "5Y": 60, "All": Infinity }
  const rangeMonths = rangeMonthsMap[timeRange]

  const sortedSnapshots = useMemo(() => [...snapshots].reverse(), [snapshots])

  const filteredSnapshots = useMemo(() => {
    if (timeRange === "All") return sortedSnapshots
    const cutoff = rangeMonths <= 12
      ? subMonths(new Date(), rangeMonths)
      : subYears(new Date(), rangeMonths / 12)
    // Compare local calendar dates as strings — Date-parsing snapshot_date is
    // UTC midnight, which dropped the boundary snapshot depending on the time
    // of day the page was opened.
    const cutoffStr = `${cutoff.getFullYear()}-${String(cutoff.getMonth() + 1).padStart(2, "0")}-${String(cutoff.getDate()).padStart(2, "0")}`
    return sortedSnapshots.filter(s => s.snapshot_date >= cutoffStr)
  }, [sortedSnapshots, timeRange, rangeMonths])

  const assetClassIds = useMemo(() => {
    const ids = new Set<string>()
    for (const s of filteredSnapshots) {
      const breakdown = s.asset_breakdown as Record<string, number>
      for (const key of Object.keys(breakdown)) {
        if (!isSnapshotMetaKey(key) && (breakdown[key] ?? 0) > 0) ids.add(key)
      }
    }
    return [...ids].sort((a, b) => {
      const latest = filteredSnapshots[filteredSnapshots.length - 1]
      const bd = (latest?.asset_breakdown ?? {}) as Record<string, number>
      return (bd[b] ?? 0) - (bd[a] ?? 0)
    })
  }, [filteredSnapshots])

  const chartData = useMemo(() => {
    if (filteredSnapshots.length === 0) return []
    const dates = filteredSnapshots.map(s => new Date(s.snapshot_date))
    const oldest = dates[0]
    const newest = dates[dates.length - 1]
    const diffDays = (newest.getTime() - oldest.getTime()) / (1000 * 60 * 60 * 24)
    return filteredSnapshots.map(s => {
      const d = new Date(s.snapshot_date)
      const breakdown = s.asset_breakdown as Record<string, number>
      const row: Record<string, string | number> = {
        date: getSmartDateLabel(d, diffDays),
        netWorth: Number(s.net_worth),
        assets: Number(s.total_assets),
        liabilities: Number(s.total_liabilities),
      }
      for (const classId of assetClassIds) {
        row[classId] = breakdown[classId] ?? 0
      }
      return row
    })
  }, [filteredSnapshots, assetClassIds])

  const chartSeriesOptions = useMemo(() => {
    const opts: { id: ChartSeries; label: string }[] = [
      { id: "net_worth", label: "Net worth" },
      { id: "assets", label: "Total assets" },
    ]
    for (const classId of assetClassIds) {
      const cls = ASSET_CLASSES.find(c => c.id === classId)
      opts.push({ id: classId, label: cls?.label ?? classId })
    }
    return opts
  }, [assetClassIds])

  // A selected series can disappear when the time range shrinks (e.g. gold
  // only exists in old snapshots) — fall back to net worth instead of
  // rendering an empty, mislabeled, colorless chart.
  const effectiveSeries: ChartSeries = chartSeriesOptions.some(o => o.id === chartSeries)
    ? chartSeries
    : "net_worth"
  const activeChartKey = effectiveSeries
  const activeChartLabel =
    chartSeriesOptions.find(o => o.id === effectiveSeries)?.label ?? "Net worth"
  const activeChartColor =
    CHART_COLORS[Math.max(0, chartSeriesOptions.findIndex(o => o.id === effectiveSeries)) % CHART_COLORS.length]

  if (loading || !user || !activeProfile) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="skeleton h-7 w-32 rounded-lg" />
          <div className="skeleton h-9 w-32 rounded-xl" />
        </div>
        <div className="liquid-glass rounded-2xl p-5">
          <div className="skeleton h-5 w-40 rounded-lg mb-4" />
          <div className="skeleton h-44 w-full rounded-xl" />
        </div>
        {[1, 2, 3].map(i => (
          <div key={i} className="liquid-glass rounded-2xl p-4 flex items-center gap-4">
            <div className="skeleton h-10 w-10 rounded-xl" />
            <div className="flex-1 space-y-2">
              <div className="skeleton h-4 w-28 rounded-lg" />
              <div className="skeleton h-3 w-20 rounded-lg" />
            </div>
            <div className="skeleton h-5 w-20 rounded-lg" />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4" data-tour-page="snapshots">
      {/* Header */}
      <div className="flex items-center justify-between" data-tour-el="snapshots-header">
        <div>
          <h1 className="text-xl font-bold text-[#1d1d1f]">Net Worth Snapshots</h1>
          <p className="text-sm text-[#86868b]">Track your wealth over time</p>
        </div>
        <button
          onClick={takeSnapshot}
          disabled={taking}
          className="flex items-center gap-1.5 liquid-glass-btn-primary disabled:opacity-50"
        >
          <Camera className="w-4 h-4" />
          <span className="hidden sm:inline">{taking ? "Taking..." : "Take Snapshot"}</span>
        </button>
      </div>

      {/* Chart */}
      {chartData.length > 1 && (
        <div className="liquid-glass rounded-2xl p-5">
          <div className="flex flex-col gap-3 mb-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-semibold text-[#1d1d1f]">{activeChartLabel} over time</h3>
              <div className="flex gap-1 flex-shrink-0">
                {(["1M", "6M", "1Y", "3Y", "5Y", "All"] as TimeRange[]).map(range => (
                  <button
                    key={range}
                    onClick={() => setTimeRange(range)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                      timeRange === range
                        ? "bg-[#1d1d1f] text-white"
                        : "text-[#86868b] hover:bg-[#f5f5f7]"
                    }`}
                  >
                    {range}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-1.5 overflow-x-auto pb-0.5">
              {chartSeriesOptions.map(opt => (
                <button
                  key={opt.id}
                  onClick={() => setChartSeries(opt.id)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                    effectiveSeries === opt.id
                      ? "bg-[#f5f5f7] text-[#1d1d1f] ring-1 ring-black/[0.06]"
                      : "text-[#86868b] hover:bg-[#f5f5f7]"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                <defs>
                  <linearGradient id="snapshotGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={activeChartColor} stopOpacity={0.15} />
                    <stop offset="95%" stopColor={activeChartColor} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  axisLine={false}
                  tickLine={false}
                  minTickGap={20}
                />
                <YAxis
                  tickFormatter={(v) => formatCurrency(v)}
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  axisLine={false}
                  tickLine={false}
                  width={65}
                  domain={[(dataMin: number) => Math.floor(dataMin * 0.95), (dataMax: number) => Math.ceil(dataMax * 1.02)]}
                />
                <Tooltip
                  contentStyle={{
                    background: "var(--glass-bg)",
                    backdropFilter: "blur(20px)",
                    border: "1px solid var(--glass-border)",
                    borderRadius: 12,
                    fontSize: 12,
                    color: "var(--foreground)",
                  }}
                  formatter={(value) => [formatCurrency(Number(value)), activeChartLabel]}
                />
                <Area
                  type="monotone"
                  dataKey={activeChartKey === "net_worth" ? "netWorth" : activeChartKey}
                  stroke={activeChartColor}
                  strokeWidth={2.5}
                  fill="url(#snapshotGrad)"
                  dot={false}
                  activeDot={{ r: 4, fill: activeChartColor }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Snapshot List */}
      {snapshots.length === 0 ? (
        <div className="liquid-glass rounded-2xl p-8 text-center">
          <div className="w-12 h-12 rounded-xl bg-white/50 backdrop-blur-sm flex items-center justify-center mx-auto mb-3">
            <Camera className="w-6 h-6 text-[#86868b]" strokeWidth={1.5} />
          </div>
          <p className="font-medium text-[#1d1d1f]">No snapshots yet</p>
          <p className="text-sm text-[#86868b] mt-1">
            Take a snapshot to freeze your current financial state
          </p>
          <button
            onClick={takeSnapshot}
            className="mt-4 liquid-glass-btn-primary"
          >
            Take First Snapshot
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {snapshots.map((snapshot, idx) => {
            const prev = snapshots[idx + 1] // previous snapshot (ordered desc)
            const change = prev
              ? Number(snapshot.net_worth) - Number(prev.net_worth)
              : 0
            const changePercent = prev && Number(prev.net_worth) > 0
              ? (change / Number(prev.net_worth)) * 100
              : 0

            const breakdown = snapshot.asset_breakdown as Record<string, number>
            const assetClasses = Object.entries(breakdown)
              .filter(([classId]) => !isSnapshotMetaKey(classId))
              .sort(([, a], [, b]) => b - a)
            const totalAssetValue = assetClasses.reduce((sum, [, v]) => sum + v, 0)

            return (
              <div key={snapshot.id} className="liquid-glass rounded-2xl p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="text-xs text-[#86868b]">
                      {new Date(snapshot.snapshot_date).toLocaleDateString("en-IN", {
                        weekday: "short",
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </p>
                    <p className="text-xl font-bold text-[#1d1d1f] mt-1">
                      {formatCurrency(Number(snapshot.net_worth))}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {change !== 0 && prev && (
                      <div className={`flex items-center gap-0.5 px-2 py-1 rounded-lg text-xs font-medium ${
                        change >= 0 ? "bg-[#f5f5f7] text-[#1d1d1f]" : "bg-[#f5f5f7] text-[#6e6e73]"
                      }`}>
                        {change >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                        {/* A zero/negative baseline makes a percentage
                            meaningless — show the absolute change instead
                            of a bogus "0.0%". */}
                        {Number(prev.net_worth) > 0
                          ? `${Math.abs(changePercent).toFixed(1)}%`
                          : formatCurrency(Math.abs(change))}
                      </div>
                    )}
                    <button
                      onClick={() => deleteSnapshot(snapshot.id)}
                      className="p-1.5 rounded-lg hover:bg-[#f5f5f7] transition-all"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-[#86868b]" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div className="bg-[#f5f5f7] rounded-xl p-2.5">
                    <p className="text-[10px] text-[#86868b]">Assets</p>
                    <p className="text-sm font-semibold text-[#1d1d1f]">{formatCurrency(Number(snapshot.total_assets))}</p>
                  </div>
                  <div className="bg-[#f5f5f7] rounded-xl p-2.5">
                    <p className="text-[10px] text-[#86868b]">Liabilities</p>
                    <p className="text-sm font-semibold text-[#6e6e73]">{formatCurrency(Number(snapshot.total_liabilities))}</p>
                  </div>
                </div>

                {assetClasses.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-[10px] text-[#86868b] font-medium uppercase tracking-wide">Asset split</p>
                    <div className="flex h-2 rounded-full overflow-hidden bg-[#f5f5f7]">
                      {assetClasses.map(([classId, value], i) => (
                        <div
                          key={classId}
                          className="h-full"
                          style={{
                            width: `${totalAssetValue > 0 ? (value / totalAssetValue) * 100 : 0}%`,
                            backgroundColor: CHART_COLORS[i % CHART_COLORS.length],
                          }}
                          title={`${ASSET_CLASSES.find(c => c.id === classId)?.label ?? classId}: ${formatCurrency(value)}`}
                        />
                      ))}
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      {assetClasses.map(([classId, value], i) => {
                        const cls = ASSET_CLASSES.find(c => c.id === classId)
                        return (
                          <span key={classId} className="text-[11px] px-2 py-0.5 bg-[#f5f5f7] rounded-lg text-[#6e6e73] inline-flex items-center gap-1.5">
                            <span
                              className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                              style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
                            />
                            {cls?.label}: {formatCurrency(value)}
                          </span>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
