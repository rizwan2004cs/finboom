/**
 * Notification generation — shared by the daily cron (all users, admin client)
 * and the per-user check route (authenticated client). Keeping a single
 * implementation prevents the two paths from drifting and fixes several issues
 * the duplicated copies had:
 *  - Party alerts now use each party's NET outstanding balance, so settled or
 *    partially-repaid loans no longer alert with the original amount.
 *  - Day boundaries are computed in IST (the app's reporting timezone) instead
 *    of the server's UTC clock.
 *  - Push delivery degrades gracefully when VAPID keys are absent and deep-links
 *    to the relevant page per notification type.
 */

import webpush from "web-push"
import type { SupabaseClient } from "@supabase/supabase-js"
import { EXPENSE_CATEGORIES } from "@/lib/constants"
import { isAccountMovement } from "@/lib/finance/accounts"
import { notificationDedupeKey } from "@/lib/utils"

export interface NotificationToCreate {
  user_id: string
  type: string
  title: string
  body: string
  data: Record<string, unknown>
  dedupe_key: string
}

// The app reports in IST; day-boundary math is anchored here regardless of where
// the server runs.
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000

let vapidReady = false
function ensureVapid(): boolean {
  if (vapidReady) return true
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const priv = process.env.VAPID_PRIVATE_KEY
  if (!pub || !priv) return false
  webpush.setVapidDetails("mailto:rizwan22cse@gmail.com", pub, priv)
  vapidReady = true
  return true
}

function istParts(now: Date): { y: number; m: number; d: number } {
  const ist = new Date(now.getTime() + IST_OFFSET_MS)
  return { y: ist.getUTCFullYear(), m: ist.getUTCMonth(), d: ist.getUTCDate() }
}

