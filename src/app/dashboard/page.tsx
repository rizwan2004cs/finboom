"use client"

import { useUser } from "@/hooks/use-auth"
import { useProfile } from "@/hooks/use-profile"
import { useOfflineQuery } from "@/hooks/use-offline-query"
import { TrendingUp, Wallet, CreditCard, Target, ArrowUpRight, Plus, Receipt, Camera, Download, HandCoins, Clock, Repeat } from "lucide-react"
import Link from "next/link"
import { NetWorthChart } from "@/components/charts/net-worth-chart"
import { AllocationChart } from "@/components/charts/allocation-chart"
import { SpendingChart } from "@/components/charts/spending-chart"
import type { Asset, Liability, Goal, Snapshot, PartyTransaction, Transaction, Sip } from "@/lib/types"
import { ASSET_CLASSES } from "@/lib/constants"
import { goalProgressPct } from "@/lib/finance/goals"
import { todayLocalISO } from "@/lib/utils"
import { useCurrency } from "@/hooks/use-currency"

export default function DashboardPage() {
  const { formatCurrency } = useCurrency()
  const { user } = useUser()
  const { activeProfile } = useProfile()

  const pf = activeProfile ? [{ column: "profile_id", op: "eq" as const, value: activeProfile.id }] : undefined

  const { data: assets = [], isLoading: loadingAssets } = useOfflineQuery<Asset>(
    "assets", user?.id, { filters: pf, enabled: !!activeProfile }
  )
  const { data: liabilities = [], isLoading: loadingLiabilities } = useOfflineQuery<Liability>(
    "liabilities", user?.id, { filters: pf, enabled: !!activeProfile }
  )
  const { data: goals = [], isLoading: loadingGoals } = useOfflineQuery<Goal>(
    "goals", user?.id, { filters: pf, enabled: !!activeProfile }
  )
  const { data: snapshots = [] } = useOfflineQuery<Snapshot>(
    "snapshots", user?.id, {
      // Newest first so we get the LATEST 12 snapshots (ascending returned the
      // oldest 12, making the trend and "% from last month" use a stale baseline).
      order: { column: "snapshot_date", ascending: false },
      limit: 12,
      filters: pf,
      enabled: !!activeProfile,
    }
  )
  const { data: partyTransactions = [] } = useOfflineQuery<PartyTransaction>(
    "party_transactions", user?.id, { enabled: !!activeProfile }
  )
  const { data: transactions = [], isLoading: loadingTransactions } = useOfflineQuery<Transaction>(
    "transactions", user?.id, { filters: pf, enabled: !!activeProfile }
  )
  const { data: sips = [] } = useOfflineQuery<Sip>(
    "sips", user?.id, { filters: pf, enabled: !!activeProfile }
  )

  const loading = loadingAssets || loadingLiabilities || loadingGoals || !user || !activeProfile

  const totalAssets = assets.reduce((sum, a) => sum + Number(a.current_value), 0)
  const totalLiabilities = liabilities.reduce((sum, l) => sum + Number(l.outstanding_amount), 0)
  const netWorth = totalAssets - totalLiabilities
  
  // Snapshots arrive newest-first; present oldest→newest for the chart.
  const orderedSnapshots = [...snapshots].reverse()
  // Compare current net worth against the snapshot before the most recent one
  // ("last month"), guarding against a zero baseline.
  const prevSnapshot = orderedSnapshots.length > 1 ? orderedSnapshots[orderedSnapshots.length - 2] : null
  const prevNetWorth = prevSnapshot ? Number(prevSnapshot.net_worth) : 0
  const netWorthChange = prevNetWorth !== 0 ? ((netWorth - prevNetWorth) / prevNetWorth) * 100 : 0

  // Party balances — receivable vs payable
  const partyBalanceMap = new Map<string, number>()
  for (const tx of partyTransactions) {
    const current = partyBalanceMap.get(tx.party_id) || 0
    if (tx.type === "lent") partyBalanceMap.set(tx.party_id, current + Number(tx.amount))
    else if (tx.type === "received_back") partyBalanceMap.set(tx.party_id, current - Number(tx.amount))
    else if (tx.type === "borrowed") partyBalanceMap.set(tx.party_id, current - Number(tx.amount))
    else if (tx.type === "paid_back") partyBalanceMap.set(tx.party_id, current + Number(tx.amount))
  }
  const totalReceivable = Array.from(partyBalanceMap.values()).filter(b => b > 0).reduce((s, b) => s + b, 0)

  const today = new Date()
  const in30Days = new Date(today)
  in30Days.setDate(in30Days.getDate() + 30)
  // Compare YYYY-MM-DD strings in local time (Date-parsing a bare date string
  // is UTC midnight, which dropped entries due today), and cap each party's
  // contribution at its outstanding balance so partial repayments aren't
  // re-counted — otherwise this card could exceed Total Receivable beside it.
  const todayStr = todayLocalISO()
  const plus30Str = `${in30Days.getFullYear()}-${String(in30Days.getMonth() + 1).padStart(2, "0")}-${String(in30Days.getDate()).padStart(2, "0")}`
  const upcomingByParty = new Map<string, number>()
  for (const tx of partyTransactions) {
    if (tx.type !== "lent" || !tx.due_date) continue
    if (tx.due_date < todayStr || tx.due_date > plus30Str) continue
    if ((partyBalanceMap.get(tx.party_id) || 0) <= 0) continue // party already settled
    upcomingByParty.set(tx.party_id, (upcomingByParty.get(tx.party_id) || 0) + Number(tx.amount))
  }
  const receivableIn30 = Array.from(upcomingByParty.entries()).reduce(
    (s, [pid, gross]) => s + Math.min(gross, partyBalanceMap.get(pid) || 0),
    0,
  )

  // SIPs still due in the remainder of this month (active only). A SIP scheduled
  // for a day beyond this month's length (e.g. 31 in April) debits on the last
  // day, so clamp before comparing — matching the reminder cron's logic.
  const todayDay = today.getDate()
  const lastDayThisMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()
  const effectiveSipDay = (day: number) => Math.min(day, lastDayThisMonth)
  const upcomingSips = sips.filter(s => s.active && effectiveSipDay(s.sip_day) >= todayDay)
  const sipsDueAmount = upcomingSips.reduce((sum, s) => sum + Number(s.amount), 0)
  const nextSipDay = upcomingSips.length > 0 ? Math.min(...upcomingSips.map(s => effectiveSipDay(s.sip_day))) : 0

  // Asset allocation breakdown
  const allocationData = ASSET_CLASSES.map(cls => {
    const total = assets
      .filter(a => a.asset_class === cls.id)
      .reduce((sum, a) => sum + Number(a.current_value), 0)
    return { name: cls.label, value: total, id: cls.id, icon: cls.icon }
  }).filter(d => d.value > 0)

  if (loading) {
    return (
      <div className="space-y-6">
        {/* Greeting skeleton */}
        <div>
          <div className="skeleton h-8 w-48 rounded-xl" />
          <div className="skeleton h-4 w-56 rounded-lg mt-2" />
        </div>
        {/* Summary cards skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="liquid-glass rounded-2xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="skeleton h-4 w-20 rounded-lg" />
                <div className="skeleton h-9 w-9 rounded-xl" />
              </div>
              <div className="skeleton h-8 w-32 rounded-lg" />
              <div className="skeleton h-3 w-28 rounded-lg" />
            </div>
          ))}
        </div>
        {/* Charts skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="liquid-glass rounded-2xl p-5">
            <div className="skeleton h-5 w-36 rounded-lg mb-4" />
            <div className="skeleton h-48 w-full rounded-xl" />
          </div>
          <div className="liquid-glass rounded-2xl p-5">
            <div className="skeleton h-5 w-36 rounded-lg mb-4" />
            <div className="skeleton h-48 w-full rounded-xl" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6" data-tour-page="dashboard">
      {/* Greeting - hidden on mobile since it's in the top bar */}
      <div className="hidden lg:block">
        <h1 className="text-[28px] font-semibold tracking-[-0.3px] text-[#1d1d1f]">
          Hi, {user?.firstName || "there"}
        </h1>
        <p className="text-[14px] text-[#86868b] mt-1">
          Here&apos;s your financial overview
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4" data-tour-el="dashboard-summary">
        {/* Net Worth Card */}
        <div className="liquid-glass rounded-2xl p-5">
          <div className="flex items-center justify-between">
            <p className="text-[14px] text-[#86868b] font-medium">Net Worth</p>
            <div className="w-9 h-9 rounded-xl bg-white/50 backdrop-blur-sm flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-[#1d1d1f]" />
            </div>
          </div>
          <p className="text-[28px] font-semibold mt-2 text-[#1d1d1f]">{formatCurrency(netWorth)}</p>
          {netWorthChange !== 0 && (
            <p className={`text-[12px] mt-1 font-medium ${netWorthChange >= 0 ? "text-[#1d1d1f]" : "text-[#86868b]"}`}>
              {netWorthChange >= 0 ? "+" : ""}{netWorthChange.toFixed(1)}% from last month
            </p>
          )}
        </div>

        {/* Total Assets */}
        <div className="liquid-glass rounded-2xl p-5">
          <div className="flex items-center justify-between">
            <p className="text-[14px] text-[#86868b] font-medium">Total Assets</p>
            <div className="w-9 h-9 rounded-xl bg-white/50 backdrop-blur-sm flex items-center justify-center">
              <Wallet className="w-5 h-5 text-[#1d1d1f]" />
            </div>
          </div>
          <p className="text-[28px] font-semibold mt-2 text-[#1d1d1f]">{formatCurrency(totalAssets)}</p>
          <p className="text-[12px] text-[#86868b] mt-1">{assets.length} investments tracked</p>
        </div>

        {/* Total Liabilities */}
        <div className="liquid-glass rounded-2xl p-5">
          <div className="flex items-center justify-between">
            <p className="text-[14px] text-[#86868b] font-medium">Liabilities</p>
            <div className="w-9 h-9 rounded-xl bg-white/50 backdrop-blur-sm flex items-center justify-center">
              <CreditCard className="w-5 h-5 text-[#1d1d1f]" />
            </div>
          </div>
          <p className="text-[28px] font-semibold mt-2 text-[#1d1d1f]">{formatCurrency(totalLiabilities)}</p>
          <p className="text-[12px] text-[#86868b] mt-1">{liabilities.length} active loans</p>
        </div>
      </div>

      {/* Party Receivable Cards */}
      {(totalReceivable > 0 || receivableIn30 > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Link href="/dashboard/parties" className="liquid-glass rounded-2xl p-5 transition-all hover:shadow-md">
            <div className="flex items-center justify-between">
              <p className="text-[14px] text-[#86868b] font-medium">Total Receivable</p>
              <div className="w-9 h-9 rounded-xl bg-green-50 flex items-center justify-center">
                <HandCoins className="w-5 h-5 text-green-600" />
              </div>
            </div>
            <p className="text-[28px] font-semibold mt-2 text-green-700">{formatCurrency(totalReceivable)}</p>
            <p className="text-[12px] text-[#86868b] mt-1">from parties</p>
          </Link>

          <Link href="/dashboard/parties" className="liquid-glass rounded-2xl p-5 transition-all hover:shadow-md">
            <div className="flex items-center justify-between">
              <p className="text-[14px] text-[#86868b] font-medium">Receivable in 30 Days</p>
              <div className="w-9 h-9 rounded-xl bg-orange-50 flex items-center justify-center">
                <Clock className="w-5 h-5 text-orange-600" />
              </div>
            </div>
            <p className="text-[28px] font-semibold mt-2 text-orange-700">{formatCurrency(receivableIn30)}</p>
            <p className="text-[12px] text-[#86868b] mt-1">upcoming dues</p>
          </Link>
        </div>
      )}

      {/* SIPs due this month */}
      {upcomingSips.length > 0 && (
        <Link href="/dashboard/sips" className="block liquid-glass rounded-2xl p-5 transition-all hover:shadow-md">
          <div className="flex items-center justify-between">
            <p className="text-[14px] text-[#86868b] font-medium">SIPs due this month</p>
            <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center">
              <Repeat className="w-5 h-5 text-indigo-600" />
            </div>
          </div>
          <p className="text-[28px] font-semibold mt-2 text-[#1d1d1f]">{formatCurrency(sipsDueAmount)}</p>
          <p className="text-[12px] text-[#86868b] mt-1">
            {upcomingSips.length} SIP{upcomingSips.length > 1 ? "s" : ""} remaining · next on day {nextSipDay}
          </p>
        </Link>
      )}

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Net Worth Trend */}
        <div className="liquid-glass rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[17px] font-semibold text-[#1d1d1f]">Net Worth Trend</h3>
            <Link href="/dashboard/snapshots" className="text-[12px] text-[#86868b] flex items-center gap-1 hover:text-[#1d1d1f] transition-colors">
              View all <ArrowUpRight className="w-3 h-3" />
            </Link>
          </div>
          <NetWorthChart snapshots={orderedSnapshots} />
        </div>

        {/* Asset Allocation */}
        <div className="liquid-glass rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[17px] font-semibold text-[#1d1d1f]">Asset Allocation</h3>
            <Link href="/dashboard/assets" className="text-[12px] text-[#86868b] flex items-center gap-1 hover:text-[#1d1d1f] transition-colors">
              Manage <ArrowUpRight className="w-3 h-3" />
            </Link>
          </div>
          <AllocationChart data={allocationData} total={totalAssets} />
        </div>
      </div>

      {/* Spending This Month */}
      <div className="liquid-glass rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[17px] font-semibold text-[#1d1d1f] dark:text-white">Spending This Month</h3>
          <Link href="/dashboard/transactions" className="text-[12px] text-[#86868b] flex items-center gap-1 hover:text-[#1d1d1f] dark:hover:text-white transition-colors">
            All transactions <ArrowUpRight className="w-3 h-3" />
          </Link>
        </div>
        <SpendingChart transactions={transactions} isLoading={loadingTransactions} />
      </div>

      {/* Goals Progress */}
      {goals.length > 0 && (
        <div className="liquid-glass rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[17px] font-semibold text-[#1d1d1f]">Goals Progress</h3>
            <Link href="/dashboard/goals" className="text-[12px] text-[#86868b] flex items-center gap-1 hover:text-[#1d1d1f] transition-colors">
              View all <ArrowUpRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="space-y-3">
            {goals.slice(0, 3).map((goal) => {
              const progress = goalProgressPct(goal, assets)
              return (
                <div key={goal.id} className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-white/50 backdrop-blur-sm flex items-center justify-center">
                    <Target className="w-5 h-5 text-[#1d1d1f]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-[#1d1d1f] truncate">{goal.name}</p>
                      <p className="text-[12px] text-[#86868b]">{progress.toFixed(0)}%</p>
                    </div>
                    <div className="mt-1.5 h-2 bg-[#f5f5f7] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#1d1d1f] rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(progress, 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { href: "/dashboard/assets?action=add", label: "Add Asset", Icon: Plus },
          { href: "/dashboard/transactions?action=add", label: "Log Expense", Icon: Receipt },
          { href: "/dashboard/snapshots?action=take", label: "Take Snapshot", Icon: Camera },
          { href: "/dashboard/assets?action=import", label: "Import Data", Icon: Download },
        ].map((action) => (
          <Link
            key={action.href}
            href={action.href}
            className="liquid-glass rounded-2xl p-4 transition-all duration-300 text-center flex flex-col items-center"
          >
            <div className="w-10 h-10 rounded-xl bg-white/50 backdrop-blur-sm flex items-center justify-center">
              <action.Icon className="w-5 h-5 text-[#1d1d1f]" strokeWidth={1.5} />
            </div>
            <p className="text-[12px] font-medium text-[#86868b] mt-2">{action.label}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}
