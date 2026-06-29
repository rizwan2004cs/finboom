import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function subMonths(date: Date, months: number): Date {
  const d = new Date(date)
  d.setMonth(d.getMonth() - months)
  return d
}

export function subYears(date: Date, years: number): Date {
  const d = new Date(date)
  d.setFullYear(d.getFullYear() - years)
  return d
}

/**
 * Local calendar date as YYYY-MM-DD. `toISOString()` is UTC and can name the
 * wrong day in IST (e.g. 23:30 IST → next day's date), so build the string from
 * local parts instead.
 */
export function todayLocalISO(date: Date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
}

/** E.164 caps subscriber numbers at 15 digits. */
export const PHONE_MAX_LENGTH = 15

/** Strip everything but digits and cap to the E.164 max length (15). */
export function sanitizePhone(value: string): string {
  return (value || "").replace(/\D+/g, "").slice(0, PHONE_MAX_LENGTH)
}

/** A phone is valid when empty (optional field) OR has between 6 and 15 digits.
 *  A non-empty value that yields too few digits (e.g. "abc" or "123") is invalid. */
export function isValidPhone(value: string): boolean {
  const raw = (value || "").trim()
  if (raw.length === 0) return true
  const digits = sanitizePhone(raw)
  return digits.length >= 6 && digits.length <= PHONE_MAX_LENGTH
}

/** True when the YYYY-MM-DD string is a real calendar date. */
export function isValidISODate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return false
  const [y, m, d] = value.split("-").map(Number)
  const dt = new Date(y, m - 1, d)
  return (
    dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d
  )
}

/** True when the local calendar date is strictly after today. */
export function isFutureISODate(value: string): boolean {
  if (!isValidISODate(value)) return false
  return value > todayLocalISO()
}

/**
 * Format a due date with the year always visible — `12 Jun 2026`. The previous
 * rendering dropped the year, so a due date in a different year was ambiguous.
 * Falls back to the raw string if it isn't a valid date.
 */
export function formatDueDate(iso: string | null | undefined): string {
  if (!iso || !isValidISODate(iso)) return iso || ""
  return new Date(iso + "T00:00:00").toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

/** Notification types that should fire at most once per IST day. Anything not in
 *  this set is an "ever" type (fires once, all-time). */
export const DAILY_NOTIFICATION_TYPES = new Set([
  "overdue_payment",
  "due_approaching",
  "sip_reminder",
])

/** Stable per-notification dedupe key. Daily types are scoped to the day so a
 *  repeat check the next day can re-fire legitimately; ever types are all-time.
 *  This is the conflict target for the notifications upsert, which makes
 *  duplicate creation impossible even when the cron and the in-app bell check
 *  run concurrently for the same user. */
export function notificationDedupeKey(type: string, dedupeId: string, dayStr: string): string {
  return DAILY_NOTIFICATION_TYPES.has(type)
    ? `${type}|${dedupeId}|${dayStr}`
    : `${type}|${dedupeId}`
}
