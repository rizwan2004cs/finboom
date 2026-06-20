"use client"

import { useEffect, useMemo, useState } from "react"
import { useUser } from "@/hooks/use-auth"
import { useProfile } from "@/hooks/use-profile"
import { createClient } from "@/utils/supabase/client"
import { useOfflineQuery } from "@/hooks/use-offline-query"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Shield, Heart, AlertTriangle, CheckCircle, Info } from "lucide-react"
import type { HealthCheck, Asset, Liability, Goal, Transaction } from "@/lib/types"
import { computeWealthCheck, type WealthDimension } from "@/lib/finance/wealth-check"
import { useCurrency } from "@/hooks/use-currency"

export default function HealthPage() {
  const { user } = useUser()
  const { formatCompact, symbol: currencySymbol } = useCurrency()
  const queryClient = useQueryClient()
  const [health, setHealth] = useState<HealthCheck>({
    has_term_insurance: false,
    term_insurance_cover: 0,
    has_health_insurance: false,
    health_insurance_cover: 0,
    emergency_fund_months: 0,
    monthly_expenses: 0,
  })
  const [saving, setSaving] = useState(false)
  const [monthlyIncome, setMonthlyIncome] = useState(0)

  const { activeProfile } = useProfile()
  const pf = activeProfile ? [{ column: "profile_id", op: "eq" as const, value: activeProfile.id }] : undefined
  const { data: txData = [] } = useOfflineQuery<Transaction>("transactions", user?.id, { filters: pf })
  const { data: assets = [] } = useOfflineQuery<Asset>("assets", user?.id, { filters: pf })
  const { data: liabilities = [] } = useOfflineQuery<Liability>("liabilities", user?.id, { filters: pf })
  const { data: goals = [] } = useOfflineQuery<Goal>("goals", user?.id, { filters: pf })

  const { isLoading: loading } = useQuery({
    queryKey: ["health_checks", user?.id],
    queryFn: async () => {
      const supabase = createClient()
      const { data } = await supabase.from("health_checks").select("*").eq("user_id", user!.id).single()
      return data as HealthCheck | null
    },
    enabled: !!user,
  })

  // Sync fetched data into local state for editing
  const healthData = queryClient.getQueryData<HealthCheck | null>(["health_checks", user?.id])
  useEffect(() => {
    if (healthData) setHealth(healthData)
  }, [healthData])

  useEffect(() => {
    const incomes = txData.filter(t => t.type === "income")
    if (incomes.length > 0) {
      const total = incomes.reduce((sum, t) => sum + Number(t.amount), 0)
      setMonthlyIncome(total / Math.max(1, Math.ceil(incomes.length / 3)))
    }
  }, [txData])

  async function saveHealth() {
    if (!user) return
    setSaving(true)
    const supabase = createClient()

    const data = {
      user_id: user.id,
      ...health,
      updated_at: new Date().toISOString(),
    }

    const { data: existing } = await supabase
      .from("health_checks")
      .select("id")
      .eq("user_id", user.id)
      .single()

    if (existing) {
      await supabase.from("health_checks").update(data).eq("id", existing.id)
    } else {
      await supabase.from("health_checks").insert(data)
    }

    queryClient.invalidateQueries({ queryKey: ["health_checks", user.id] })
    setSaving(false)
  }

  // Calculate scores
  const annualIncome = monthlyIncome * 12
  const idealTermCover = annualIncome * 10 // 10x annual income
  const idealHealthCover = Math.max(500000, annualIncome * 0.5) // 50% of annual or 5L min
  const idealEmergencyMonths = 6

  const termScore = health.has_term_insurance
    ? Math.min(100, (health.term_insurance_cover / Math.max(idealTermCover, 1)) * 100)
    : 0
  const healthScore = health.has_health_insurance
    ? Math.min(100, (health.health_insurance_cover / Math.max(idealHealthCover, 1)) * 100)
    : 0
  const emergencyScore = Math.min(100, (health.emergency_fund_months / idealEmergencyMonths) * 100)
  const overallScore = Math.round((termScore + healthScore + emergencyScore) / 3)

  const wealthCheck = useMemo(
    () => computeWealthCheck({ assets, liabilities, transactions: txData, goals, health, monthlyIncome }),
    [assets, liabilities, txData, goals, health, monthlyIncome]
  )
  const wealthCheckActions = useMemo(
    () =>
      wealthCheck.dimensions
        .filter((d) => d.action)
        .sort((a, b) => a.score - b.score)
        .slice(0, 3),
    [wealthCheck]
  )

  function getScoreBg(score: number) {
    if (score >= 80) return "bg-[#1d1d1f]"
    if (score >= 50) return "bg-[#6e6e73]"
    return "bg-[#86868b]"
  }

  function getScoreIcon(score: number) {
    if (score >= 80) return <CheckCircle className="w-5 h-5 text-[#1d1d1f]" />
    if (score >= 50) return <AlertTriangle className="w-5 h-5 text-[#6e6e73]" />
    return <AlertTriangle className="w-5 h-5 text-[#86868b]" />
  }

  if (loading || !user) {
    return (
      <div className="space-y-4">
        <div className="skeleton h-7 w-32 rounded-lg" />
        <div className="liquid-glass rounded-2xl p-5 space-y-4">
          <div className="skeleton h-6 w-40 rounded-lg" />
          <div className="grid grid-cols-2 gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="space-y-2">
                <div className="skeleton h-4 w-24 rounded-lg" />
                <div className="skeleton h-6 w-16 rounded-lg" />
              </div>
            ))}
          </div>
        </div>
        <div className="liquid-glass rounded-2xl p-5 space-y-3">
          <div className="skeleton h-5 w-36 rounded-lg" />
          <div className="skeleton h-3 w-full rounded-lg" />
          <div className="skeleton h-3 w-3/4 rounded-lg" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4" data-tour-page="health">
      {/* Header */}
      <div data-tour-el="health-header">
        <h1 className="text-xl font-bold text-[#1d1d1f]">Financial Health Check</h1>
        <p className="text-sm text-[#86868b]">Are you financially protected?</p>
      </div>

      {/* Wealth Check Score */}
      <div className="liquid-glass rounded-2xl p-6">
        <div className="flex items-center gap-5">
          <div className="relative w-24 h-24 shrink-0">
            <svg className="w-24 h-24 transform -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="40" fill="none" stroke="#f5f5f7" strokeWidth="8" />
              <circle
                cx="50" cy="50" r="40" fill="none"
                stroke={scoreHex(wealthCheck.score)}
                strokeWidth="8"
                strokeDasharray={`${wealthCheck.score * 2.51} 251`}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-bold" style={{ color: scoreHex(wealthCheck.score) }}>
                {wealthCheck.score}
              </span>
              <span className="text-[10px] text-[#86868b] -mt-0.5">/ 100</span>
            </div>
          </div>
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-wide text-[#86868b] font-semibold">Wealth Check</p>
            <p className="text-xl font-bold text-[#1d1d1f] dark:text-white">{wealthCheck.grade}</p>
            <p className="text-xs text-[#86868b] mt-0.5">Allocation, protection, tax, debt, savings &amp; goals</p>
          </div>
        </div>

        <div className="mt-5 space-y-3">
          {wealthCheck.dimensions.map((d) => (
            <WealthDimensionRow key={d.key} dim={d} />
          ))}
        </div>
      </div>

      {/* Essentials Cards */}
      <div className="space-y-3">
        {/* Term Insurance */}
        <div className="liquid-glass rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-white/50 backdrop-blur-sm flex items-center justify-center">
              <Shield className="w-5 h-5 text-[#1d1d1f]" strokeWidth={1.5} />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-[#1d1d1f]">Term Insurance</p>
              <p className="text-xs text-[#86868b]">Recommended: 10x annual income</p>
            </div>
            {getScoreIcon(termScore)}
          </div>

          <div className="space-y-3">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={health.has_term_insurance}
                onChange={(e) => setHealth(prev => ({ ...prev, has_term_insurance: e.target.checked }))}
                className="w-5 h-5 rounded-lg border-black/[0.08] text-[#1d1d1f] focus:ring-[#1d1d1f]/10"
              />
              <span className="text-sm text-[#1d1d1f]">I have term insurance</span>
            </label>

            {health.has_term_insurance && (
              <div>
                <label className="text-xs text-[#86868b]">Cover Amount ({currencySymbol})</label>
                <input
                  type="number"
                  value={health.term_insurance_cover || ""}
                  onChange={(e) => setHealth(prev => ({ ...prev, term_insurance_cover: Number(e.target.value) }))}
                  placeholder="e.g. 10000000"
                  className="mt-1 w-full px-4 py-2.5 rounded-xl bg-[#f5f5f7] border-0 text-sm text-[#1d1d1f] placeholder:text-[#86868b] focus:outline-none focus:ring-2 focus:ring-[#1d1d1f]/10"
                />
                {idealTermCover > 0 && (
                  <p className="text-xs text-[#86868b] mt-1">
                    Ideal: {formatCompact(idealTermCover)} (10x your estimated income)
                  </p>
                )}
              </div>
            )}

            <div className="h-2 bg-[#f5f5f7] rounded-full overflow-hidden">
              <div className={`h-full rounded-full ${getScoreBg(termScore)}`} style={{ width: `${termScore}%` }} />
            </div>
          </div>
        </div>

        {/* Health Insurance */}
        <div className="liquid-glass rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-white/50 backdrop-blur-sm flex items-center justify-center">
              <Heart className="w-5 h-5 text-[#1d1d1f]" strokeWidth={1.5} />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-[#1d1d1f]">Health Insurance</p>
              <p className="text-xs text-[#86868b]">Min {formatCompact(500000)} or 50% of annual income</p>
            </div>
            {getScoreIcon(healthScore)}
          </div>

          <div className="space-y-3">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={health.has_health_insurance}
                onChange={(e) => setHealth(prev => ({ ...prev, has_health_insurance: e.target.checked }))}
                className="w-5 h-5 rounded-lg border-black/[0.08] text-[#1d1d1f] focus:ring-[#1d1d1f]/10"
              />
              <span className="text-sm text-[#1d1d1f]">I have health insurance</span>
            </label>

            {health.has_health_insurance && (
              <div>
                <label className="text-xs text-[#86868b]">Cover Amount ({currencySymbol})</label>
                <input
                  type="number"
                  value={health.health_insurance_cover || ""}
                  onChange={(e) => setHealth(prev => ({ ...prev, health_insurance_cover: Number(e.target.value) }))}
                  placeholder="e.g. 500000"
                  className="mt-1 w-full px-4 py-2.5 rounded-xl bg-[#f5f5f7] border-0 text-sm text-[#1d1d1f] placeholder:text-[#86868b] focus:outline-none focus:ring-2 focus:ring-[#1d1d1f]/10"
                />
              </div>
            )}

            <div className="h-2 bg-[#f5f5f7] rounded-full overflow-hidden">
              <div className={`h-full rounded-full ${getScoreBg(healthScore)}`} style={{ width: `${healthScore}%` }} />
            </div>
          </div>
        </div>

        {/* Emergency Fund */}
        <div className="liquid-glass rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-white/50 backdrop-blur-sm flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-[#1d1d1f]" strokeWidth={1.5} />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-[#1d1d1f]">Emergency Fund</p>
              <p className="text-xs text-[#86868b]">Recommended: 6 months of expenses</p>
            </div>
            {getScoreIcon(emergencyScore)}
          </div>

          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-[#86868b]">Monthly Expenses ({currencySymbol})</label>
                <input
                  type="number"
                  value={health.monthly_expenses || ""}
                  onChange={(e) => setHealth(prev => ({ ...prev, monthly_expenses: Number(e.target.value) }))}
                  placeholder="e.g. 50000"
                  className="mt-1 w-full px-4 py-2.5 rounded-xl bg-[#f5f5f7] border-0 text-sm text-[#1d1d1f] placeholder:text-[#86868b] focus:outline-none focus:ring-2 focus:ring-[#1d1d1f]/10"
                />
              </div>
              <div>
                <label className="text-xs text-[#86868b]">Months Saved</label>
                <input
                  type="number"
                  step="0.5"
                  value={health.emergency_fund_months || ""}
                  onChange={(e) => setHealth(prev => ({ ...prev, emergency_fund_months: Number(e.target.value) }))}
                  placeholder="e.g. 3"
                  className="mt-1 w-full px-4 py-2.5 rounded-xl bg-[#f5f5f7] border-0 text-sm text-[#1d1d1f] placeholder:text-[#86868b] focus:outline-none focus:ring-2 focus:ring-[#1d1d1f]/10"
                />
              </div>
            </div>

            {health.monthly_expenses > 0 && (
              <p className="text-xs text-[#86868b] flex items-center gap-1">
                <Info className="w-3 h-3" />
                You need {formatCompact(health.monthly_expenses * 6)} for 6 months
              </p>
            )}

            <div className="h-2 bg-[#f5f5f7] rounded-full overflow-hidden">
              <div className={`h-full rounded-full ${getScoreBg(emergencyScore)}`} style={{ width: `${emergencyScore}%` }} />
            </div>
          </div>
        </div>
      </div>

      {/* Save Button */}
      <button
        onClick={saveHealth}
        disabled={saving}
        className="w-full liquid-glass-btn-primary disabled:opacity-50"
      >
        {saving ? "Saving..." : "Save Health Check"}
      </button>

      {/* Wealth Check actions */}
      {wealthCheckActions.length > 0 && (
        <div className="liquid-glass rounded-2xl p-5">
          <h3 className="font-semibold text-[#1d1d1f] dark:text-white mb-3">Top actions to raise your score</h3>
          <ul className="space-y-2.5">
            {wealthCheckActions.map((a) => (
              <li key={a.key} className="flex items-start gap-2 text-sm text-[#6e6e73] dark:text-[#98989d]">
                <span className="text-[#86868b] mt-0.5">•</span>
                <span><span className="font-medium text-[#1d1d1f] dark:text-white">{a.label}:</span> {a.action}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Recommendations */}
      <div className="liquid-glass rounded-2xl p-5">
        <h3 className="font-semibold text-[#1d1d1f] mb-3 flex items-center gap-2">
          Recommendations
        </h3>
        <ul className="space-y-2.5">
          {!health.has_term_insurance && (
            <li className="flex items-start gap-2 text-sm text-[#6e6e73]">
              <span className="text-[#86868b] mt-0.5">•</span>
              Get term insurance immediately. Cover should be at least 10x your annual income.
            </li>
          )}
          {health.has_term_insurance && termScore < 80 && (
            <li className="flex items-start gap-2 text-sm text-[#6e6e73]">
              <span className="text-[#86868b] mt-0.5">•</span>
              Consider increasing your term cover to at least {formatCompact(idealTermCover)}.
            </li>
          )}
          {!health.has_health_insurance && (
            <li className="flex items-start gap-2 text-sm text-[#6e6e73]">
              <span className="text-[#86868b] mt-0.5">•</span>
              Get health insurance with at least {formatCompact(500000)} cover. Medical costs are rising rapidly.
            </li>
          )}
          {health.emergency_fund_months < 6 && (
            <li className="flex items-start gap-2 text-sm text-[#6e6e73]">
              <span className="text-[#86868b] mt-0.5">•</span>
              Build your emergency fund to 6 months of expenses ({health.monthly_expenses > 0 ? formatCompact(health.monthly_expenses * 6) : "calculate your expenses first"}).
            </li>
          )}
          {overallScore >= 80 && (
            <li className="flex items-start gap-2 text-sm text-[#6e6e73]">
              <span className="text-[#1d1d1f] mt-0.5">•</span>
              You&apos;re doing great! Consider reviewing your coverage annually.
            </li>
          )}
        </ul>
      </div>
    </div>
  )
}

function scoreHex(score: number): string {
  if (score >= 80) return "#10b981"
  if (score >= 45) return "#f59e0b"
  return "#f43f5e"
}

const STATUS_BAR: Record<WealthDimension["status"], string> = {
  strong: "bg-emerald-500",
  fair: "bg-amber-500",
  weak: "bg-rose-500",
}

const STATUS_TEXT: Record<WealthDimension["status"], string> = {
  strong: "text-emerald-600 dark:text-emerald-400",
  fair: "text-amber-600 dark:text-amber-400",
  weak: "text-rose-600 dark:text-rose-400",
}

function WealthDimensionRow({ dim }: Readonly<{ dim: WealthDimension }>) {
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-[#1d1d1f] dark:text-white">{dim.label}</span>
        <span className={`text-xs font-semibold tabular-nums ${STATUS_TEXT[dim.status]}`}>{dim.score}</span>
      </div>
      <div className="mt-1.5 h-1.5 bg-[#f5f5f7] dark:bg-white/[0.08] rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${STATUS_BAR[dim.status]}`} style={{ width: `${dim.score}%` }} />
      </div>
      <p className="mt-1 text-xs text-[#86868b]">{dim.detail}</p>
    </div>
  )
}
