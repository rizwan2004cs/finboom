/**
 * Send sample branded emails to verify the email setup + templates. Uses the
 * app's real transport (Gmail SMTP if configured, otherwise Resend).
 *
 *   tsx scripts/test-email.ts                 # sends to GMAIL_USER (yourself)
 *   tsx scripts/test-email.ts you@example.com # sends to a specific address
 */
import process from "node:process"

try {
  process.loadEnvFile(".env.local")
} catch {
  // Rely on the shell environment if .env.local is absent.
}

import { sendBrandedEmail, sendWelcomeEmail } from "@/lib/email/send"
import { NotificationDigestEmail } from "@/emails/notification-digest"
import { BlogPostEmail } from "@/emails/blog-post"
import { WeeklyReportEmail } from "@/emails/weekly-report"

async function main() {
  const to = process.argv[2] || process.env.GMAIL_USER
  if (!to) throw new Error("Pass a recipient: tsx scripts/test-email.ts you@example.com")

  const digest = await sendBrandedEmail(
    to,
    "Your FinBoom reminders (sample)",
    NotificationDigestEmail({
      firstName: "Rizwan",
      items: [
        { type: "sip_reminder", title: "SIP due today: Nifty 50 Index Fund", body: "₹10,000 is due today", url: "/dashboard/sips" },
        { type: "overdue_payment", title: "Overdue: Imran", body: "Imran owes you ₹5,000 — was due 2026-06-20", url: "/dashboard/parties" },
        { type: "goal_milestone", title: "Halfway: Emergency Fund", body: 'You\'re 50% of the way to "Emergency Fund" — ₹1,50,000 of ₹3,00,000', url: "/dashboard/goals" },
      ],
    }),
  )
  console.log(`Reminder digest → ${to}:`, digest)

  const blog = await sendBrandedEmail(
    to,
    "New on FinBoom: How to build your emergency fund",
    BlogPostEmail({
      title: "How to build your emergency fund in 2026",
      excerpt: "A simple, India-first framework for sizing and parking your safety net — without locking up returns.",
      url: "/blog/emergency-fund",
    }),
  )
  console.log(`Blog announcement → ${to}:`, blog)

  const weekly = await sendBrandedEmail(
    to,
    "Your weekly net worth: ₹24,80,000 (sample)",
    WeeklyReportEmail({
      firstName: "Rizwan",
      period: "week",
      netWorthLabel: "₹24,80,000",
      assetsLabel: "₹31,20,000",
      liabilitiesLabel: "₹6,40,000",
      change: { direction: "up", amountLabel: "₹62,000", pctLabel: "+2.6%" },
      topMovers: [
        { label: "Nifty 50 Index Fund", valueLabel: "₹8,40,000" },
        { label: "Apartment (Pune)", valueLabel: "₹18,00,000" },
        { label: "Emergency Fund (FD)", valueLabel: "₹4,00,000" },
      ],
    }),
  )
  console.log(`Weekly report → ${to}:`, weekly)

  const welcome = await sendWelcomeEmail(to, "Rizwan")
  console.log(`Welcome email → ${to}:`, welcome)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
