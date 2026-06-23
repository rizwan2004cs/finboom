import { Button, Section, Text } from "@react-email/components"
import { EmailLayout } from "./components/email-layout"
import { absoluteUrl, brand, getEmailTheme } from "./theme"

interface BlogPostEmailProps {
  title: string
  excerpt: string
  url: string
  /** One-click unsubscribe URL for the blog channel. */
  unsubscribeUrl?: string
}

/** Branded announcement for a newly published blog post (blue "article" theme). */
export function BlogPostEmail({ title, excerpt, url, unsubscribeUrl }: BlogPostEmailProps) {
  const theme = getEmailTheme("blog")
  return (
    <EmailLayout theme={theme} preview={`New on FinBoom: ${title}`} unsubscribeUrl={unsubscribeUrl}>
      <Text style={kicker} className="fb-muted">Fresh from the FinBoom blog</Text>
      <Text style={titleStyle} className="fb-ink">{title}</Text>
      {excerpt ? <Text style={excerptStyle} className="fb-sub">{excerpt}</Text> : null}

      <Section style={{ marginTop: 24 }}>
        <Button href={absoluteUrl(url)} style={{ ...cta, backgroundColor: theme.accent }}>
          Read the article →
        </Button>
      </Section>

      <Text style={tip} className="fb-muted">
        Practical, India-first money guides — published regularly to help you grow your net worth.
      </Text>
    </EmailLayout>
  )
}

export default BlogPostEmail

// Sample data for the `react-email` preview server (npm run email:dev).
BlogPostEmail.PreviewProps = {
  title: "The 50/30/20 rule, adapted for Indian salaries",
  excerpt:
    "A practical framework for splitting your take-home pay into needs, wants and wealth — with rupee examples and a simple way to automate it.",
  url: "/blog/50-30-20-rule-india",
  unsubscribeUrl: "https://finboom-cyan.vercel.app/dashboard/settings",
} satisfies BlogPostEmailProps

const kicker: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  color: brand.muted,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  margin: "18px 0 6px",
}
const titleStyle: React.CSSProperties = {
  fontSize: 24,
  fontWeight: 700,
  lineHeight: "30px",
  color: brand.ink,
  margin: "0 0 12px",
  letterSpacing: "-0.02em",
}
const excerptStyle: React.CSSProperties = {
  fontSize: 15,
  lineHeight: "23px",
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
const tip: React.CSSProperties = {
  fontSize: 13,
  lineHeight: "20px",
  color: brand.muted,
  margin: "24px 0 0",
}