/** Format a (possibly overflowing) Y/M/D as an IST calendar date string. */
function ymd(y: number, m: number, d: number): string {
  const date = new Date(Date.UTC(y, m, d))
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`
}

/** Whole days until the next monthly SIP occurrence, computed in IST and clamped
 *  so day 31 falls back to the last day of shorter months. */
function daysUntilSipDay(sipDay: number, now: Date): number {
  const { y, m, d } = istParts(now)
  const startOfToday = Date.UTC(y, m, d)
  const lastThisMonth = new Date(Date.UTC(y, m + 1, 0)).getUTCDate()
  let next = Date.UTC(y, m, Math.min(sipDay, lastThisMonth))
  if (next < startOfToday) {
    const lastNextMonth = new Date(Date.UTC(y, m + 2, 0)).getUTCDate()
    next = Date.UTC(y, m + 1, Math.min(sipDay, lastNextMonth))
  }
  return Math.round((next - startOfToday) / 86400000)
}

function urlForType(type: string): string {
  if (type === "overdue_payment" || type === "due_approaching") return "/dashboard/parties"
  if (type === "goal_milestone") return "/dashboard/goals"
  if (type === "large_transaction") return "/dashboard/transactions"
  if (type === "sip_reminder") return "/dashboard/sips"
  if (type === "budget_exceeded") return "/dashboard/budget"
  return "/dashboard"
}

// Deliver notifications to native devices via Expo's push service. Invalid /
// unregistered tokens are pruned so the table self-heals, mirroring how the
// web-push path deletes subscriptions that return HTTP 410.
async function sendExpoPush(
  supabase: SupabaseClient,
  tokens: DeviceTokenRow[],
  notifs: NotificationToCreate[],
): Promise<void> {
  if (tokens.length === 0 || notifs.length === 0) return

  const messages = tokens.flatMap((dt) =>
    notifs.map((n) => ({
      to: dt.token,
      title: n.title,
      body: n.body,
      data: { url: n.data.url ?? "/dashboard" },
      sound: "default" as const,
    })),
  )

  // Expo accepts up to 100 messages per request.
  for (let i = 0; i < messages.length; i += 100) {
    const batch = messages.slice(i, i + 100)
    try {
      const res = await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(batch),
      })
      const json = (await res.json()) as {
        data?: Array<{ status: string; details?: { error?: string } }>
      }
      const receipts = json.data ?? []
      const deadTokens = new Set<string>()
      receipts.forEach((receipt, idx) => {
        if (receipt.status === "error" && receipt.details?.error === "DeviceNotRegistered") {
          deadTokens.add(batch[idx].to)
        }
      })
      if (deadTokens.size > 0) {
        await supabase.from("device_tokens").delete().in("token", Array.from(deadTokens))
      }
    } catch {
      // Network/Expo outage — notifications are still persisted in-app.
    }
  }
}

const CATEGORY_LABEL = new Map<string, string>(EXPENSE_CATEGORIES.map((c) => [c.id, c.label]))

const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`

interface PartyTxRow {
  id: string
  party_id: string
  type: string
  amount: number
  due_date: string | null
  party?: { name?: string } | null
}
interface GoalRow {
  id: string
  name: string
  target_amount: number
  current_amount: number
  linked_assets?: string[] | null
}
interface AssetRow { id: string; current_value: number }
interface TxnRow { id: string; type: string; amount: number; category: string; description?: string | null }
interface SipRow { id: string; name: string; fund_name?: string | null; amount: number; sip_day: number }
interface SubRow { id: string; endpoint: string; keys_p256dh: string; keys_auth: string }
interface DeviceTokenRow { id: string; token: string }
interface BudgetRow { id: string; profile_id: string | null; category: string; amount: number }
interface BudgetTxnRow { profile_id: string | null; category: string; amount: number; type: string; date: string }

/**
 * Evaluate all notification rules for one user, persist any new notifications,
 * and send web-push for them. Returns the notifications that were created.
 */
export async function processUserNotifications(
  supabase: SupabaseClient,
  userId: string,
): Promise<NotificationToCreate[]> {
  const now = new Date()
  const { y, m, d } = istParts(now)
  const todayStr = ymd(y, m, d)
  const threeDaysStr = ymd(y, m, d + 3)
  const startOfTodayUTC = new Date(Date.UTC(y, m, d) - IST_OFFSET_MS).toISOString()
  const dayAgoUTC = new Date(now.getTime() - 86400000).toISOString()

  const notifications: NotificationToCreate[] = []
  const add = (
    type: string,
    title: string,
    body: string,
    data: Record<string, unknown>,
    dedupeId: string,
  ) => {
    notifications.push({
      user_id: userId,
      type,
      title,
      body,
      data: { ...data, url: urlForType(type) },
      dedupe_key: notificationDedupeKey(type, dedupeId, todayStr),
    })
  }

  // Prefetch existing notifications once and dedupe in memory, instead of issuing
  // a separate query per candidate (the old N+1). "Today" covers the per-day
  // reminder types; the all-time set covers types that should only fire once
  // (goal milestones, large transactions, and budget alerts — once per month).
  const EVER_TYPES = ["goal_milestone", "large_transaction", "budget_exceeded"]
  const [{ data: todayNotifs }, { data: everNotifs }] = await Promise.all([
    supabase.from("notifications").select("type, data").eq("user_id", userId).gte("created_at", startOfTodayUTC),
    supabase.from("notifications").select("type, data").eq("user_id", userId).in("type", EVER_TYPES),
  ])
  const todayList = (todayNotifs || []) as { type: string; data: Record<string, unknown> }[]
  const everList = (everNotifs || []) as { type: string; data: Record<string, unknown> }[]

  const dataMatches = (data: Record<string, unknown> | null, match: Record<string, unknown>) =>
    !!data && Object.entries(match).every(([k, v]) => data[k] === v)
  const notifiedToday = (type: string, match: Record<string, unknown>) =>
    todayList.some((n) => n.type === type && dataMatches(n.data, match))
  const notifiedEver = (type: string, match: Record<string, unknown>) =>
    everList.some((n) => n.type === type && dataMatches(n.data, match))

  // --- 1 & 2. Party payments — based on NET outstanding per party ---
  const { data: ptxData } = await supabase
    .from("party_transactions").select("*, party:parties(*)").eq("user_id", userId)
  const parties = new Map<string, { name: string; net: number; lentDue: string[]; borrowedDue: string[] }>()
  for (const tx of (ptxData || []) as PartyTxRow[]) {
    const agg = parties.get(tx.party_id) || { name: tx.party?.name || "Someone", net: 0, lentDue: [], borrowedDue: [] }
    const amt = Number(tx.amount)
    if (tx.type === "lent") { agg.net += amt; if (tx.due_date) agg.lentDue.push(tx.due_date) }
    else if (tx.type === "received_back") agg.net -= amt
    else if (tx.type === "borrowed") { agg.net -= amt; if (tx.due_date) agg.borrowedDue.push(tx.due_date) }
    else if (tx.type === "paid_back") agg.net += amt
    if (tx.party?.name) agg.name = tx.party.name
    parties.set(tx.party_id, agg)
  }
  for (const [partyId, agg] of Array.from(parties.entries())) {
    if (Math.abs(agg.net) < 1) continue // fully settled
    const receivable = agg.net > 0
    const dues = (receivable ? agg.lentDue : agg.borrowedDue).filter(Boolean).sort((a, b) => a.localeCompare(b))
    if (dues.length === 0) continue
    const earliest = dues[0]
    const verb = receivable ? "owes you" : "you owe"
    if (earliest < todayStr) {
      if (!notifiedToday("overdue_payment", { party_id: partyId })) {
        add("overdue_payment", `Overdue: ${agg.name}`, `${agg.name} ${verb} ${inr(Math.abs(agg.net))} — was due ${earliest}`, { party_id: partyId }, partyId)
      }
    } else if (earliest <= threeDaysStr) {
      const daysLeft = Math.round((Date.parse(earliest) - Date.UTC(y, m, d)) / 86400000)
      if (!notifiedToday("due_approaching", { party_id: partyId })) {
        add("due_approaching", `Due ${daysLeft === 0 ? "today" : `in ${daysLeft}d`}: ${agg.name}`, `${agg.name} ${verb} ${inr(Math.abs(agg.net))} — due ${earliest}`, { party_id: partyId }, partyId)
      }
    }
  }

  // --- 3. Goal milestones (50%, 100%) — uses linked assets when present ---
  const { data: goalsData } = await supabase.from("goals").select("*").eq("user_id", userId)
  const goals = (goalsData || []) as GoalRow[]
  if (goals.length > 0) {
    const { data: assetsData } = await supabase.from("assets").select("id, current_value").eq("user_id", userId)
    const assetVal = new Map((assetsData || []).map((a: AssetRow) => [a.id, Number(a.current_value)]))
    for (const goal of goals) {
      const target = Number(goal.target_amount)
      if (target <= 0) continue
      const funded = goal.linked_assets?.length
        ? goal.linked_assets.reduce((s, id) => s + (assetVal.get(id) ?? 0), 0)
        : Number(goal.current_amount || 0)
      const pct = Math.round((funded / target) * 100)
      for (const milestone of [50, 100]) {
        if (pct >= milestone && !notifiedEver("goal_milestone", { goal_id: goal.id, milestone })) {
          add(
            "goal_milestone",
            milestone === 100 ? `Goal reached: ${goal.name}` : `Halfway: ${goal.name}`,
            milestone === 100
              ? `You've reached your ${inr(target)} target for "${goal.name}"!`
              : `You're 50% of the way to "${goal.name}" — ${inr(funded)} of ${inr(target)}`,
            { goal_id: goal.id, milestone },
            `${goal.id}:${milestone}`,
          )
        }
      }
    }
  }

  // --- 4. Large transactions (>= 50k logged in the last 24h) ---
  const { data: largeData } = await supabase
    .from("transactions").select("*").eq("user_id", userId)
    .gte("created_at", dayAgoUTC).gte("amount", 50000)
  for (const tx of (largeData || []) as TxnRow[]) {
    // Transfers between own accounts / balance adjustments aren't real
    // income or spending — don't alert on them.
    if (isAccountMovement(tx)) continue
    if (!notifiedEver("large_transaction", { transaction_id: tx.id })) {
      add("large_transaction", `Large ${tx.type}: ${inr(Number(tx.amount))}`, `${tx.category}${tx.description ? ` — ${tx.description}` : ""}`, { transaction_id: tx.id }, tx.id)
    }
  }

  // --- 5. SIP reminders (due today or tomorrow) ---
  const { data: sipsData } = await supabase
    .from("sips").select("*").eq("user_id", userId).eq("active", true).eq("reminder_enabled", true)
  for (const sip of (sipsData || []) as SipRow[]) {
    if (daysUntilSipDay(sip.sip_day, now) > 1) continue
    if (!notifiedToday("sip_reminder", { sip_id: sip.id })) {
      const label = sip.fund_name || sip.name
      const dueToday = daysUntilSipDay(sip.sip_day, now) === 0
      add(
        "sip_reminder",
        dueToday ? `SIP due today: ${label}` : `SIP tomorrow: ${label}`,
        `${inr(Number(sip.amount))} ${dueToday ? "is due today" : "is due tomorrow"}`,
        { sip_id: sip.id },
        sip.id,
      )
    }
  }

  // --- 6. Budget exceeded (per category, once per month) ---
  const monthKey = todayStr.slice(0, 7)
  const { data: budgetData } = await supabase
    .from("budgets").select("id, profile_id, category, amount").eq("user_id", userId).eq("month", monthKey)
  const budgets = (budgetData || []) as BudgetRow[]
  if (budgets.length > 0) {
    const { data: monthTxns } = await supabase
      .from("transactions").select("profile_id, category, amount, type, date")
      .eq("user_id", userId).gte("date", `${monthKey}-01`).lte("date", `${monthKey}-31`)
    const spentByKey = new Map<string, number>()
    for (const tx of (monthTxns || []) as BudgetTxnRow[]) {
      if (tx.type !== "expense" || isAccountMovement(tx)) continue
      const key = `${tx.profile_id ?? ""}|${tx.category}`
      spentByKey.set(key, (spentByKey.get(key) ?? 0) + Number(tx.amount))
    }
    for (const budget of budgets) {
      const limit = Number(budget.amount)
      if (limit <= 0) continue
      const spent = spentByKey.get(`${budget.profile_id ?? ""}|${budget.category}`) ?? 0
      if (spent <= limit) continue
      if (notifiedEver("budget_exceeded", { budget_id: budget.id, period: monthKey })) continue
      const label = CATEGORY_LABEL.get(budget.category) || budget.category
      add(
        "budget_exceeded",
        `Over budget: ${label}`,
        `You've spent ${inr(spent)} of your ${inr(limit)} ${label} budget — ${inr(spent - limit)} over.`,
        { budget_id: budget.id, period: monthKey, category: budget.category },
        `${budget.id}:${monthKey}`,
      )
    }
  }

  if (notifications.length === 0) return []

  // Upsert with a uniqueness backstop. The (user_id, dedupe_key) conflict target
  // means a concurrent cron + bell check (or a StrictMode double-fire of the
  // bell effect) can never create duplicate rows: the loser is dropped silently.
  // `.select()` returns only the rows that were actually inserted, so we push
  // and email only for genuinely new alerts — never for duplicates.
  const { data: insertedRows } = await supabase
    .from("notifications")
    .upsert(notifications, { onConflict: "user_id,dedupe_key", ignoreDuplicates: true })
    .select()

  const inserted = (insertedRows || []) as NotificationToCreate[]
  if (inserted.length === 0) return []

  // Native (Expo) push — independent of VAPID/web-push configuration.
  const { data: deviceData } = await supabase
    .from("device_tokens").select("id, token").eq("user_id", userId)
  await sendExpoPush(supabase, (deviceData ?? []) as DeviceTokenRow[], inserted)

  if (ensureVapid()) {
    const { data: subsData } = await supabase.from("push_subscriptions").select("*").eq("user_id", userId)
    const subs = (subsData || []) as SubRow[]
    for (const notif of inserted) {
      const payload = JSON.stringify({
        title: notif.title,
        body: notif.body,
        icon: "/icons/icon-192.svg",
        badge: "/icons/icon-192.svg",
        data: { url: notif.data.url ?? "/dashboard" },
      })
      for (const sub of subs) {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.keys_p256dh, auth: sub.keys_auth } },
            payload,
          )
        } catch (err: unknown) {
          if (err && typeof err === "object" && "statusCode" in err && (err as { statusCode: number }).statusCode === 410) {
            await supabase.from("push_subscriptions").delete().eq("id", sub.id)
          }
        }
      }
    }
  }

  return inserted
}
