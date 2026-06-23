import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { getSupabaseSecretKey } from "@/utils/supabase/admin"

const TARGET_CURRENCIES = ["usd", "eur", "gbp", "sgd", "aed", "aud", "cad", "jpy", "chf"]

const PRIMARY_URL = "https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/inr.min.json"
const FALLBACK_URL = "https://latest.currency-api.pages.dev/v1/currencies/inr.min.json"

// POST /api/exchange-rates/refresh — user-triggered rate refresh
export async function POST() {
  try {
    let data: { date: string; inr: Record<string, number> }
    try {
      const res = await fetch(PRIMARY_URL, { cache: "no-store" })
      if (!res.ok) throw new Error(`Primary failed: ${res.status}`)
      data = await res.json()
    } catch {
      const res = await fetch(FALLBACK_URL, { cache: "no-store" })
      if (!res.ok) throw new Error(`Fallback also failed: ${res.status}`)
      data = await res.json()
    }

    const rates = data.inr
    if (!rates || typeof rates !== "object") {
      return NextResponse.json({ error: "Invalid API response" }, { status: 502 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      getSupabaseSecretKey()!
    )

    const rows = [
      { base_currency: "INR", target_currency: "INR", rate: 1, fetched_at: new Date().toISOString() },
      ...TARGET_CURRENCIES
        .filter((c) => rates[c] != null)
        .map((c) => ({
          base_currency: "INR",
          target_currency: c.toUpperCase(),
          rate: rates[c],
          fetched_at: new Date().toISOString(),
        })),
    ]

    const { error } = await supabase
      .from("exchange_rates")
      .upsert(rows, { onConflict: "base_currency,target_currency" })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, updated: rows.length, date: data.date })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
