import { Button, Section, Text } from "@react-email/components"
import { EmailLayout } from "./components/email-layout"
import { absoluteUrl, brand, getEmailTheme } from "./theme"

export interface DigestItem {
  type: string
  title: string
  body: string
  url: string
}

interface NotificationDigestEmailProps {
  firstName?: string | null
  items: DigestItem[]
  /** One-click unsubscribe URL for the reminders channel. */
  unsubscribeUrl?: string
}

// Most urgent first — drives the shell accent rail colour.
const PRIORITY = [
  "overdue_payment",
  "due_approaching",
  "budget_exceeded",
  "sip_reminder",
  "goal_milestone",
  "large_transaction",
]

function topType(items: DigestItem[]): string {
  for (const t of PRIORITY) {
    if (items.some((i) => i.type === t)) return t
  }
  return items[0]?.type ?? "default"
}

/**
 * One branded email summarising a user's new reminders. Each item is a card
 * themed by its own message type, so a SIP reminder and an overdue payment are
 * visually distinct inside the shared FinBoom shell.
 */
export function NotificationDigestEmail({ firstName, items, unsubscribeUrl }: NotificationDigestEmailProps) {
  const shellTheme = getEmailTheme(topType(items))
  const count = items.length
  const preview =
    count === 1 ? items[0].title : `${count} updates from FinBoom that need your attention`

  return (
    <EmailLayout theme={shellTheme} preview={preview} badgeLabel={count > 1 ? "Your reminders" : undefined} unsubscribeUrl={unsubscribeUrl}>
      <Text style={heading} className="fb-ink">
        {firstName ? `Hi ${firstName},` : "Hi there,"}
      </Text>
      <Text style={subheading} className="fb-sub">
        {count === 1
          ? "Here’s an update that needs your attention:"
          : `You have ${count} updates that need your attention:`}
      </Text>

      {items.map((item, idx) => {
        const t = getEmailTheme(item.type)
        return (
          <Section
            key={`${item.type}-${idx}`}
            style={{ ...itemCard, borderLeft: `3px solid ${t.accent}` }}
            className="fb-item"
          >
            <span style={{ ...itemBadge, backgroundColor: t.soft, color: t.accent }}>
              {t.emoji} {t.label}
            </span>
            <Text style={itemTitle} className="fb-ink">{item.title}</Text>
            <Text style={itemBody} className="fb-sub">{item.body}</Text>
          </Section>
        )
      })}

      <Section style={{ marginTop: 26 }}>
        <Button href={absoluteUrl("/dashboard")} style={{ ...cta, backgroundColor: shellTheme.accent }}>
          Open FinBoom →
        </Button>
      </Section>
    </EmailLayout>
  )
}

export default NotificationDigestEmail

// Sample data for the `react-email` preview server (npm run email:dev).
NotificationDigestEmail.PreviewProps = {
  firstName: "Rizwan",
  unsubscribeUrl: "https://finboom-cyan.vercel.app/dashboard/settings",
  items: [
    {
      type: "overdue_payment",
      title: "Credit card payment overdue",
      body: "Your HDFC card payment of ₹12,400 was due 2 days ago.",
      url: "/dashboard",
    },
    {
      type: "sip_reminder",
      title: "SIP debit tomorrow",
      body: "Your ₹5,000 Nifty 50 Index SIP debits on the 15th.",
      url: "/dashboard",
    },
    {
      type: "goal_milestone",
      title: "Emergency fund — 75% there",
      body: "₹3.0L of your ₹4.0L goal. Almost there!",
      url: "/dashboard",
    },
  ],
} satisfies NotificationDigestEmailProps

const heading: React.CSSProperties = {
  fontSize: 20,
  fontWeight: 700,
  color: brand.ink,
  margin: "18px 0 2px",
  letterSpacing: "-0.02em",
}
const subheading: React.CSSProperties = {
  fontSize: 14,
  lineHeight: "21px",
  color: brand.subtext,
  margin: "0 0 18px",
}
const itemCard: React.CSSProperties = {
  backgroundColor: "#ffffff",
  border: "1px solid rgba(20, 22, 34, 0.08)",
  borderRadius: 14,
  padding: "15px 17px",
  marginBottom: 12,
  boxShadow: "0 1px 2px rgba(15, 18, 30, 0.04)",
}
const itemBadge: React.CSSProperties = {
  display: "inline-block",
  padding: "3px 10px",
  borderRadius: 999,
  fontSize: 11,
  fontWeight: 600,
}
const itemTitle: React.CSSProperties = {
  fontSize: 15.5,
  fontWeight: 600,
  color: brand.ink,
  margin: "10px 0 3px",
  letterSpacing: "-0.01em",
}
const itemBody: React.CSSProperties = {
  fontSize: 14,
  lineHeight: "20px",
  color: brand.subtext,
  margin: 0,
}
const cta: React.CSSProperties = {
  display: "inline-block",
  color: "#ffffff",
  fontSize: 14.5,
  fontWeight: 600,
  padding: "13px 30px",
  borderRadius: 12,
  textDecoration: "none",
  letterSpacing: "0.01em",
}
