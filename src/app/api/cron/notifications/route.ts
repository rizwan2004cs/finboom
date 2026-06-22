import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/utils/supabase/admin"
import webpush from "web-push"

webpush.setVapidDetails(
  "mailto:rizwan22cse@gmail.com",
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
)

const CRON_SECRET = process.env.CRON_SECRET

interface NotificationToCreate {
  user_id: string
  type: string
  title: string
  body: string
  data: Record<string, unknown>
}

// Whole days until the next occurrence of a monthly SIP day, clamped to the
// month length so day 31 falls back to the last day of shorter months.
function daysUntilSipDay(sipDay: number, today: Date): number {
  const y = today.getFullYear()
  const m = today.getMonth()
  const startOfToday = new Date(y, m, today.getDate())
  const lastDayThisMonth = new Date(y, m + 1, 0).getDate()
  let next = new Date(y, m, Math.min(sipDay, lastDayThisMonth))
  if (next < startOfToday) {
    const lastDayNextMonth = new Date(y, m + 2, 0).getDate()
    next = new Date(y, m + 1, Math.min(sipDay, lastDayNextMonth))
  }
  return Math.round((next.getTime() - startOfToday.getTime()) / 86400000)
}

// GET /api/cron/notifications — runs for ALL users, called by external cron
export async function GET(req: NextRequest) {
  // Verify cron secret
  const authHeader = req.headers.get("authorization")
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const supabase = createAdminClient()

  // Get all distinct user IDs from profiles
  const { data: users } = await supabase
    .from("profiles")
    .select("user_id")
  
  const uniqueUserIds = [...new Set((users || []).map((u) => u.user_id))]
  
  let totalCreated = 0

  for (const userId of uniqueUserIds) {
    const notifications: NotificationToCreate[] = []
    const today = new Date()
    const todayStr = today.toISOString().split("T")[0]

    // --- 1. Overdue party payments ---
    const { data: overdue } = await supabase
      .from("party_transactions")
      .select("*, party:parties(*)")
      .eq("user_id", userId)
      .in("type", ["lent", "borrowed"])
      .lt("due_date", todayStr)

    if (overdue) {
      for (const tx of overdue) {
        const { data: existing } = await supabase
          .from("notifications")
          .select("id")
          .eq("user_id", userId)
          .eq("type", "overdue_payment")
          .gte("created_at", todayStr)
          .contains("data", { transaction_id: tx.id })
          .limit(1)

        if (!existing?.length) {
          const partyName = tx.party?.name || "Someone"
          const verb = tx.type === "lent" ? "owes you" : "you owe"
          notifications.push({
            user_id: userId,
            type: "overdue_payment",
            title: `Overdue: ${partyName}`,
            body: `${partyName} ${verb} ₹${Number(tx.amount).toLocaleString("en-IN")} — was due ${tx.due_date}`,
            data: { transaction_id: tx.id, party_id: tx.party_id },
          })
        }
      }
    }

    // --- 2. Due date approaching (within 3 days) ---
    const threeDaysLater = new Date(today)
    threeDaysLater.setDate(today.getDate() + 3)
    const threeDaysStr = threeDaysLater.toISOString().split("T")[0]

    const { data: approaching } = await supabase
      .from("party_transactions")
      .select("*, party:parties(*)")
      .eq("user_id", userId)
      .in("type", ["lent", "borrowed"])
      .gte("due_date", todayStr)
      .lte("due_date", threeDaysStr)

    if (approaching) {
      for (const tx of approaching) {
        const { data: existing } = await supabase
          .from("notifications")
          .select("id")
          .eq("user_id", userId)
          .eq("type", "due_approaching")
          .gte("created_at", todayStr)
          .contains("data", { transaction_id: tx.id })
          .limit(1)

        if (!existing?.length) {
          const partyName = tx.party?.name || "Someone"
          const daysLeft = Math.ceil(
            (new Date(tx.due_date).getTime() - today.getTime()) / 86400000
          )
          const verb = tx.type === "lent" ? "owes you" : "you owe"
          notifications.push({
            user_id: userId,
            type: "due_approaching",
            title: `Due ${daysLeft === 0 ? "today" : `in ${daysLeft}d`}: ${partyName}`,
            body: `${partyName} ${verb} ₹${Number(tx.amount).toLocaleString("en-IN")} — due ${tx.due_date}`,
            data: { transaction_id: tx.id, party_id: tx.party_id },
          })
        }
      }
    }

    // --- 3. Goal milestones (50%, 100%) ---
    const { data: goals } = await supabase
      .from("goals")
      .select("*")
      .eq("user_id", userId)

    if (goals) {
      for (const goal of goals) {
        if (goal.target_amount <= 0) continue
        const pct = Math.round((goal.current_amount / goal.target_amount) * 100)
        const milestones = [50, 100]

        for (const milestone of milestones) {
          if (pct >= milestone) {
            const { data: existing } = await supabase
              .from("notifications")
              .select("id")
              .eq("user_id", userId)
              .eq("type", "goal_milestone")
              .contains("data", { goal_id: goal.id, milestone })
              .limit(1)

            if (!existing?.length) {
              notifications.push({
                user_id: userId,
                type: "goal_milestone",
                title: milestone === 100 ? `Goal reached: ${goal.name}` : `Halfway: ${goal.name}`,
                body:
                  milestone === 100
                    ? `You've reached your ₹${Number(goal.target_amount).toLocaleString("en-IN")} target for "${goal.name}"!`
                    : `You're 50% of the way to your "${goal.name}" goal — ₹${Number(goal.current_amount).toLocaleString("en-IN")} of ₹${Number(goal.target_amount).toLocaleString("en-IN")}`,
                data: { goal_id: goal.id, milestone },
              })
            }
          }
        }
      }
    }

    // --- 4. Large transactions (>50k in last 24h) ---
    const yesterday = new Date(today)
    yesterday.setDate(today.getDate() - 1)
    const yesterdayStr = yesterday.toISOString()

    const { data: largeTxns } = await supabase
      .from("transactions")
      .select("*")
      .eq("user_id", userId)
      .gte("created_at", yesterdayStr)
      .gte("amount", 50000)

    if (largeTxns) {
      for (const tx of largeTxns) {
        const { data: existing } = await supabase
          .from("notifications")
          .select("id")
          .eq("user_id", userId)
          .eq("type", "large_transaction")
          .contains("data", { transaction_id: tx.id })
          .limit(1)

        if (!existing?.length) {
          notifications.push({
            user_id: userId,
            type: "large_transaction",
            title: `Large ${tx.type}: ₹${Number(tx.amount).toLocaleString("en-IN")}`,
            body: `${tx.category}${tx.description ? ` — ${tx.description}` : ""}`,
            data: { transaction_id: tx.id },
          })
        }
      }
    }

    // --- 5. SIP reminders (due today or tomorrow) ---
    const { data: sips } = await supabase
      .from("sips")
      .select("*")
      .eq("user_id", userId)
      .eq("active", true)
      .eq("reminder_enabled", true)

    if (sips) {
      for (const sip of sips) {
        const daysLeft = daysUntilSipDay(sip.sip_day, today)
        if (daysLeft > 1) continue // only remind the day before and the day of

        const { data: existing } = await supabase
          .from("notifications")
          .select("id")
          .eq("user_id", userId)
          .eq("type", "sip_reminder")
          .gte("created_at", todayStr)
          .contains("data", { sip_id: sip.id })
          .limit(1)

        if (!existing?.length) {
          const label = sip.fund_name || sip.name
          notifications.push({
            user_id: userId,
            type: "sip_reminder",
            title: daysLeft === 0 ? `SIP due today: ${label}` : `SIP tomorrow: ${label}`,
            body: `₹${Number(sip.amount).toLocaleString("en-IN")} ${daysLeft === 0 ? "is due today" : "is due tomorrow"} (day ${sip.sip_day})`,
            data: { sip_id: sip.id, sip_day: sip.sip_day },
          })
        }
      }
    }

    // Insert all new notifications for this user
    if (notifications.length > 0) {
      await supabase.from("notifications").insert(notifications)
      totalCreated += notifications.length

      // Send push notifications
      const { data: subs } = await supabase
        .from("push_subscriptions")
        .select("*")
        .eq("user_id", userId)

      if (subs?.length) {
        for (const notif of notifications) {
          const payload = JSON.stringify({
            title: notif.title,
            body: notif.body,
            icon: "/icons/icon-192.svg",
            badge: "/icons/icon-192.svg",
            data: { url: "/dashboard" },
          })

          for (const sub of subs) {
            try {
              await webpush.sendNotification(
                {
                  endpoint: sub.endpoint,
                  keys: { p256dh: sub.keys_p256dh, auth: sub.keys_auth },
                },
                payload
              )
            } catch (err: unknown) {
              if (err && typeof err === "object" && "statusCode" in err && (err as { statusCode: number }).statusCode === 410) {
                await supabase.from("push_subscriptions").delete().eq("id", sub.id)
              }
            }
          }
        }
      }
    }
  }

  return NextResponse.json({
    ok: true,
    users_checked: uniqueUserIds.length,
    notifications_created: totalCreated,
  })
}
