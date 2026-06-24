/**
 * Transactional email via React Email, sent over Gmail SMTP or Resend.
 *
 * Transport selection (so it works without a custom domain):
 *  - If GMAIL_USER + GMAIL_APP_PASSWORD are set → Gmail SMTP (can email anyone,
 *    ~500/day, "From" shows your Gmail). Preferred, since a *.vercel.app site
 *    has no domain to verify with Resend.
 *  - Else if RESEND_API_KEY is set → Resend (needs a verified domain to reach
 *    arbitrary recipients; great once you own one).
 *  - Else → no-op, returning { sent: false } so cron/blog jobs keep working.
 *
 * Recipient addresses come from Clerk (batched via getUserList), keyed by the
 * same `user_id` used everywhere else. Sends are gated on per-user email
 * preferences and carry RFC 8058 one-click unsubscribe headers.
 */

import type { ReactElement } from "react"
import { Resend } from "resend"
import nodemailer, { type Transporter } from "nodemailer"
import { render } from "@react-email/render"
import { clerkClient } from "@clerk/nextjs/server"
import { APP_NAME, unsubscribeUrl } from "@/emails/theme"
import { LOGO_PNG_BASE64 } from "@/emails/logo-data"
import { NotificationDigestEmail, type DigestItem } from "@/emails/notification-digest"
import { BlogPostEmail } from "@/emails/blog-post"
import { WeeklyReportEmail, type WeeklyReportData } from "@/emails/weekly-report"
import { WelcomeEmail } from "@/emails/welcome"
import { getOrCreateEmailPrefsMap, type EmailChannel } from "@/lib/email/preferences"

// The app icon, embedded inline so the header logo renders in every client.
const LOGO_CID = "finboom-logo"
const LOGO_FILENAME = "finboom-logo.png"

// How many emails to send at once. Keeps us well under Gmail's per-connection
// limits while still finishing a broadcast quickly.
const SEND_CONCURRENCY = 4

const GMAIL_USER = process.env.GMAIL_USER
// Google shows app passwords in 4-char groups; strip spaces so either form works.
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD?.replace(/\s+/g, "")
const RESEND_FROM = process.env.EMAIL_FROM || `${APP_NAME} <onboarding@resend.dev>`

let resendClient: Resend | null = null
function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY
  if (!key) return null
  resendClient ??= new Resend(key)
  return resendClient
}

let gmailTransport: Transporter | null = null
function getGmailTransport(): Transporter | null {
  if (!GMAIL_USER || !GMAIL_APP_PASSWORD) return null
  gmailTransport ??= nodemailer.createTransport({
    service: "gmail",
    auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD },
  })
  return gmailTransport
}

export function emailEnabled(): boolean {
  return (!!GMAIL_USER && !!GMAIL_APP_PASSWORD) || !!process.env.RESEND_API_KEY
}

export interface SendResult {
  sent: boolean
  error?: string
}

export interface SendOptions {
  /** Adds List-Unsubscribe + List-Unsubscribe-Post headers (RFC 8058). */
  unsubscribeUrl?: string
}

/**
 * Render a branded email element to HTML/text and deliver it over the configured
 * transport (Gmail SMTP preferred, then Resend). Exported so the test script can
 * exercise the exact same path the app uses.
 */
