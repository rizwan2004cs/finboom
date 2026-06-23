import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components"
import { APP_NAME, APP_TAGLINE, absoluteUrl, brand, type EmailTheme } from "../theme"

interface EmailLayoutProps {
  theme: EmailTheme
  preview: string
  /** Overrides the badge text (e.g. "Your reminders" for a mixed digest). */
  badgeLabel?: string
  /** One-click unsubscribe URL for this email's channel (adds a footer link). */
  unsubscribeUrl?: string
  children: React.ReactNode
}

// Dark-mode overrides for clients that honour prefers-color-scheme (Apple Mail,
// some others). Inline styles win otherwise, so we target hook classNames.
const DARK_CSS = `
  :root { color-scheme: light dark; supported-color-schemes: light dark; }
  @media (prefers-color-scheme: dark) {
    .fb-body { background-color: #000000 !important; }
    .fb-card { background-color: #1c1c1e !important; border-color: rgba(255,255,255,0.10) !important; }
    .fb-rule { border-color: rgba(255,255,255,0.10) !important; }
    .fb-ink { color: #f5f5f7 !important; }
    .fb-sub { color: #aeaeb2 !important; }
    .fb-muted { color: #8e8e93 !important; }
    .fb-item { background-color: #2c2c2e !important; border-color: rgba(255,255,255,0.10) !important; }
    .fb-icon { border-color: rgba(255,255,255,0.12) !important; }
  }
`

/**
 * Premium branded shell shared by every transactional email: the real FinBoom
 * app icon (embedded inline via cid so it renders in Gmail/Apple Mail), the
 * wordmark + tagline, a type-coloured accent rail and badge, then the message
 * body and a refined footer with one-click unsubscribe. All styles are inline +
 * table-based to survive Gmail/Outlook; nothing depends on the image loading.
 */
export function EmailLayout({ theme, preview, badgeLabel, unsubscribeUrl, children }: EmailLayoutProps) {
  return (
    <Html>
      <Head>
        <style dangerouslySetInnerHTML={{ __html: DARK_CSS }} />
      </Head>
      <Preview>{preview}</Preview>
      <Body style={body} className="fb-body">
        <Container style={shell}>
          <Container style={card} className="fb-card">
            {/* Accent rail keyed to the message type */}
            <div style={{ height: 4, backgroundColor: theme.accent }} />

            {/* Brand header: app icon + wordmark + tagline */}
            <Section style={headerSection}>
              <table cellPadding={0} cellSpacing={0} role="presentation" style={{ width: "100%" }}>
                <tbody>
                  <tr>
                    <td style={{ verticalAlign: "middle", width: 54, paddingRight: 14 }}>
                      <Img src="cid:finboom-logo" width="54" height="54" alt={APP_NAME} style={iconImg} className="fb-icon" />
                    </td>
                    <td style={{ verticalAlign: "middle" }}>
                      <div style={brandWord} className="fb-ink">{APP_NAME}</div>
                      <div style={brandTagline} className="fb-muted">{APP_TAGLINE}</div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </Section>

            <Hr style={headerRule} className="fb-rule" />

            <Section style={contentSection}>
              <span style={{ ...badge, backgroundColor: theme.soft, color: theme.accent }}>
                {theme.emoji} {badgeLabel ?? theme.label}
              </span>
              {children}
            </Section>

            <Hr style={footerRule} className="fb-rule" />

            <Section style={footerSection}>
              <table cellPadding={0} cellSpacing={0} role="presentation">
                <tbody>
                  <tr>
                    <td style={{ verticalAlign: "middle", width: 22, paddingRight: 8 }}>
                      <Img src="cid:finboom-logo" width="20" height="20" alt="" style={footerIcon} className="fb-icon" />
                    </td>
                    <td style={{ verticalAlign: "middle" }}>
                      <span style={footerBrand} className="fb-ink">{APP_NAME}</span>
                    </td>
                  </tr>
                </tbody>
              </table>
              <Text style={footerText} className="fb-sub">{APP_TAGLINE} — your offline-first money companion.</Text>
              <Text style={footerLinks}>
                <Link href={absoluteUrl("/dashboard")} style={footerLink}>Open dashboard</Link>
                <span style={footerDot} className="fb-muted">·</span>
                <Link href={absoluteUrl("/dashboard/settings")} style={footerLink}>Manage notifications</Link>
                {unsubscribeUrl ? (
                  <>
                    <span style={footerDot} className="fb-muted">·</span>
                    <Link href={unsubscribeUrl} style={footerLink}>Unsubscribe</Link>
                  </>
                ) : null}
              </Text>
              <Text style={footerMuted} className="fb-muted">
                © {new Date().getFullYear()} {APP_NAME}. Sent because reminders are on for your account.
              </Text>
            </Section>
          </Container>
        </Container>
      </Body>
    </Html>
  )
}

const body: React.CSSProperties = {
  backgroundColor: "#eef0f3",
  margin: 0,
  padding: "32px 0",
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
}

const shell: React.CSSProperties = { width: "100%", maxWidth: 600, margin: "0 auto", padding: "0 12px" }

const card: React.CSSProperties = {
  backgroundColor: brand.card,
  width: "100%",
  borderRadius: 20,
  border: "1px solid rgba(20, 22, 34, 0.07)",
  boxShadow: "0 10px 30px rgba(15, 18, 30, 0.08)",
  overflow: "hidden",
}

const headerSection: React.CSSProperties = { padding: "26px 32px 18px" }

const iconImg: React.CSSProperties = {
  display: "block",
  width: "54px",
  height: "54px",
  maxWidth: "54px",
  borderRadius: 13,
  border: "1px solid rgba(0, 0, 0, 0.06)",
}

const brandWord: React.CSSProperties = {
  fontSize: 19,
  fontWeight: 700,
  letterSpacing: "-0.02em",
  color: brand.ink,
  lineHeight: "22px",
}

const brandTagline: React.CSSProperties = {
  fontSize: 12.5,
  color: brand.muted,
  marginTop: 3,
  letterSpacing: "0.01em",
}

const headerRule: React.CSSProperties = { borderColor: "rgba(20, 22, 34, 0.06)", margin: 0 }

const contentSection: React.CSSProperties = { padding: "24px 32px 28px" }

const badge: React.CSSProperties = {
  display: "inline-block",
  marginBottom: 18,
  padding: "5px 13px",
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 600,
  letterSpacing: "0.01em",
}

const footerRule: React.CSSProperties = { borderColor: "rgba(20, 22, 34, 0.06)", margin: 0 }

const footerSection: React.CSSProperties = { padding: "20px 32px 26px" }

const footerIcon: React.CSSProperties = { display: "block", width: "20px", height: "20px", maxWidth: "20px", borderRadius: 5, opacity: 0.9 }
const footerBrand: React.CSSProperties = { fontSize: 13, fontWeight: 700, color: brand.ink, letterSpacing: "-0.01em" }

const footerText: React.CSSProperties = {
  fontSize: 13,
  lineHeight: "20px",
  color: brand.subtext,
  margin: "12px 0 10px",
}

const footerLinks: React.CSSProperties = { fontSize: 13, margin: "0 0 12px" }
const footerLink: React.CSSProperties = { color: brand.green, textDecoration: "none", fontWeight: 600 }
const footerDot: React.CSSProperties = { color: brand.muted, padding: "0 8px" }
const footerMuted: React.CSSProperties = { fontSize: 11, lineHeight: "16px", color: brand.muted, margin: 0 }
