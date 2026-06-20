"use client"

import { useMemo, useState } from "react"
import { stepUpSipFutureValue, sipFutureValue } from "@/lib/finance/calculators"
import { formatINR, formatINRCompact } from "@/lib/finance/format"
import { CalcLayout, Field, MoneyInput, Slider, Stat, SplitBar, Disclaimer } from "./ui"

export function StepUpSipCalculator() {
  const [monthly, setMonthly] = useState(10000)
  const [rate, setRate] = useState(12)
  const [years, setYears] = useState(15)
  const [stepUp, setStepUp] = useState(10)

  const result = useMemo(
    () => stepUpSipFutureValue(monthly, rate, years, stepUp),
    [monthly, rate, years, stepUp]
  )
  const flat = useMemo(() => sipFutureValue(monthly, rate, years), [monthly, rate, years])
  const extra = Math.max(0, result.futureValue - flat.futureValue)

  return (
    <CalcLayout
      inputs={
        <>
          <Field label="Starting monthly investment" value={formatINRCompact(monthly)}>
            <MoneyInput value={monthly} onChange={setMonthly} step={500} ariaLabel="Starting monthly investment" />
            <Slider value={monthly} onChange={setMonthly} min={500} max={200000} step={500} ariaLabel="Starting monthly investment slider" />
          </Field>
          <Field label="Annual step-up" value={`${stepUp}%`}>
            <MoneyInput value={stepUp} onChange={setStepUp} prefix="" suffix="% / yr" step={1} ariaLabel="Annual step-up percent" />
            <Slider value={stepUp} onChange={setStepUp} min={0} max={25} step={1} ariaLabel="Annual step-up slider" />
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
          {extra > 0 && (
            <div className="rounded-xl bg-accent/[0.06] border border-accent/15 px-4 py-3">
              <p className="text-sm text-[#1d1d1f] dark:text-white">
                Stepping up {stepUp}% a year adds{" "}
                <span className="font-semibold text-accent">{formatINR(extra)}</span> versus a flat SIP of {formatINRCompact(monthly)}/month.
              </p>
            </div>
          )}
          <Disclaimer>
            Your monthly amount increases by {stepUp}% after every 12 months. Returns are assumed constant at {rate}% and are not guaranteed.
          </Disclaimer>
        </>
      }
    />
  )
}
