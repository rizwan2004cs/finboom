import { NextRequest, NextResponse } from "next/server"
import { unsubscribeByToken, type EmailChannel } from "@/lib/email/preferences"
import { APP_NAME, absoluteUrl } from "@/emails/theme"

const CHANNELS: Record<string, EmailChannel | "all"> = {
  reminders: "reminders",
  weekly_summary: "weekly_summary",
  blog: "blog",
  all: "all",
}

const CHANNEL_LABEL: Record<EmailChannel | "all", string> = {
  reminders: "reminder",
  weekly_summary: "weekly report",
  blog: "blog",
  all: "all",
}

function resolveChannel(value: string | null): EmailChannel | "all" {
  return (value && CHANNELS[value]) || "all"
}

function confirmationPage(channel: EmailChannel | "all", ok: boolean): string {
  const label = CHANNEL_LABEL[channel]
  const heading = ok ? "You’re unsubscribed" : "Couldn’t update your preferences"
  const message = ok
    ? channel === "all"
      ? `You won’t receive any more emails from ${APP_NAME}.`
      : `You won’t receive ${label} emails from ${APP_NAME} anymore.`
    : "Your link may have expired. You can manage all email preferences from your settings."
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex" />
<title>${heading} — ${APP_NAME}</title>
<style>
  :root { color-scheme: light dark; }
  body { margin:0; min-height:100vh; display:flex; align-items:center; justify-content:center;
    background:#eef0f3; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif; color:#1d1d1f; }
  .card { background:#fff; max-width:440px; width:calc(100% - 32px); border-radius:20px; padding:36px 32px;
    box-shadow:0 10px 30px rgba(15,18,30,.10); text-align:center; }
  .badge { display:inline-block; width:56px; height:56px; line-height:56px; border-radius:14px;
    background:#e7f9ec; color:#1a8a38; font-size:28px; margin-bottom:16px; }
  h1 { font-size:20px; margin:0 0 8px; letter-spacing:-.02em; }
  p { font-size:14.5px; line-height:22px; color:#6e6e73; margin:0 0 22px; }
  a.btn { display:inline-block; background:#34c759; color:#fff; text-decoration:none; font-weight:600;
    font-size:14.5px; padding:12px 26px; border-radius:12px; }
  .muted { font-size:12px; color:#86868b; margin-top:18px; }
  @media (prefers-color-scheme: dark) {
    body { background:#000; color:#f5f5f7; } .card { background:#1c1c1e; } p { color:#aeaeb2; } .muted { color:#8e8e93; }
  }
</style>
</head>
<body>
  <div class="card">
    <div class="badge">${ok ? "✓" : "!"}</div>
    <h1>${heading}</h1>
    <p>${message}</p>
    <a class="btn" href="${absoluteUrl("/dashboard/settings")}">Manage email preferences</a>
    <div class="muted">${APP_NAME} — ${absoluteUrl("/").replace(/^https?:\/\//, "")}</div>
  </div>
</body>
</html>`
}

// GET — user clicked the unsubscribe link in an email. Flip the pref and show a page.
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token")
  const channel = resolveChannel(req.nextUrl.searchParams.get("c"))
  const ok = token ? await unsubscribeByToken(token, channel) : false
  return new NextResponse(confirmationPage(channel, ok), {
    status: ok ? 200 : 400,
    headers: { "content-type": "text/html; charset=utf-8" },
  })
}

// POST — RFC 8058 one-click unsubscribe (Gmail/Apple Mail send this automatically).
export async function POST(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token")
  const channel = resolveChannel(req.nextUrl.searchParams.get("c"))
  const ok = token ? await unsubscribeByToken(token, channel) : false
  return NextResponse.json({ ok }, { status: ok ? 200 : 400 })
}
