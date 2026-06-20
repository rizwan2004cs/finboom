"use client"

import { useMemo, useState } from "react"
import { hraExemption } from "@/lib/finance/calculators"
import { formatINR } from "@/lib/finance/format"
import { CalcLayout, Field, MoneyInput, Segmented, Stat, Disclaimer } from "./ui"

export function HraCalculator() {
  const [basic, setBasic] = useState(600000)
  const [hra, setHra] = useState(300000)
  const [rent, setRent] = useState(240000)
  const [metro, setMetro] = useState<"metro" | "non">("metro")

  const result = useMemo(
    () => hraExemption(basic, hra, rent, metro === "metro"),
    [basic, hra, rent, metro]
  )

  return (
    <CalcLayout
      inputs={
        <>
          <Field label="Basic salary (annual)" hint="Basic + DA for the year">
            <MoneyInput value={basic} onChange={setBasic} step={10000} ariaLabel="Annual basic salary" />
          </Field>
          <Field label="HRA received (annual)">
            <MoneyInput value={hra} onChange={setHra} step={10000} ariaLabel="Annual HRA received" />
          </Field>
          <Field label="Rent paid (annual)">
            <MoneyInput value={rent} onChange={setRent} step={10000} ariaLabel="Annual rent paid" />
          </Field>
          <Field label="City type">
            <Segmented
              options={[
                { value: "metro", label: "Metro (50%)" },
                { value: "non", label: "Non-metro (40%)" },
              ]}
              value={metro}
              onChange={setMetro}
            />
          </Field>
        </>
      }
      results={
        <>
          <Stat label="HRA exempt from tax" value={formatINR(result.exempt)} big accent />
          <Stat label="Taxable HRA" value={formatINR(result.taxable)} />
          <div className="rounded-xl border border-black/[0.06] dark:border-white/[0.08] p-4 space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-[#86868b] dark:text-[#98989d]">
              Exemption is the least of
            </p>
            <Row label="Actual HRA received" value={result.components.actualHra} winner={result.exempt === result.components.actualHra} />
            <Row label="Rent paid − 10% of basic" value={result.components.rentMinus10} winner={result.exempt === result.components.rentMinus10} />
            <Row label={`${metro === "metro" ? "50%" : "40%"} of basic salary`} value={result.components.percentOfBasic} winner={result.exempt === result.components.percentOfBasic} />
          </div>
          <Disclaimer>
            HRA exemption under Section 10(13A) is available only in the old tax regime. Delhi, Mumbai, Kolkata, and Chennai count as metro cities.
          </Disclaimer>
        </>
      }
    />
  )
}

function Row({ label, value, winner }: { label: string; value: number; winner: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-[#6e6e73] dark:text-[#98989d]">{label}</span>
      <span className={winner ? "font-semibold text-accent tabular-nums" : "tabular-nums text-[#1d1d1f] dark:text-white"}>
        {formatINR(value)}
      </span>
    </div>
  )
}
