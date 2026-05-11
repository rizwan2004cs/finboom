"use client"

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react"
import { createClient } from "@/utils/supabase/client"
import { CURRENCIES } from "@/lib/constants"

interface ExchangeRates {
  [targetCurrency: string]: number // e.g. { USD: 0.012, EUR: 0.011 } — rates from INR
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
  const [rates, setRates] = useState<ExchangeRates>({})
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
    setLoading(true)
    const res = await fetch("/api/exchange-rates/refresh", { method: "POST" })
    if (res.ok) {
      await loadRatesFromDB()
    }
    setLoading(false)
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
