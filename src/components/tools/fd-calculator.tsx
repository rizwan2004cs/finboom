"use client"

import { useMemo, useState } from "react"
import { fdMaturity } from "@/lib/finance/calculators"
import { formatINR, formatINRCompact } from "@/lib/finance/format"
import { CalcLayout, Field, MoneyInput, Slider, Segmented, Stat, SplitBar, Disclaimer } from "./ui"

const FREQ_OPTIONS = [
  { value: "4", label: "Quarterly" },
  { value: "12", label: "Monthly" },
  { value: "2", label: "Half-yearly" },
  { value: "1", label: "Yearly" },
] as const

export function FdCalculator() {
  const [principal, setPrincipal] = useState(500000)
  const [rate, setRate] = useState(7)
  const [years, setYears] = useState(5)
  const [freq, setFreq] = useState<(typeof FREQ_OPTIONS)[number]["value"]>("4")

  const result = useMemo(
    () => fdMaturity(principal, rate, years, Number.parseInt(freq, 10)),
    [principal, rate, years, freq]
  )

  return (
    <CalcLayout
      inputs={
        <>
          <Field label="Deposit amount" value={formatINRCompact(principal)}>
            <MoneyInput value={principal} onChange={setPrincipal} step={10000} ariaLabel="Deposit amount" />
            <Slider value={principal} onChange={setPrincipal} min={10000} max={10000000} step={10000} ariaLabel="Deposit amount slider" />
          </Field>
          <Field label="Interest rate (p.a.)" value={`${rate}%`}>
            <MoneyInput value={rate} onChange={setRate} prefix="" suffix="% p.a." max={100} step={0.1} ariaLabel="Interest rate" />
            <Slider value={rate} onChange={setRate} min={1} max={12} step={0.1} ariaLabel="Interest rate slider" />
          </Field>
          <Field label="Tenure" value={`${years} yr`}>
            <MoneyInput value={years} onChange={setYears} prefix="" suffix="years" max={100} step={1} ariaLabel="Tenure in years" />
            <Slider value={years} onChange={setYears} min={1} max={20} step={1} ariaLabel="Tenure slider" />
          </Field>
          <Field label="Compounding">
            <Segmented options={[...FREQ_OPTIONS]} value={freq} onChange={setFreq} />
          </Field>
        </>
      }
      results={
        <>
          <Stat label="Maturity value" value={formatINR(result.futureValue)} big accent sub={formatINRCompact(result.futureValue)} />
          <div className="grid grid-cols-2 gap-4">
            <Stat label="Deposited" value={formatINR(result.invested)} />
            <Stat label="Interest earned" value={formatINR(result.gains)} />
          </div>
          <SplitBar base={result.invested} gain={result.gains} baseLabel="Principal" gainLabel="Interest" />
          <Disclaimer>
            Maturity is pre-tax. FD interest is taxable at your income slab and banks may deduct TDS. Indian banks typically compound quarterly.
          </Disclaimer>
        </>
      }
    />
  )
}
