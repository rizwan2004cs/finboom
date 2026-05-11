"use client"

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react"
import { createClient } from "@/utils/supabase/client"
import { CURRENCIES } from "@/lib/constants"

interface ExchangeRates {
  [targetCurrency: string]: number // e.g. { USD: 0.012, EUR: 0.011 } — rates from INR
}

// Fallback rates (fetched 2026-05-11) used when Supabase has no data yet
const FALLBACK_RATES: ExchangeRates = {
  INR: 1,
  USD: 0.010540505,
  EUR: 0.0089653319,
  GBP: 0.0077558458,
  SGD: 0.013380803,
  AED: 0.038709981,
  AUD: 0.014577836,
  CAD: 0.014425999,
  JPY: 1.65653032,
  CHF: 0.0082101551,
}

interface CurrencyContextValue {
  /** The user-selected display currency code, e.g. "USD" */
  currency: string
  /** Currency symbol, e.g. "$" */
  symbol: string
  /** Set the display currency */
  setCurrency: (code: string) => void
  /** Convert an amount stored in INR to the display currency */
  convert: (amountInINR: number) => number
  /** Format a number (assumed INR-stored) into display currency string */
  formatCurrency: (amount: number) => string
  /** Format with compact notation (K, L, Cr for INR / K, M, B for others) */
  formatCompact: (amount: number) => string
  /** Trigger a fresh rate fetch from the API and reload */
  refreshRates: () => Promise<void>
  /** Whether rates are still loading */
  loading: boolean
  /** ISO timestamp of when rates were last fetched */
  lastUpdated: string | null
}

const CurrencyContext = createContext<CurrencyContextValue | null>(null)

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrencyState] = useState("INR")
  const [rates, setRates] = useState<ExchangeRates>(FALLBACK_RATES)
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<string | null>(null)

  // Load saved currency from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("finboom-currency")
    if (saved) setCurrencyState(saved)
  }, [])

  // Fetch rates from Supabase
  const loadRatesFromDB = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const { data } = await supabase
      .from("exchange_rates")
      .select("target_currency, rate, fetched_at")
      .eq("base_currency", "INR")

    if (data && data.length > 0) {
      const map: ExchangeRates = {}
      let latest = ""
      for (const row of data) {
        map[row.target_currency] = Number(row.rate)
        if (row.fetched_at > latest) latest = row.fetched_at
      }
      map["INR"] = 1
      setRates(map)
      setLastUpdated(latest)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    loadRatesFromDB()
  }, [loadRatesFromDB])

  const refreshRates = useCallback(async () => {
    try {
      const res = await fetch("/api/exchange-rates/refresh", { method: "POST" })
      if (res.ok) {
        await loadRatesFromDB()
      }
    } catch {
      // Network error or offline — silently ignore
    }
  }, [loadRatesFromDB])

  const setCurrency = useCallback((code: string) => {
    setCurrencyState(code)
    localStorage.setItem("finboom-currency", code)
  }, [])

  const rate = rates[currency] || 1

  const convert = useCallback(
    (amountInINR: number) => amountInINR * rate,
    [rate]
  )

  const currencyInfo = CURRENCIES.find((c) => c.code === currency) || CURRENCIES[0]
  const symbol = currencyInfo.symbol

  const formatCompact = useCallback(
    (amount: number) => {
      const converted = amount * rate
      if (currency === "INR") {
        if (converted >= 10000000) return `${symbol}${(converted / 10000000).toFixed(2)} Cr`
        if (converted >= 100000) return `${symbol}${(converted / 100000).toFixed(2)} L`
        if (converted >= 1000) return `${symbol}${(converted / 1000).toFixed(1)}K`
        return `${symbol}${converted.toLocaleString("en-IN")}`
      }
      // Western notation for other currencies
      if (Math.abs(converted) >= 1_000_000_000) return `${symbol}${(converted / 1_000_000_000).toFixed(2)}B`
      if (Math.abs(converted) >= 1_000_000) return `${symbol}${(converted / 1_000_000).toFixed(2)}M`
      if (Math.abs(converted) >= 1_000) return `${symbol}${(converted / 1_000).toFixed(1)}K`
      return `${symbol}${converted.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
    },
    [rate, currency, symbol]
  )

  const formatCurrency = useCallback(
    (amount: number) => {
      const converted = amount * rate
      if (currency === "INR") {
        return `${symbol}${converted.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
      }
      return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(converted)
    },
    [rate, currency, symbol]
  )

  return (
    <CurrencyContext.Provider
      value={{ currency, symbol, setCurrency, convert, formatCurrency, formatCompact, refreshRates, loading, lastUpdated }}
    >
      {children}
    </CurrencyContext.Provider>
  )
}

export function useCurrency() {
  const ctx = useContext(CurrencyContext)
  if (!ctx) throw new Error("useCurrency must be used within CurrencyProvider")
  return ctx
}
