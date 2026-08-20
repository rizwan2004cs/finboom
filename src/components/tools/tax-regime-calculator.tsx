"use client"

import { useMemo, useState } from "react"
import { compareRegimes } from "@/lib/finance/calculators"
import { formatINR } from "@/lib/finance/format"
import { CalcLayout, Field, MoneyInput, Segmented, Disclaimer } from "./ui"
import { cn } from "@/lib/utils"

export function TaxRegimeCalculator() {
  const [income, setIncome] = useState(1500000)
  const [salaried, setSalaried] = useState<"yes" | "no">("yes")
  const [sec80c, setSec80c] = useState(150000)
  const [sec80d, setSec80d] = useState(25000)
  const [nps, setNps] = useState(50000)
  const [homeLoan, setHomeLoan] = useState(0)
  const [hra, setHra] = useState(0)
  const [other, setOther] = useState(0)

  const oldDeductions = useMemo(
    () =>
      Math.min(sec80c, 150000) +
      sec80d +
      Math.min(nps, 50000) +
      Math.min(homeLoan, 200000) +
      hra +
      other,
    [sec80c, sec80d, nps, homeLoan, hra, other]
  )

  const result = useMemo(
    () => compareRegimes(income, oldDeductions, salaried === "yes"),
    [income, oldDeductions, salaried]
  )

  return (
    <CalcLayout
      inputs={
        <>
          <Field label="Gross annual income" hint="Total income before deductions">
            <MoneyInput value={income} onChange={setIncome} step={50000} ariaLabel="Gross annual income" />
          </Field>
          <Field label="Income type">
            <Segmented
              options={[
                { value: "yes", label: "Salaried" },
                { value: "no", label: "Non-salaried" },
              ]}
              value={salaried}
              onChange={setSalaried}
            />
          </Field>
          <div className="pt-1">
            <p className="text-sm font-semibold text-[#1d1d1f] dark:text-white">Old-regime deductions</p>
            <p className="text-xs text-[#86868b] dark:text-[#98989d]">Used only for the old regime. The new regime ignores these.</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="80C"><MoneyInput value={sec80c} onChange={setSec80c} step={10000} ariaLabel="Section 80C" /></Field>
            <Field label="80D (health)"><MoneyInput value={sec80d} onChange={setSec80d} step={5000} ariaLabel="Section 80D" /></Field>
            <Field label="NPS 80CCD(1B)"><MoneyInput value={nps} onChange={setNps} step={10000} ariaLabel="NPS 80CCD(1B)" /></Field>
            <Field label="Home loan interest"><MoneyInput value={homeLoan} onChange={setHomeLoan} step={10000} ariaLabel="Home loan interest" /></Field>
            <Field label="HRA exemption"><MoneyInput value={hra} onChange={setHra} step={10000} ariaLabel="HRA exemption" /></Field>
            <Field label="Other"><MoneyInput value={other} onChange={setOther} step={10000} ariaLabel="Other deductions" /></Field>
          </div>
        </>
      }
      results={
        <>
          <div className="grid grid-cols-2 gap-3">
            <RegimeCard
              title="New regime"
              taxable={result.new.taxableIncome}
              tax={result.new.totalTax}
              winner={result.cheaper === "new"}
            />
            <RegimeCard
              title="Old regime"
              taxable={result.old.taxableIncome}
              tax={result.old.totalTax}
              winner={result.cheaper === "old"}
            />
          </div>
          <div className="rounded-xl bg-accent/[0.06] border border-accent/15 px-4 py-3 text-center">
            {result.cheaper === "equal" ? (
              <p className="text-sm text-[#1d1d1f] dark:text-white">Both regimes cost the same.</p>
            ) : (
              <p className="text-sm text-[#1d1d1f] dark:text-white">
                The <span className="font-semibold text-accent">{result.cheaper} regime</span> saves you{" "}
                <span className="font-semibold text-accent">{formatINR(result.savings)}</span> this year.
              </p>
            )}
          </div>
          <Disclaimer>
            Estimates for FY 2025-26 (AY 2026-27) including 4% cess and Section 87A rebate, for individuals below 60. Surcharge on income above ₹50L is not included. Verify with a tax professional before filing.
          </Disclaimer>
        </>
      }
    />
  )
}

function RegimeCard({
  title,
  taxable,
  tax,
  winner,
}: {
  title: string
  taxable: number
  tax: number
  winner: boolean
}) {
  return (
    <div
      className={cn(
        // min-w-0 + break-all: a huge tax figure wraps inside this card
        // instead of overlapping the sibling regime card.
        "min-w-0 rounded-xl border p-4 transition-colors",
        winner
          ? "border-accent/40 bg-accent/[0.06]"
          : "border-black/[0.06] dark:border-white/[0.08]"
      )}
    >
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-[#1d1d1f] dark:text-white">{title}</p>
        {winner && (
          <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-semibold text-[var(--accent-foreground)]">
            Lower
          </span>
        )}
      </div>
      <p className="mt-2 text-2xl font-serif font-semibold tabular-nums break-all text-[#1d1d1f] dark:text-white">
        {formatINR(tax)}
      </p>
      <p className="mt-1 text-xs text-[#86868b] dark:text-[#98989d] break-all">
        Taxable: {formatINR(taxable)}
      </p>
    </div>
  )
}
