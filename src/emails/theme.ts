/**
 * Shared brand + per-message-type theming for transactional emails.
 *
 * Every email uses the FinBoom brand shell (wordmark, ink text, light surface);
 * each message *kind* gets its own accent colour + badge so a SIP reminder, an
 * overdue-payment alert and a new blog post are visually distinct while still
 * clearly coming from the same app. Mirrors the in-app notification types in
 * `src/lib/notifications/generate.ts`.
 */

export const APP_NAME = "FinBoom"
export const APP_TAGLINE = "Know your true wealth"

export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || "https://finboom-cyan.vercel.app"

/** Core brand palette (kept in sync with globals.css). */
export const brand = {
  green: "#34c759",
  greenDark: "#1a8a38",
  ink: "#1d1d1f",
  subtext: "#6e6e73",
  muted: "#86868b",
  surface: "#f5f5f7",
  card: "#ffffff",
  border: "#e6e6eb",
} as const

export interface EmailTheme {
  /** Strong accent colour for the rail, badge text and primary button. */
  accent: string
  /** Soft tint used as the badge background. */
  soft: string
  /** Short label shown in the badge. */
  label: string
  /** Emoji cue for quick scanning in the inbox/body. */
  emoji: string
}

/** Notification `type` (and the synthetic "blog") → theme. */
const THEMES: Record<string, EmailTheme> = {
  sip_reminder: { accent: "#34c759", soft: "#e7f9ec", label: "SIP Reminder", emoji: "🔁" },
  overdue_payment: { accent: "#ff3b30", soft: "#ffece9", label: "Overdue", emoji: "⚠️" },
  due_approaching: { accent: "#ff9500", soft: "#fff3e0", label: "Payment Due", emoji: "⏰" },
  goal_milestone: { accent: "#0a84ff", soft: "#e8f2ff", label: "Goal", emoji: "🎯" },
  large_transaction: { accent: "#5e5ce6", soft: "#ececfb", label: "Large Activity", emoji: "💳" },
  budget_exceeded: { accent: "#ff3b30", soft: "#ffece9", label: "Budget Alert", emoji: "💸" },
  blog: { accent: "#0a84ff", soft: "#e8f2ff", label: "New Article", emoji: "📰" },
  weekly_report: { accent: "#34c759", soft: "#e7f9ec", label: "Weekly Report", emoji: "📈" },
  monthly_report: { accent: "#0a84ff", soft: "#e8f2ff", label: "Monthly Report", emoji: "📊" },
  welcome: { accent: "#34c759", soft: "#e7f9ec", label: "Welcome", emoji: "👋" },
  default: { accent: "#34c759", soft: "#e7f9ec", label: "Update", emoji: "🔔" },
}

export function getEmailTheme(type: string): EmailTheme {
  return THEMES[type] ?? THEMES.default
}

/** Absolute URL helper so CTAs always point at the deployed app. */
export function absoluteUrl(path: string): string {
  if (path.startsWith("http")) return path
  return `${SITE_URL}${path.startsWith("/") ? "" : "/"}${path}`
}

/**
 * One-click unsubscribe URL for a given channel. Falls back to the settings page
 * when no token is available (e.g. before the preferences table is migrated).
 */
export function unsubscribeUrl(token: string | null, channel: string): string {
  if (!token) return absoluteUrl("/dashboard/settings")
  return absoluteUrl(`/api/email/unsubscribe?token=${encodeURIComponent(token)}&c=${channel}`)
}
