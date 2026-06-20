"use client"

import { useMemo, useState } from "react"
import { sipFutureValue } from "@/lib/finance/calculators"
import { formatINR, formatINRCompact } from "@/lib/finance/format"
import { CalcLayout, Field, MoneyInput, Slider, Stat, SplitBar, Disclaimer } from "./ui"

export function SipCalculator() {
  const [monthly, setMonthly] = useState(10000)
  const [rate, setRate] = useState(12)
  const [years, setYears] = useState(15)

  const result = useMemo(() => sipFutureValue(monthly, rate, years), [monthly, rate, years])

  return (
    <CalcLayout
      inputs={
        <>
          <Field label="Monthly investment" value={formatINRCompact(monthly)}>
            <MoneyInput value={monthly} onChange={setMonthly} step={500} ariaLabel="Monthly investment" />
            <Slider value={monthly} onChange={setMonthly} min={500} max={200000} step={500} ariaLabel="Monthly investment slider" />
          </Field>
          <Field label="Expected return (p.a.)" value={`${rate}%`}>
            <MoneyInput value={rate} onChange={setRate} prefix="" suffix="% p.a." step={0.5} ariaLabel="Expected annual return" />
            <Slider value={rate} onChange={setRate} min={1} max={30} step={0.5} ariaLabel="Expected return slider" />
          </Field>
          <Field label="Time period" value={`${years} yr`}>
            <MoneyInput value={years} onChange={setYears} prefix="" suffix="years" step={1} ariaLabel="Time period in years" />
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
            Assumes a constant {rate}% annual return compounded monthly with contributions at the start of each month. Actual mutual fund returns vary and are not guaranteed.
          </Disclaimer>
        </>
      }
    />
  )
}
