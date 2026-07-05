"use client"

import { useMemo, useState } from "react"
import { useUser } from "@/hooks/use-auth"
import { useProfile } from "@/hooks/use-profile"
import { fetchTable, upsertRow, insertRow, updateRow } from "@/lib/offline"
import { useOfflineQuery } from "@/hooks/use-offline-query"
import { useDeleteMutation } from "@/hooks/use-offline-mutation"
import { useQueryClient } from "@tanstack/react-query"
import { Camera, TrendingUp, TrendingDown, Trash2, Wallet, ArrowDownLeft, ArrowUpRight, Repeat } from "lucide-react"
import type { Snapshot, Asset, Liability, Transaction, Sip } from "@/lib/types"
import { ASSET_CLASSES } from "@/lib/constants"
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts"
import { useAppDialog } from "@/components/app-dialog"
import { useCurrency } from "@/hooks/use-currency"
import { subMonths, subYears, todayLocalISO } from "@/lib/utils"
import {
  buildSnapshotBreakdown,
  isSnapshotMetaKey,
  monthKeyFromDate,
  readSnapshotMeta,
  sipsDueRestOfMonth,
  sumCashflow,
  sumLiquidAssets,
  transactionsInMonth,
} from "@/lib/finance/monthly-cashflow"

type TimeRange = "1M" | "6M" | "1Y" | "3Y" | "5Y" | "All"

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
  const { data: assets = [] } = useOfflineQuery<Asset>(
    "assets", user?.id, { filters: pf, enabled: !!activeProfile }
  )
  const { data: transactions = [] } = useOfflineQuery<Transaction>(
    "transactions", user?.id, { filters: pf, enabled: !!activeProfile }
  )
  const { data: sips = [] } = useOfflineQuery<Sip>(
    "sips", user?.id, { filters: pf, enabled: !!activeProfile }
  )
  const deleteMut = useDeleteMutation("snapshots")
  const [timeRange, setTimeRange] = useState<TimeRange>("All")

  const monthKey = monthKeyFromDate()
  const monthTx = useMemo(
    () => transactionsInMonth(transactions, monthKey),
    [transactions, monthKey],
  )
  const cashflow = useMemo(() => sumCashflow(monthTx), [monthTx])
  const sipsDue = useMemo(() => sipsDueRestOfMonth(sips), [sips])
  const liquidAssets = useMemo(() => sumLiquidAssets(assets), [assets])
  const liquidAfterSips = Math.max(0, liquidAssets - sipsDue.amount)
  const availableThisMonth = cashflow.surplus - sipsDue.amount

  async function takeSnapshot() {
    if (!user || !activeProfile) return
    setTaking(true)

    const pfFilter = { column: "profile_id", op: "eq" as const, value: activeProfile.id }
    // Fetch current assets and liabilities
    const [assetRows, liabilities, txRows, sipRows] = await Promise.all([
      fetchTable<Asset>("assets", user.id, { filters: [pfFilter] }),
      fetchTable<Liability>("liabilities", user.id, { filters: [pfFilter] }),
      fetchTable<Transaction>("transactions", user.id, { filters: [pfFilter] }),
      fetchTable<Sip>("sips", user.id, { filters: [pfFilter] }),
    ])

    const totalAssets = assetRows.reduce((sum, a) => sum + Number(a.current_value), 0)
    const totalLiabilities = liabilities.reduce((sum, l) => sum + Number(l.outstanding_amount), 0)
    const netWorth = totalAssets - totalLiabilities

    const todayStr = todayLocalISO()
    const breakdown = buildSnapshotBreakdown(assetRows, txRows, sipRows)

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

    const { error } = await upsertRow("snapshots", payload, { columns: ["profile_id", "snapshot_date"] })

    // If the unique index hasn't been applied yet, fall back to find-then-update
    // so same-day snapshots still work instead of erroring.
    if (error?.includes("no unique or exclusion constraint")) {
      const existingToday = await fetchTable<Snapshot>("snapshots", user.id, {
        filters: [pfFilter, { column: "snapshot_date", op: "eq", value: todayStr }],
      })
      if (existingToday.length > 0) {
        await updateRow("snapshots", existingToday[0].id, payload)
      } else {
        await insertRow("snapshots", payload)
      }
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
    return sortedSnapshots.filter(s => new Date(s.snapshot_date) >= cutoff)
  }, [sortedSnapshots, timeRange, rangeMonths])

  const chartData = useMemo(() => {
    if (filteredSnapshots.length === 0) return []
    const dates = filteredSnapshots.map(s => new Date(s.snapshot_date))
    const oldest = dates[0]
    const newest = dates[dates.length - 1]
    const diffDays = (newest.getTime() - oldest.getTime()) / (1000 * 60 * 60 * 24)
    return filteredSnapshots.map(s => {
      const d = new Date(s.snapshot_date)
      return {
        date: getSmartDateLabel(d, diffDays),
        netWorth: Number(s.net_worth),
        assets: Number(s.total_assets),
        liabilities: Number(s.total_liabilities),
      }
    })
  }, [filteredSnapshots])

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

      {/* This month — income, expenses, SIP remainder */}
      <div className="liquid-glass rounded-2xl p-5 space-y-4">
        <div>
          <h3 className="font-semibold text-[#1d1d1f]">This month</h3>
          <p className="text-xs text-[#86868b] mt-0.5">
            {new Date().toLocaleDateString("en-IN", { month: "long", year: "numeric" })}
          </p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-[#f5f5f7] rounded-xl p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <ArrowDownLeft className="w-3.5 h-3.5 text-green-600" />
              <p className="text-[10px] text-[#86868b] font-medium">Income</p>
            </div>
            <p className="text-sm font-semibold text-green-700">{formatCurrency(cashflow.income)}</p>
          </div>
          <div className="bg-[#f5f5f7] rounded-xl p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <ArrowUpRight className="w-3.5 h-3.5 text-red-600" />
              <p className="text-[10px] text-[#86868b] font-medium">Expenses</p>
            </div>
            <p className="text-sm font-semibold text-red-700">{formatCurrency(cashflow.expense)}</p>
          </div>
          <div className="bg-[#f5f5f7] rounded-xl p-3">
            <p className="text-[10px] text-[#86868b] font-medium mb-1">Surplus</p>
            <p className={`text-sm font-semibold ${cashflow.surplus >= 0 ? "text-[#1d1d1f]" : "text-red-700"}`}>
              {formatCurrency(cashflow.surplus)}
            </p>
            <p className="text-[10px] text-[#86868b] mt-0.5">income − expenses</p>
          </div>
          <div className="bg-[#f5f5f7] rounded-xl p-3">
            <p className="text-[10px] text-[#86868b] font-medium mb-1">Left this month</p>
            <p className={`text-sm font-semibold ${availableThisMonth >= 0 ? "text-[#1d1d1f]" : "text-red-700"}`}>
              {formatCurrency(availableThisMonth)}
            </p>
            <p className="text-[10px] text-[#86868b] mt-0.5">after SIPs due</p>
          </div>
        </div>
        {(liquidAssets > 0 || sipsDue.amount > 0) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1 border-t border-black/[0.04]">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-white/60 flex items-center justify-center">
                <Wallet className="w-4 h-4 text-[#1d1d1f]" />
              </div>
              <div>
                <p className="text-[11px] text-[#86868b]">Liquid assets (cash + savings)</p>
                <p className="text-sm font-semibold text-[#1d1d1f]">{formatCurrency(liquidAssets)}</p>
              </div>
            </div>
            {sipsDue.amount > 0 && (
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center">
                  <Repeat className="w-4 h-4 text-indigo-600" />
                </div>
                <div>
                  <p className="text-[11px] text-[#86868b]">
                    SIPs remaining ({sipsDue.count}) · liquid after SIPs
                  </p>
                  <p className="text-sm font-semibold text-[#1d1d1f]">
                    {formatCurrency(sipsDue.amount)} due · {formatCurrency(liquidAfterSips)} left
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Chart */}
      {chartData.length > 1 && (
        <div className="liquid-glass rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-[#1d1d1f]">Net Worth Over Time</h3>
            <div className="flex gap-1">
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
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                <defs>
                  <linearGradient id="snapshotGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="currentColor" stopOpacity={0.1} />
                    <stop offset="95%" stopColor="currentColor" stopOpacity={0} />
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
                  formatter={(value) => [formatCurrency(Number(value)), ""]}
                />
                <Area
                  type="monotone"
                  dataKey="netWorth"
                  stroke="var(--foreground)"
                  strokeWidth={2.5}
                  fill="url(#snapshotGrad)"
                  dot={false}
                  activeDot={{ r: 4, fill: "var(--foreground)" }}
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
            const meta = readSnapshotMeta(breakdown)
            const topClasses = Object.entries(breakdown)
              .filter(([classId]) => !isSnapshotMetaKey(classId))
              .sort(([, a], [, b]) => b - a)
              .slice(0, 3)

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
                    {change !== 0 && (
                      <div className={`flex items-center gap-0.5 px-2 py-1 rounded-lg text-xs font-medium ${
                        change >= 0 ? "bg-[#f5f5f7] text-[#1d1d1f]" : "bg-[#f5f5f7] text-[#6e6e73]"
                      }`}>
                        {change >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                        {Math.abs(changePercent).toFixed(1)}%
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

                {(meta.monthlyIncome != null || meta.availableThisMonth != null) && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
                    {meta.monthlyIncome != null && (
                      <div className="bg-green-50/80 rounded-xl p-2.5">
                        <p className="text-[10px] text-[#86868b]">Income</p>
                        <p className="text-xs font-semibold text-green-700">{formatCurrency(meta.monthlyIncome)}</p>
                      </div>
                    )}
                    {meta.monthlyExpense != null && (
                      <div className="bg-red-50/80 rounded-xl p-2.5">
                        <p className="text-[10px] text-[#86868b]">Expenses</p>
                        <p className="text-xs font-semibold text-red-700">{formatCurrency(meta.monthlyExpense)}</p>
                      </div>
                    )}
                    {meta.monthlySurplus != null && (
                      <div className="bg-[#f5f5f7] rounded-xl p-2.5">
                        <p className="text-[10px] text-[#86868b]">Surplus</p>
                        <p className="text-xs font-semibold text-[#1d1d1f]">{formatCurrency(meta.monthlySurplus)}</p>
                      </div>
                    )}
                    {meta.availableThisMonth != null && (
                      <div className="bg-[#f5f5f7] rounded-xl p-2.5">
                        <p className="text-[10px] text-[#86868b]">Left after SIPs</p>
                        <p className="text-xs font-semibold text-[#1d1d1f]">{formatCurrency(meta.availableThisMonth)}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Top asset classes */}
                {topClasses.length > 0 && (
                  <div className="flex gap-2 flex-wrap">
                    {topClasses.map(([classId, value]) => {
                      const cls = ASSET_CLASSES.find(c => c.id === classId)
                      return (
                        <span key={classId} className="text-[11px] px-2 py-0.5 bg-[#f5f5f7] rounded-lg text-[#6e6e73]">
                          {cls?.label}: {formatCurrency(value)}
                        </span>
                      )
                    })}
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
