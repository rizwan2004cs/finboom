// Pure INR formatting helpers for the public calculators (no currency context).

export function formatINR(value: number, fractionDigits = 0): string {
  if (!Number.isFinite(value)) return "₹0"
  return `₹${value.toLocaleString("en-IN", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  })}`
}

export function formatINRCompact(value: number): string {
  const abs = Math.abs(value)
  const sign = value < 0 ? "-" : ""
  const CRORE = 10_000_000
  const LAKH = 100_000
  const THOUSAND = 1_000
  if (abs >= CRORE) return `${sign}₹${(abs / CRORE).toFixed(2)} Cr`
  if (abs >= LAKH) return `${sign}₹${(abs / LAKH).toFixed(2)} L`
  if (abs >= THOUSAND) return `${sign}₹${(abs / THOUSAND).toFixed(1)}K`
  return `${sign}₹${abs.toLocaleString("en-IN")}`
}

export function formatPct(value: number, fractionDigits = 1): string {
  if (!Number.isFinite(value)) return "—"
  return `${value.toFixed(fractionDigits)}%`
}
