"use client"

import { useMemo, useState } from "react"
import { lumpsumFutureValue } from "@/lib/finance/calculators"
import { formatINR, formatINRCompact } from "@/lib/finance/format"
import { CalcLayout, Field, MoneyInput, Slider, Stat, SplitBar, Disclaimer } from "./ui"

export function LumpsumCalculator() {
  const [amount, setAmount] = useState(500000)
  const [rate, setRate] = useState(12)
  const [years, setYears] = useState(10)

  const result = useMemo(() => lumpsumFutureValue(amount, rate, years), [amount, rate, years])

  return (
    <CalcLayout
      inputs={
        <>
          <Field label="Investment amount" value={formatINRCompact(amount)}>
            <MoneyInput value={amount} onChange={setAmount} step={10000} ariaLabel="Investment amount" />
            <Slider value={amount} onChange={setAmount} min={10000} max={10000000} step={10000} ariaLabel="Investment amount slider" />
          </Field>
          <Field label="Expected return (p.a.)" value={`${rate}%`}>
            <MoneyInput value={rate} onChange={setRate} prefix="" suffix="% p.a." max={100} step={0.5} ariaLabel="Expected annual return" />
            <Slider value={rate} onChange={setRate} min={1} max={30} step={0.5} ariaLabel="Expected return slider" />
          </Field>
          <Field label="Time period" value={`${years} yr`}>
            <MoneyInput value={years} onChange={setYears} prefix="" suffix="years" max={100} step={1} ariaLabel="Time period in years" />
            <Slider value={years} onChange={setYears} min={1} max={40} step={1} ariaLabel="Time period slider" />
          </Field>
        </>
      }
      results={
        <>
          <Stat label="Future value" value={formatINR(result.futureValue)} big accent sub={formatINRCompact(result.futureValue)} />
          <div className="grid grid-cols-2 gap-4">
            <Stat label="Invested" value={formatINR(result.invested)} />
            <Stat label="Est. returns" value={formatINR(result.gains)} />
          </div>
          <SplitBar base={result.invested} gain={result.gains} />
          <Disclaimer>
            Compounded annually at {rate}%. Investment returns vary year to year; this is an estimate, not a guarantee.
          </Disclaimer>
        </>
      }
    />
  )
}
