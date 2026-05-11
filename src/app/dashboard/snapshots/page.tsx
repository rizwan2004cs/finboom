"use client"

import { useState } from "react"
import { useUser } from "@/hooks/use-auth"
import { useProfile } from "@/hooks/use-profile"
import { fetchTable, insertRow } from "@/lib/offline"
import { useOfflineQuery } from "@/hooks/use-offline-query"
import { useDeleteMutation } from "@/hooks/use-offline-mutation"
import { useQueryClient } from "@tanstack/react-query"
import { Camera, TrendingUp, TrendingDown, Trash2 } from "lucide-react"
import type { Snapshot, Asset, Liability } from "@/lib/types"
import { ASSET_CLASSES } from "@/lib/constants"
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts"
import { useAppDialog } from "@/components/app-dialog"
import { useCurrency } from "@/hooks/use-currency"

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

  async function takeSnapshot() {
    if (!user || !activeProfile) return
    setTaking(true)

    const pf = { column: "profile_id", op: "eq" as const, value: activeProfile.id }
    // Fetch current assets and liabilities
    const [assets, liabilities] = await Promise.all([
      fetchTable<Asset>("assets", user.id, { filters: [pf] }),
      fetchTable<Liability>("liabilities", user.id, { filters: [pf] }),
    ])

    const totalAssets = assets.reduce((sum, a) => sum + Number(a.current_value), 0)
    const totalLiabilities = liabilities.reduce((sum, l) => sum + Number(l.outstanding_amount), 0)
    const netWorth = totalAssets - totalLiabilities

    // Build asset breakdown
    const breakdown: Record<string, number> = {}
    assets.forEach(a => {
      if (!breakdown[a.asset_class]) breakdown[a.asset_class] = 0
      breakdown[a.asset_class] += Number(a.current_value)
    })

    await insertRow("snapshots", {
      user_id: user.id,
      profile_id: activeProfile.id,
      total_assets: totalAssets,
      total_liabilities: totalLiabilities,
      net_worth: netWorth,
      asset_breakdown: breakdown,
      currency: "INR",
      snapshot_date: new Date().toISOString().slice(0, 10),
    })

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

  const chartData = [...snapshots]
    .reverse()
    .map(s => ({
      date: new Date(s.snapshot_date).toLocaleDateString("en-IN", { month: "short", year: "2-digit" }),
      netWorth: Number(s.net_worth),
      assets: Number(s.total_assets),
      liabilities: Number(s.total_liabilities),
    }))

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
          <h3 className="font-semibold text-[#1d1d1f] mb-4">Net Worth Over Time</h3>
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
                />
                <YAxis
                  tickFormatter={(v) => formatCurrency(v)}
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  axisLine={false}
                  tickLine={false}
                  width={65}
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
            const topClasses = Object.entries(breakdown)
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
