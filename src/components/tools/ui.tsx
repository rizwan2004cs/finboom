"use client"

import { cn } from "@/lib/utils"
import { formatINR } from "@/lib/finance/format"
import type { ReactNode } from "react"

export function CalcLayout({
  inputs,
  results,
}: Readonly<{
  inputs: ReactNode
  results: ReactNode
}>) {
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
      <div className="liquid-glass p-6 space-y-5">{inputs}</div>
      <div className="liquid-glass p-6 space-y-5">{results}</div>
    </div>
  )
}

export function Field({
  label,
  hint,
  value,
  children,
}: Readonly<{
  label: string
  hint?: string
  value?: string
  children: ReactNode
}>) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <label className="text-sm font-medium text-[#1d1d1f] dark:text-white">{label}</label>
        {value !== undefined && (
          <span className="text-sm font-semibold tabular-nums text-accent">{value}</span>
        )}
      </div>
      {hint && <p className="mt-0.5 text-xs text-[#86868b] dark:text-[#98989d]">{hint}</p>}
      <div className="mt-2">{children}</div>
    </div>
  )
}

export function MoneyInput({
  value,
  onChange,
  prefix = "₹",
  suffix,
  min = 0,
  step = 1,
  ariaLabel,
}: Readonly<{
  value: number
  onChange: (n: number) => void
  prefix?: string
  suffix?: string
  min?: number
  step?: number
  ariaLabel?: string
}>) {
  return (
    <div className="flex items-center rounded-xl border border-black/10 dark:border-white/15 bg-white/60 dark:bg-white/[0.04] focus-within:ring-2 focus-within:ring-accent/40 transition-shadow">
      {prefix && (
        <span className="pl-3 pr-1 text-[#86868b] dark:text-[#98989d] select-none">{prefix}</span>
      )}
      <input
        type="number"
        inputMode="decimal"
        aria-label={ariaLabel}
        value={Number.isFinite(value) ? value : ""}
        min={min}
        step={step}
        onChange={(e) => {
          const n = Number.parseFloat(e.target.value)
          onChange(Number.isFinite(n) ? n : 0)
        }}
        className="w-full bg-transparent px-2 py-2.5 text-[#1d1d1f] dark:text-white outline-none tabular-nums [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
      />
      {suffix && (
        <span className="pr-3 pl-1 text-[#86868b] dark:text-[#98989d] select-none whitespace-nowrap">
          {suffix}
        </span>
      )}
    </div>
  )
}

export function Slider({
  value,
  onChange,
  min,
  max,
  step = 1,
  ariaLabel,
}: Readonly<{
  value: number
  onChange: (n: number) => void
  min: number
  max: number
  step?: number
  ariaLabel?: string
}>) {
  return (
    <input
      type="range"
      aria-label={ariaLabel}
      value={value}
      min={min}
      max={max}
      step={step}
      onChange={(e) => onChange(Number.parseFloat(e.target.value))}
      className="mt-3 w-full accent-[var(--accent)] cursor-pointer"
    />
  )
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: Readonly<{
  options: { value: T; label: string }[]
  value: T
  onChange: (v: T) => void
}>) {
  return (
    <div className="inline-flex rounded-xl border border-black/10 dark:border-white/15 p-0.5 bg-black/[0.03] dark:bg-white/[0.04]">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={cn(
            "px-3.5 py-1.5 text-sm font-medium rounded-[10px] transition-all",
            value === opt.value
              ? "bg-white dark:bg-white/15 text-[#1d1d1f] dark:text-white shadow-sm"
              : "text-[#6e6e73] dark:text-[#98989d] hover:text-[#1d1d1f] dark:hover:text-white"
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

export function Stat({
  label,
  value,
  big = false,
  accent = false,
  sub,
}: Readonly<{
  label: string
  value: string
  big?: boolean
  accent?: boolean
  sub?: string
}>) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-[#86868b] dark:text-[#98989d]">
        {label}
      </p>
      <p
        className={cn(
          "mt-1 font-semibold tabular-nums",
          big ? "text-3xl md:text-4xl font-serif" : "text-xl",
          accent ? "text-accent" : "text-[#1d1d1f] dark:text-white"
        )}
      >
        {value}
      </p>
      {sub && <p className="mt-0.5 text-xs text-[#86868b] dark:text-[#98989d]">{sub}</p>}
    </div>
  )
}

/** Stacked horizontal bar showing the split between an invested base and gains. */
export function SplitBar({
  base,
  gain,
  baseLabel = "Invested",
  gainLabel = "Returns",
}: Readonly<{
  base: number
  gain: number
  baseLabel?: string
  gainLabel?: string
}>) {
  const total = Math.max(1, base + Math.max(0, gain))
  const basePct = Math.round((base / total) * 100)
  const gainPct = 100 - basePct
  return (
    <div>
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-black/[0.06] dark:bg-white/[0.08]">
        <div className="bg-[#86868b]" style={{ width: `${basePct}%` }} />
        <div className="bg-accent" style={{ width: `${gainPct}%` }} />
      </div>
      <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-[#6e6e73] dark:text-[#98989d]">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-[#86868b]" />
          {baseLabel} · {formatINR(base)}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-accent" />
          {gainLabel} · {formatINR(Math.max(0, gain))}
        </span>
      </div>
    </div>
  )
}

export function Disclaimer({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <p className="text-xs leading-relaxed text-[#86868b] dark:text-[#98989d]">{children}</p>
  )
}
