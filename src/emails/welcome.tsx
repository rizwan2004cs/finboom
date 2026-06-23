import { Button, Section, Text } from "@react-email/components"
import { EmailLayout } from "./components/email-layout"
import { absoluteUrl, brand, getEmailTheme } from "./theme"

interface WelcomeEmailProps {
  firstName?: string | null
}

const FEATURES = [
  { emoji: "📊", title: "See your true net worth", body: "Track assets and liabilities in one place — updated the moment you change a number." },
  { emoji: "🎯", title: "Set goals that stick", body: "Create savings goals and watch your progress with milestone nudges." },
  { emoji: "🔁", title: "Never miss a SIP or bill", body: "Add SIPs and dues once; we’ll remind you by push and email before they hit." },
  { emoji: "📴", title: "Works offline", body: "Add and edit anywhere — FinBoom syncs automatically when you’re back online." },
]

/** First email a new user gets, right after sign-up (transactional, warm). */
export function WelcomeEmail({ firstName }: WelcomeEmailProps) {
  const theme = getEmailTheme("welcome")
  return (
    <EmailLayout theme={theme} preview="Welcome to FinBoom — let’s build your wealth picture.">
      <Text style={heading} className="fb-ink">
        {firstName ? `Welcome, ${firstName} 👋` : "Welcome to FinBoom 👋"}
      </Text>
      <Text style={subheading} className="fb-sub">
        You just took the first step toward knowing your true wealth. Here’s what you can do in the next
        five minutes:
      </Text>

      {FEATURES.map((f, idx) => (
        <Section key={idx} style={featureRow} className="fb-item">
          <table cellPadding={0} cellSpacing={0} role="presentation" style={{ width: "100%" }}>
            <tbody>
              <tr>
                <td style={{ verticalAlign: "top", width: 30, paddingRight: 12, fontSize: 20 }}>{f.emoji}</td>
                <td style={{ verticalAlign: "top" }}>
                  <Text style={featureTitle} className="fb-ink">{f.title}</Text>
                  <Text style={featureBody} className="fb-sub">{f.body}</Text>
                </td>
              </tr>
            </tbody>
          </table>
        </Section>
      ))}

      <Section style={{ marginTop: 26 }}>
        <Button href={absoluteUrl("/dashboard")} style={{ ...cta, backgroundColor: theme.accent }}>
          Set up your dashboard →
        </Button>
      </Section>

      <Text style={tip} className="fb-muted">
        Tip: add one asset and one goal today — that’s all it takes to see FinBoom come alive.
      </Text>
    </EmailLayout>
  )
}

export default WelcomeEmail

// Sample data for the `react-email` preview server (npm run email:dev).
WelcomeEmail.PreviewProps = { firstName: "Rizwan" } satisfies WelcomeEmailProps

const heading: React.CSSProperties = {
  fontSize: 22,
  fontWeight: 800,
  color: brand.ink,
  margin: "18px 0 6px",
  letterSpacing: "-0.02em",
}
const subheading: React.CSSProperties = {
  fontSize: 14.5,
  lineHeight: "22px",
  color: brand.subtext,
  margin: "0 0 20px",
}
const featureRow: React.CSSProperties = {
  backgroundColor: "#ffffff",
  border: "1px solid rgba(20, 22, 34, 0.08)",
  borderRadius: 14,
  padding: "14px 16px",
  marginBottom: 10,
}
const featureTitle: React.CSSProperties = {
  fontSize: 15,
  fontWeight: 700,
  color: brand.ink,
  margin: "0 0 3px",
  letterSpacing: "-0.01em",
}
const featureBody: React.CSSProperties = { fontSize: 13.5, lineHeight: "20px", color: brand.subtext, margin: 0 }
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
const tip: React.CSSProperties = { fontSize: 13, lineHeight: "20px", color: brand.muted, margin: "24px 0 0" }
