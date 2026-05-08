"use client"

import { useEffect, useState } from "react"
import { useUser } from "@clerk/nextjs"
import { createClient } from "@/utils/supabase/client"
import { fetchTable } from "@/lib/offline"
import { Shield, Heart, AlertTriangle, CheckCircle, Info } from "lucide-react"
import type { HealthCheck } from "@/lib/types"

export default function HealthPage() {
  const { user } = useUser()
  const [health, setHealth] = useState<HealthCheck>({
    has_term_insurance: false,
    term_insurance_cover: 0,
    has_health_insurance: false,
    health_insurance_cover: 0,
    emergency_fund_months: 0,
    monthly_expenses: 0,
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [monthlyIncome, setMonthlyIncome] = useState(0)

  useEffect(() => {
    if (!user) return
    loadData()
  }, [user])

  async function loadData() {
    const supabase = createClient()
    const [healthRes, txData] = await Promise.all([
      supabase.from("health_checks").select("*").eq("user_id", user!.id).single(),
      fetchTable<{ amount: number; type: string }>("transactions", user!.id),
    ])

    if (healthRes.data) {
      setHealth(healthRes.data)
    }

    // Calculate avg monthly income from transactions
    const incomes = txData.filter(t => t.type === "income")
    if (incomes.length > 0) {
      const total = incomes.reduce((sum, t) => sum + Number(t.amount), 0)
      setMonthlyIncome(total / Math.max(1, Math.ceil(incomes.length / 3))) // rough avg
    }

    setLoading(false)
  }

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

  function getScoreColor(score: number) {
    if (score >= 80) return "text-[#1d1d1f]"
    if (score >= 50) return "text-[#6e6e73]"
    return "text-[#86868b]"
  }

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

  if (loading) {
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
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-[#1d1d1f]">Financial Health Check</h1>
        <p className="text-sm text-[#86868b]">Are you financially protected?</p>
      </div>

      {/* Overall Score */}
      <div className="liquid-glass rounded-2xl p-6 text-center">
        <div className="relative w-24 h-24 mx-auto mb-3">
          <svg className="w-24 h-24 transform -rotate-90" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="40" fill="none" stroke="#f5f5f7" strokeWidth="8" />
            <circle
              cx="50" cy="50" r="40" fill="none"
              stroke={overallScore >= 80 ? "#1d1d1f" : overallScore >= 50 ? "#6e6e73" : "#86868b"}
              strokeWidth="8"
              strokeDasharray={`${overallScore * 2.51} 251`}
              strokeLinecap="round"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className={`text-2xl font-bold ${getScoreColor(overallScore)}`}>{overallScore}</span>
          </div>
        </div>
        <p className="font-semibold text-[#1d1d1f]">
          {overallScore >= 80 ? "Great! You're well protected" :
           overallScore >= 50 ? "Decent, but room for improvement" :
           "Needs attention"}
        </p>
        <p className="text-xs text-[#86868b] mt-1">Based on your financial essentials</p>
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
                <label className="text-xs text-[#86868b]">Cover Amount (₹)</label>
                <input
                  type="number"
                  value={health.term_insurance_cover || ""}
                  onChange={(e) => setHealth(prev => ({ ...prev, term_insurance_cover: Number(e.target.value) }))}
                  placeholder="e.g. 10000000"
                  className="mt-1 w-full px-4 py-2.5 rounded-xl bg-[#f5f5f7] border-0 text-sm text-[#1d1d1f] placeholder:text-[#86868b] focus:outline-none focus:ring-2 focus:ring-[#1d1d1f]/10"
                />
                {idealTermCover > 0 && (
                  <p className="text-xs text-[#86868b] mt-1">
                    Ideal: ₹{idealTermCover.toLocaleString("en-IN")} (10x your estimated income)
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
              <p className="text-xs text-[#86868b]">Min ₹5L or 50% of annual income</p>
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
                <label className="text-xs text-[#86868b]">Cover Amount (₹)</label>
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
                <label className="text-xs text-[#86868b]">Monthly Expenses (₹)</label>
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
                You need ₹{(health.monthly_expenses * 6).toLocaleString("en-IN")} for 6 months
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
              Consider increasing your term cover to at least ₹{idealTermCover.toLocaleString("en-IN")}.
            </li>
          )}
          {!health.has_health_insurance && (
            <li className="flex items-start gap-2 text-sm text-[#6e6e73]">
              <span className="text-[#86868b] mt-0.5">•</span>
              Get health insurance with at least ₹5L cover. Medical costs are rising rapidly.
            </li>
          )}
          {health.emergency_fund_months < 6 && (
            <li className="flex items-start gap-2 text-sm text-[#6e6e73]">
              <span className="text-[#86868b] mt-0.5">•</span>
              Build your emergency fund to 6 months of expenses ({health.monthly_expenses > 0 ? `₹${(health.monthly_expenses * 6).toLocaleString("en-IN")}` : "calculate your expenses first"}).
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
