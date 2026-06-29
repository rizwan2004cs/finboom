import { describe, it, expect } from "vitest"
import {
  sanitizePhone,
  isValidPhone,
  isValidISODate,
  isFutureISODate,
  todayLocalISO,
  formatDueDate,
  PHONE_MAX_LENGTH,
  notificationDedupeKey,
  DAILY_NOTIFICATION_TYPES,
} from "./utils"

describe("sanitizePhone", () => {
  it("strips non-digits", () => {
    expect(sanitizePhone("+91 98765-43210")).toBe("919876543210")
    expect(sanitizePhone("abc123def456")).toBe("123456")
  })

  it("caps to the E.164 max length", () => {
    const tooLong = "9".repeat(PHONE_MAX_LENGTH + 5)
    expect(sanitizePhone(tooLong).length).toBe(PHONE_MAX_LENGTH)
  })

  it("handles empty / nullish input", () => {
    expect(sanitizePhone("")).toBe("")
    expect(sanitizePhone(undefined as unknown as string)).toBe("")
  })
})

describe("isValidPhone", () => {
  it("accepts 6–15 digits", () => {
    expect(isValidPhone("9876543210")).toBe(true)
    expect(isValidPhone("+91 98765-43210")).toBe(true)
    expect(isValidPhone("123456")).toBe(true)
  })

  it("rejects too-short numbers (the fat-finger / 'longer number' problem)", () => {
    expect(isValidPhone("12345")).toBe(false)
    expect(isValidPhone("abc")).toBe(false)
  })

  it("treats empty as not-provided (optional field)", () => {
    expect(isValidPhone("")).toBe(true)
  })
})

describe("isValidISODate", () => {
  it("accepts real calendar dates", () => {
    expect(isValidISODate("2026-02-28")).toBe(true)
    expect(isValidISODate("2026-06-27")).toBe(true)
  })

  it("rejects impossible dates (no overflow)", () => {
    expect(isValidISODate("2026-02-30")).toBe(false)
    expect(isValidISODate("2026-13-01")).toBe(false)
    expect(isValidISODate("2026-00-10")).toBe(false)
  })

  it("rejects malformed strings", () => {
    expect(isValidISODate("26-06-2026")).toBe(false)
    expect(isValidISODate("2026/06/27")).toBe(false)
    expect(isValidISODate("")).toBe(false)
  })
})

describe("isFutureISODate", () => {
  it("flags tomorrow", () => {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    expect(isFutureISODate(todayLocalISO(tomorrow))).toBe(true)
  })

  it("does not flag today or the past", () => {
    expect(isFutureISODate(todayLocalISO())).toBe(false)
    expect(isFutureISODate("2000-01-01")).toBe(false)
  })
})

describe("formatDueDate", () => {
  it("always includes the year", () => {
    expect(formatDueDate("2026-07-15")).toBe("15 Jul 2026")
    // Cross-year due dates must be unambiguous — the original bug hid the year.
    expect(formatDueDate("2027-01-02")).toBe("2 Jan 2027")
  })

  it("returns the raw input for invalid dates", () => {
    expect(formatDueDate("not-a-date")).toBe("not-a-date")
    expect(formatDueDate("")).toBe("")
    expect(formatDueDate(null)).toBe("")
  })
})

describe("notificationDedupeKey", () => {
  it("scopes daily types to the day so the same alert can re-fire tomorrow", () => {
    expect(notificationDedupeKey("overdue_payment", "party_abc", "2026-06-28")).toBe(
      "overdue_payment|party_abc|2026-06-28",
    )
    expect(notificationDedupeKey("overdue_payment", "party_abc", "2026-06-29")).toBe(
      "overdue_payment|party_abc|2026-06-29",
    )
    expect(notificationDedupeKey("sip_reminder", "sip_1", "2026-06-28")).toBe("sip_reminder|sip_1|2026-06-28")
  })

  it("makes ever types all-time unique regardless of day", () => {
    expect(notificationDedupeKey("goal_milestone", "goal_xyz:100", "2026-06-28")).toBe(
      "goal_milestone|goal_xyz:100",
    )
    expect(notificationDedupeKey("goal_milestone", "goal_xyz:100", "2027-01-01")).toBe(
      "goal_milestone|goal_xyz:100",
    )
    expect(notificationDedupeKey("large_transaction", "tx_9", "2026-06-28")).toBe("large_transaction|tx_9")
    expect(notificationDedupeKey("budget_exceeded", "b_3:2026-06", "2026-06-28")).toBe(
      "budget_exceeded|b_3:2026-06",
    )
  })

  it("treats overdue / due-approaching for the same party as distinct keys", () => {
    const a = notificationDedupeKey("overdue_payment", "party_abc", "2026-06-28")
    const b = notificationDedupeKey("due_approaching", "party_abc", "2026-06-28")
    expect(a).not.toBe(b)
  })

  it("classifies the daily set correctly", () => {
    expect(DAILY_NOTIFICATION_TYPES.has("sip_reminder")).toBe(true)
    expect(DAILY_NOTIFICATION_TYPES.has("overdue_payment")).toBe(true)
    expect(DAILY_NOTIFICATION_TYPES.has("due_approaching")).toBe(true)
    expect(DAILY_NOTIFICATION_TYPES.has("goal_milestone")).toBe(false)
    expect(DAILY_NOTIFICATION_TYPES.has("budget_exceeded")).toBe(false)
  })
})
