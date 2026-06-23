import { Button, Section, Text } from "@react-email/components"
import { EmailLayout } from "./components/email-layout"
import { absoluteUrl, brand, getEmailTheme } from "./theme"

export interface NetWorthChange {
  direction: "up" | "down" | "flat"
  amountLabel: string
  pctLabel: string
}

export interface WeeklyReportData {
  firstName?: string | null
  /** Drives the headline copy + theme ("week" → weekly, "month" → monthly). */
  period: "week" | "month"
  netWorthLabel: string
  assetsLabel: string
  liabilitiesLabel: string
  change: NetWorthChange | null
  /** Optional top holdings to show a quick breakdown. */
  topMovers?: { label: string; valueLabel: string }[]
  unsubscribeUrl?: string
}

const CHANGE_COLORS = {
  up: { bg: "#e7f9ec", fg: "#1a8a38", arrow: "↑" },
  down: { bg: "#ffece9", fg: "#d70015", arrow: "↓" },
  flat: { bg: "#f0f0f3", fg: "#6e6e73", arrow: "→" },
} as const

/**
 * Periodic net-worth report. The same template powers the weekly digest and the
 * monthly report — only the `period` (copy + accent) differs.
 */
export function WeeklyReportEmail({
  firstName,
  period,
  netWorthLabel,
  assetsLabel,
  liabilitiesLabel,
  change,
  topMovers,
  unsubscribeUrl,
}: WeeklyReportData) {
  const theme = getEmailTheme(period === "month" ? "monthly_report" : "weekly_report")
  const periodWord = period === "month" ? "month" : "week"
  const c = change ? CHANGE_COLORS[change.direction] : null

  return (
    <EmailLayout
      theme={theme}
      preview={`Your net worth is ${netWorthLabel}`}
      unsubscribeUrl={unsubscribeUrl}
    >
      <Text style={heading} className="fb-ink">{firstName ? `Hi ${firstName},` : "Hi there,"}</Text>
      <Text style={subheading} className="fb-sub">
        Here’s your {periodWord}ly net-worth summary.
      </Text>

      <Section style={{ ...heroCard, borderTop: `3px solid ${theme.accent}` }} className="fb-item">
        <Text style={heroLabel} className="fb-muted">Total net worth</Text>
        <Text style={heroValue} className="fb-ink">{netWorthLabel}</Text>
        {c && change ? (
          <span style={{ ...changePill, backgroundColor: c.bg, color: c.fg }}>
            {c.arrow} {change.amountLabel} ({change.pctLabel}) this {periodWord}
          </span>
        ) : (
          <span style={{ ...changePill, backgroundColor: CHANGE_COLORS.flat.bg, color: CHANGE_COLORS.flat.fg }}>
            Your first snapshot — we’ll track changes from here.
          </span>
        )}
      </Section>

      <table cellPadding={0} cellSpacing={0} role="presentation" style={{ width: "100%", marginTop: 14 }}>
        <tbody>
          <tr>
            <td style={{ width: "50%", paddingRight: 6 }}>
              <Section style={splitCard} className="fb-item">
                <Text style={splitLabel} className="fb-muted">Assets</Text>
                <Text style={splitValueUp} className="fb-ink">{assetsLabel}</Text>
              </Section>
            </td>
            <td style={{ width: "50%", paddingLeft: 6 }}>
              <Section style={splitCard} className="fb-item">
                <Text style={splitLabel} className="fb-muted">Liabilities</Text>
                <Text style={splitValueDown} className="fb-ink">{liabilitiesLabel}</Text>
              </Section>
            </td>
          </tr>
        </tbody>
      </table>

      {topMovers && topMovers.length > 0 ? (
        <Section style={{ marginTop: 18 }}>
          <Text style={breakdownTitle} className="fb-ink">Top holdings</Text>
          {topMovers.map((m, idx) => (
            <table key={idx} cellPadding={0} cellSpacing={0} role="presentation" style={{ width: "100%" }}>
              <tbody>
                <tr>
                  <td style={{ padding: "6px 0" }}>
                    <Text style={moverLabel} className="fb-sub">{m.label}</Text>
                  </td>
                  <td style={{ padding: "6px 0", textAlign: "right" }}>
                    <Text style={moverValue} className="fb-ink">{m.valueLabel}</Text>
                  </td>
                </tr>
              </tbody>
            </table>
          ))}
        </Section>
      ) : null}

      <Section style={{ marginTop: 26 }}>
        <Button href={absoluteUrl("/dashboard")} style={{ ...cta, backgroundColor: theme.accent }}>
          View full breakdown →
        </Button>
      </Section>
    </EmailLayout>
  )
}

export default WeeklyReportEmail

// Sample data for the `react-email` preview server (npm run email:dev).
WeeklyReportEmail.PreviewProps = {
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
  unsubscribeUrl: "https://finboom-cyan.vercel.app/dashboard/settings",
} satisfies WeeklyReportData

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
const heroCard: React.CSSProperties = {
  backgroundColor: "#ffffff",
  border: "1px solid rgba(20, 22, 34, 0.08)",
  borderRadius: 16,
  padding: "20px 22px",
  textAlign: "center",
  boxShadow: "0 1px 2px rgba(15, 18, 30, 0.04)",
}
const heroLabel: React.CSSProperties = {
  fontSize: 12.5,
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  color: brand.muted,
  margin: 0,
}
const heroValue: React.CSSProperties = {
  fontSize: 34,
  fontWeight: 800,
  color: brand.ink,
  letterSpacing: "-0.03em",
  margin: "6px 0 12px",
}
const changePill: React.CSSProperties = {
  display: "inline-block",
  padding: "6px 14px",
  borderRadius: 999,
  fontSize: 13,
  fontWeight: 600,
}
const splitCard: React.CSSProperties = {
  backgroundColor: "#ffffff",
  border: "1px solid rgba(20, 22, 34, 0.08)",
  borderRadius: 14,
  padding: "14px 16px",
}
const splitLabel: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.03em",
  color: brand.muted,
  margin: 0,
}
const splitValueUp: React.CSSProperties = { fontSize: 18, fontWeight: 700, color: brand.ink, margin: "6px 0 0", letterSpacing: "-0.02em" }
const splitValueDown: React.CSSProperties = { fontSize: 18, fontWeight: 700, color: brand.ink, margin: "6px 0 0", letterSpacing: "-0.02em" }
const breakdownTitle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 700,
  color: brand.ink,
  margin: "0 0 4px",
  letterSpacing: "-0.01em",
}
const moverLabel: React.CSSProperties = { fontSize: 14, color: brand.subtext, margin: 0 }
const moverValue: React.CSSProperties = { fontSize: 14, fontWeight: 600, color: brand.ink, margin: 0 }
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
