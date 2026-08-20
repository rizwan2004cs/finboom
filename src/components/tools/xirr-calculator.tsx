"use client"

import { useMemo, useState } from "react"
import { xirr, type CashFlow } from "@/lib/finance/calculators"
import { formatINR, formatPct } from "@/lib/finance/format"
import { CalcLayout, Field, Stat, Disclaimer, MAX_MONEY } from "./ui"
import { cn } from "@/lib/utils"

type Row = { id: string; date: string; amount: number; kind: "invest" | "redeem" }

function today(): string {
  return new Date().toISOString().slice(0, 10)
}
function yearsAgo(n: number): string {
  const d = new Date()
  d.setFullYear(d.getFullYear() - n)
  return d.toISOString().slice(0, 10)
}
function uid(): string {
  return Math.random().toString(36).slice(2, 10)
}

const INITIAL: Row[] = [
  { id: uid(), date: yearsAgo(3), amount: 100000, kind: "invest" },
  { id: uid(), date: yearsAgo(2), amount: 100000, kind: "invest" },
  { id: uid(), date: yearsAgo(1), amount: 100000, kind: "invest" },
  { id: uid(), date: today(), amount: 380000, kind: "redeem" },
]

export function XirrCalculator() {
  const [rows, setRows] = useState<Row[]>(INITIAL)

  const { rate, invested, redeemed } = useMemo(() => {
    const flows: CashFlow[] = rows
      .filter((r) => r.date && Number.isFinite(r.amount) && r.amount > 0)
      .map((r) => ({
        date: new Date(r.date),
        amount: r.kind === "invest" ? -r.amount : r.amount,
      }))
    const invested = rows.filter((r) => r.kind === "invest").reduce((s, r) => s + (r.amount || 0), 0)
    const redeemed = rows.filter((r) => r.kind === "redeem").reduce((s, r) => s + (r.amount || 0), 0)
    return { rate: xirr(flows), invested, redeemed }
  }, [rows])

  const update = (id: string, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)))
  const remove = (id: string) => setRows((rs) => rs.filter((r) => r.id !== id))
  const add = () =>
    setRows((rs) => [...rs, { id: uid(), date: today(), amount: 50000, kind: "invest" }])

  const absoluteGain = redeemed - invested

  return (
    <CalcLayout
      inputs={
        <Field label="Cash flows" hint="Add each investment and every withdrawal or current value, with its date.">
          <div className="space-y-2">
              {rows.map((row) => (
                <div key={row.id} className="flex items-center gap-2">
                  <select
                    aria-label="Cash flow type"
                    value={row.kind}
                    onChange={(e) => update(row.id, { kind: e.target.value as Row["kind"] })}
                    className={cn(
                      "rounded-lg border border-black/10 dark:border-white/15 bg-white/60 dark:bg-white/[0.04] px-2 py-2 text-sm outline-none focus:ring-2 focus:ring-accent/40",
                      row.kind === "invest" ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"
                    )}
                  >
                    <option value="invest">Invested</option>
                    <option value="redeem">Received</option>
                  </select>
                  <input
                    type="date"
                    aria-label="Cash flow date"
                    value={row.date}
                    onChange={(e) => update(row.id, { date: e.target.value })}
                    className="rounded-lg border border-black/10 dark:border-white/15 bg-white/60 dark:bg-white/[0.04] px-2 py-2 text-sm text-[#1d1d1f] dark:text-white outline-none focus:ring-2 focus:ring-accent/40"
                  />
                  <div className="flex flex-1 items-center rounded-lg border border-black/10 dark:border-white/15 bg-white/60 dark:bg-white/[0.04] focus-within:ring-2 focus-within:ring-accent/40">
                    <span className="pl-2 text-[#86868b]">₹</span>
                    <input
                      type="number"
                      inputMode="decimal"
                      aria-label="Cash flow amount"
                      value={Number.isFinite(row.amount) ? row.amount : ""}
                      min={0}
                      onChange={(e) =>
                        update(row.id, {
                          amount: Math.min(MAX_MONEY, Math.max(0, Number.parseFloat(e.target.value) || 0)),
                        })
                      }
                      className="w-full bg-transparent px-1.5 py-2 text-sm text-[#1d1d1f] dark:text-white outline-none tabular-nums [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => remove(row.id)}
                    aria-label="Remove cash flow"
                    className="shrink-0 rounded-lg p-2 text-[#86868b] hover:bg-black/[0.05] dark:hover:bg-white/[0.08] hover:text-destructive transition-colors"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={add}
              className="mt-3 text-sm font-medium text-accent hover:underline"
            >
              + Add cash flow
            </button>
        </Field>
      }
      results={
        <>
          <Stat
            label="XIRR (annualised return)"
            value={rate === null ? "—" : formatPct(rate * 100)}
            big
            accent
            sub={rate === null ? "Add at least one investment and one received amount" : "True time-weighted return"}
          />
          <div className="grid grid-cols-2 gap-4">
            <Stat label="Total invested" value={formatINR(invested)} />
            <Stat label="Total received" value={formatINR(redeemed)} />
          </div>
          <Stat
            label="Absolute gain"
            value={`${absoluteGain >= 0 ? "+" : ""}${formatINR(absoluteGain)}`}
          />
          <Disclaimer>
            XIRR weights each cash flow by its date, so it reflects the real annualised return of an irregular investment schedule. Use today&apos;s date and your current portfolio value as the final &ldquo;Received&rdquo; row.
          </Disclaimer>
        </>
      }
    />
  )
}
