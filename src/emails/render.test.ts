import { describe, it, expect } from "vitest"
import { render } from "@react-email/render"
import { NotificationDigestEmail } from "./notification-digest"
import { BlogPostEmail } from "./blog-post"
import { WeeklyReportEmail } from "./weekly-report"
import { WelcomeEmail } from "./welcome"

// Guards templates from silently breaking — renders each to HTML and asserts the
// brand shell + the key content/CTA survive.

describe("email templates render to HTML", () => {
  it("renders the notification digest with brand + unsubscribe", async () => {
    const html = await render(
      NotificationDigestEmail({
        firstName: "Test",
        items: [{ type: "sip_reminder", title: "SIP due today", body: "₹5,000 is due today", url: "/dashboard" }],
        unsubscribeUrl: "https://finboom-cyan.vercel.app/api/email/unsubscribe?token=abc&c=reminders",
      }),
    )
    expect(html).toContain("FinBoom")
    expect(html).toContain("SIP due today")
    expect(html).toContain("Unsubscribe")
  })

  it("renders the blog announcement", async () => {
    const html = await render(
      BlogPostEmail({ title: "Hello World Post", excerpt: "An excerpt", url: "/blog/x", unsubscribeUrl: "https://x/u" }),
    )
    expect(html).toContain("Hello World Post")
    expect(html).toContain("Read the article")
  })

  it("renders the weekly net-worth report", async () => {
    const html = await render(
      WeeklyReportEmail({
        period: "week",
        netWorthLabel: "₹10,00,000",
        assetsLabel: "₹12,00,000",
        liabilitiesLabel: "₹2,00,000",
        change: { direction: "up", amountLabel: "₹50,000", pctLabel: "+5.0%" },
      }),
    )
    expect(html).toContain("₹10,00,000")
    expect(html).toContain("net worth")
  })

  it("renders the welcome email", async () => {
    const html = await render(WelcomeEmail({ firstName: "Test" }))
    expect(html).toContain("Welcome")
    expect(html).toContain("Set up your dashboard")
  })
})