export async function sendBrandedEmail(
  to: string,
  subject: string,
  element: ReactElement,
  opts: SendOptions = {},
): Promise<SendResult> {
  if (!emailEnabled()) return { sent: false, error: "No email transport configured" }
  const html = await render(element)
  const text = await render(element, { plainText: true })

  const headers = opts.unsubscribeUrl
    ? {
        "List-Unsubscribe": `<${opts.unsubscribeUrl}>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      }
    : undefined

  return deliverRawEmail(to, subject, html, text, headers)
}

/**
 * Low-level delivery over the configured transport (Gmail SMTP preferred, then
 * Resend). Used by branded user emails and by plain ops alerts alike.
 */
async function deliverRawEmail(
  to: string,
  subject: string,
  html: string,
  text: string,
  headers?: Record<string, string>,
): Promise<SendResult> {
  const gmail = getGmailTransport()
  if (gmail) {
    try {
      await gmail.sendMail({
        from: `${APP_NAME} <${GMAIL_USER}>`,
        to,
        subject,
        html,
        text,
        headers,
        attachments: [
          { filename: LOGO_FILENAME, content: LOGO_PNG_BASE64, encoding: "base64", cid: LOGO_CID },
        ],
      })
      return { sent: true }
    } catch (err) {
      return { sent: false, error: err instanceof Error ? err.message : "Gmail send failed" }
    }
  }

  const resend = getResend()
  if (resend) {
    try {
      const { error } = await resend.emails.send({
        from: RESEND_FROM,
        to,
        subject,
        html,
        text,
        headers,
        attachments: [
          { filename: LOGO_FILENAME, content: Buffer.from(LOGO_PNG_BASE64, "base64"), contentId: LOGO_CID },
        ],
      })
      if (error) return { sent: false, error: error.message }
      return { sent: true }
    } catch (err) {
      return { sent: false, error: err instanceof Error ? err.message : "Email send failed" }
    }
  }

  return { sent: false, error: "No email transport configured" }
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
}

/**
 * Fire-and-forget ops alert to the site owner - NOT a user-facing email, so it
 * skips Clerk lookup and preference gating. Turns silent cron failures (e.g. a
 * blog run where every AI provider was down) into a visible heads-up. Recipient
 * is ALERT_EMAIL, else the Gmail sender, else EMAIL_FROM. No-ops (never throws)
 * when nothing is configured, so it's safe to await inside a cron catch block.
 */
export async function sendOpsAlertEmail(subject: string, body: string): Promise<SendResult> {
  try {
    if (!emailEnabled()) return { sent: false, error: "No email transport configured" }
    const to = process.env.ALERT_EMAIL || GMAIL_USER || process.env.EMAIL_FROM
    if (!to) return { sent: false, error: "No alert recipient configured" }
    const html = `<pre style="font:14px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;white-space:pre-wrap;word-break:break-word">${escapeHtml(body)}</pre>`
    return await deliverRawEmail(to, subject, html, body)
  } catch (err) {
    return { sent: false, error: err instanceof Error ? err.message : "Ops alert failed" }
  }
}

export interface Recipient {
  email: string
  firstName: string | null
}

/**
 * Resolve primary email + first name for many users in one batch (Clerk
 * getUserList, chunked by 100). Returns a map keyed by user_id; misses are
 * simply absent.
 */
export async function getUserEmails(userIds: string[]): Promise<Map<string, Recipient>> {
  const map = new Map<string, Recipient>()
  const ids = [...new Set(userIds.filter(Boolean))]
  if (ids.length === 0) return map
  try {
    const cc = await clerkClient()
    for (let i = 0; i < ids.length; i += 100) {
      const chunk = ids.slice(i, i + 100)
      const res = await cc.users.getUserList({ userId: chunk, limit: Math.min(500, Math.max(chunk.length, 1)) })
      for (const user of res.data) {
        const email =
          user.emailAddresses.find((e) => e.id === user.primaryEmailAddressId)?.emailAddress ??
          user.emailAddresses[0]?.emailAddress
        if (email) map.set(user.id, { email, firstName: user.firstName ?? null })
      }
    }
  } catch {
    // Leave whatever we resolved; callers treat misses as "skip".
  }
  return map
}

/** Single-user convenience wrapper around {@link getUserEmails}. */
export async function getUserEmail(userId: string): Promise<Recipient | null> {
  const map = await getUserEmails([userId])
  return map.get(userId) ?? null
}

/** Run an async task over items with a bounded number in flight. */
async function mapWithConcurrency<T>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<void>,
): Promise<void> {
  const queue = [...items]
  const workers = Array.from({ length: Math.min(limit, queue.length) }, async () => {
    while (queue.length) {
      const item = queue.shift()
      if (item === undefined) break
      await fn(item)
    }
  })
  await Promise.all(workers)
}

/**
 * Shared fan-out: resolve emails + prefs for all entries in two batched calls,
 * then send concurrently, skipping anyone opted out of `channel` or without an
 * address. Returns how many emails were actually sent.
 */
async function broadcast<T extends { userId: string }>(
  entries: T[],
  channel: EmailChannel,
  build: (
    entry: T,
    recipient: Recipient,
    unsubUrl: string,
  ) => { subject: string; element: ReactElement },
): Promise<number> {
  if (!emailEnabled() || entries.length === 0) return 0
  const userIds = entries.map((e) => e.userId)
  const [prefsMap, emailMap] = await Promise.all([
    getOrCreateEmailPrefsMap(userIds),
    getUserEmails(userIds),
  ])

  let sent = 0
  await mapWithConcurrency(entries, SEND_CONCURRENCY, async (entry) => {
    const prefs = prefsMap.get(entry.userId)
    if (prefs && !prefs[channel]) return
    const recipient = emailMap.get(entry.userId)
    if (!recipient) return
    const unsubUrl = unsubscribeUrl(prefs?.unsubscribe_token ?? null, channel)
    const { subject, element } = build(entry, recipient, unsubUrl)
    const res = await sendBrandedEmail(recipient.email, subject, element, { unsubscribeUrl: unsubUrl })
    if (res.sent) sent += 1
  })
  return sent
}

export interface ReminderDigestEntry {
  userId: string
  items: DigestItem[]
}

/** Send branded reminder digests to many users (gated on the reminders channel). */
export async function sendReminderDigests(entries: ReminderDigestEntry[]): Promise<number> {
  const valid = entries.filter((e) => e.items.length > 0)
  return broadcast(valid, "reminders", (entry, recipient, unsubUrl) => ({
    subject:
      entry.items.length === 1
        ? entry.items[0].title
        : `You have ${entry.items.length} updates on ${APP_NAME}`,
    element: NotificationDigestEmail({
      firstName: recipient.firstName,
      items: entry.items,
      unsubscribeUrl: unsubUrl,
    }),
  }))
}

export type WeeklyReportEntry = { userId: string } & Omit<WeeklyReportData, "firstName" | "unsubscribeUrl">

/** Send periodic net-worth reports (gated on the weekly_summary channel). */
export async function sendWeeklyReports(entries: WeeklyReportEntry[]): Promise<number> {
  return broadcast(entries, "weekly_summary", (entry, recipient, unsubUrl) => ({
    subject:
      entry.period === "month"
        ? `Your monthly net worth: ${entry.netWorthLabel}`
        : `Your weekly net worth: ${entry.netWorthLabel}`,
    element: WeeklyReportEmail({
      ...entry,
      firstName: recipient.firstName,
      unsubscribeUrl: unsubUrl,
    }),
  }))
}

export interface BlogPostEmailData {
  title: string
  excerpt: string
  url: string
}

/** Email a new blog post to the given Clerk user ids (gated on the blog channel). */
export async function sendBlogPostEmailToUsers(
  userIds: string[],
  post: BlogPostEmailData,
): Promise<number> {
  const entries = [...new Set(userIds)].map((userId) => ({ userId }))
  return broadcast(entries, "blog", (_entry, _recipient, unsubUrl) => ({
    subject: `New on ${APP_NAME}: ${post.title}`,
    element: BlogPostEmail({ ...post, unsubscribeUrl: unsubUrl }),
  }))
}

/** Send the one-off welcome email (transactional — not preference-gated). */
export async function sendWelcomeEmail(to: string, firstName: string | null): Promise<SendResult> {
  if (!emailEnabled()) return { sent: false, error: "No email transport configured" }
  return sendBrandedEmail(to, `Welcome to ${APP_NAME} 🎉`, WelcomeEmail({ firstName }))
}
