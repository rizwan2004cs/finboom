"use client"

import { AlertTriangle, ShieldCheck } from "lucide-react"
import type { Asset } from "@/lib/types"
import { computeConcentration, computeMacroAllocation, MACRO_COLORS } from "@/lib/finance/portfolio"

export function PortfolioAnalytics({ assets }: Readonly<{ assets: Asset[] }>) {
  const macro = computeMacroAllocation(assets)
  const conc = computeConcentration(assets)
  if (conc.total <= 0) return null

  return (
    <div className="liquid-glass rounded-2xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-[#1d1d1f] dark:text-white">Portfolio analysis</p>
        <span className="text-xs font-medium text-[#86868b]">
          Diversification {conc.diversificationScore}/100
        </span>
      </div>

      {/* Macro allocation */}
      <div>
        <div className="flex h-3 w-full overflow-hidden rounded-full bg-black/[0.06] dark:bg-white/[0.08]">
          {macro.map((m) => (
            <div
              key={m.bucket}
              className={MACRO_COLORS[m.bucket]}
              style={{ width: `${m.pct}%` }}
              title={`${m.label} ${m.pct.toFixed(0)}%`}
            />
          ))}
        </div>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
          {macro.map((m) => (
            <span
              key={m.bucket}
              className="inline-flex items-center gap-1.5 text-xs text-[#6e6e73] dark:text-[#98989d]"
            >
              <span className={`inline-block h-2.5 w-2.5 rounded-sm ${MACRO_COLORS[m.bucket]}`} />
              {m.label} {m.pct.toFixed(0)}%
            </span>
          ))}
        </div>
      </div>

      {/* Warnings or all-clear */}
      {conc.warnings.length > 0 ? (
        <ul className="space-y-1.5 pt-1">
          {conc.warnings.map((w) => (
            <li key={w} className="flex items-start gap-2 text-xs text-[#6e6e73] dark:text-[#98989d]">
              <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0 text-amber-500" />
              <span>{w}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="flex items-center gap-2 text-xs text-[#6e6e73] dark:text-[#98989d] pt-1">
          <ShieldCheck className="w-3.5 h-3.5 shrink-0 text-emerald-500" />
          Well diversified across asset classes — nice work.
        </p>
      )}
    </div>
  )
}
