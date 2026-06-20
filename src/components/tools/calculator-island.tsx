"use client"

import { SipCalculator } from "./sip-calculator"
import { StepUpSipCalculator } from "./step-up-sip-calculator"
import { LumpsumCalculator } from "./lumpsum-calculator"
import { FdCalculator } from "./fd-calculator"
import { XirrCalculator } from "./xirr-calculator"
import { HraCalculator } from "./hra-calculator"
import { TaxRegimeCalculator } from "./tax-regime-calculator"

export function CalculatorIsland({ slug }: { slug: string }) {
  switch (slug) {
    case "sip":
      return <SipCalculator />
    case "step-up-sip":
      return <StepUpSipCalculator />
    case "lumpsum":
      return <LumpsumCalculator />
    case "fd":
      return <FdCalculator />
    case "xirr":
      return <XirrCalculator />
    case "hra":
      return <HraCalculator />
    case "income-tax":
      return <TaxRegimeCalculator />
    default:
      return null
  }
}
