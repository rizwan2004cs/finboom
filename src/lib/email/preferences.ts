/**
 * Email preference + unsubscribe storage (server-only).
 *
 * Everything degrades gracefully: if the admin client isn't configured or the
 * `email_preferences` table hasn't been migrated yet, reads return opted-in
 * defaults so email keeps working. All access is via the service-role client,
 * so it's safe to call from cron/webhook/route contexts without a session.
 */

import { createAdminClient } from "@/utils/supabase/admin"

export type EmailChannel = "reminders" | "weekly_summary" | "blog"

export interface EmailPrefs {
  reminders: boolean
  weekly_summary: boolean
  blog: boolean
  unsubscribe_token: string | null
}

const DEFAULT_PREFS: EmailPrefs = {
  reminders: true,
  weekly_summary: true,
  blog: true,
  unsubscribe_token: null,
}

const SELECT_COLS = "user_id, reminders, weekly_summary, blog, unsubscribe_token"

type AdminClient = ReturnType<typeof createAdminClient>
function adminOrNull(): AdminClient | null {
  try {
    return createAdminClient()
  } catch {
    return null
  }
}

function rowToPrefs(row: Record<string, unknown>): EmailPrefs {
  return {
    reminders: row.reminders !== false,
    weekly_summary: row.weekly_summary !== false,
    blog: row.blog !== false,
    unsubscribe_token: (row.unsubscribe_token as string) ?? null,
  }
}

/**
 * Fetch prefs for many users at once, creating default rows (with tokens) for any
 * that don't have one. Returns a map keyed by user_id; missing/erroring users
 * fall back to opted-in defaults.
 */
export async function getOrCreateEmailPrefsMap(userIds: string[]): Promise<Map<string, EmailPrefs>> {
  const map = new Map<string, EmailPrefs>()
  const ids = [...new Set(userIds.filter(Boolean))]
  const supabase = adminOrNull()
  if (!supabase || ids.length === 0) {
    for (const id of ids) map.set(id, DEFAULT_PREFS)
    return map
  }
  try {
    const { data, error } = await supabase.from("email_preferences").select(SELECT_COLS).in("user_id", ids)
    if (error) {
      for (const id of ids) map.set(id, DEFAULT_PREFS)
      return map
    }
    for (const row of data || []) map.set((row as { user_id: string }).user_id, rowToPrefs(row))

    const missing = ids.filter((id) => !map.has(id))
    if (missing.length) {
      const { data: created } = await supabase
        .from("email_preferences")
        .insert(missing.map((user_id) => ({ user_id })))
        .select(SELECT_COLS)
      for (const row of created || []) map.set((row as { user_id: string }).user_id, rowToPrefs(row))
      for (const id of missing) if (!map.has(id)) map.set(id, DEFAULT_PREFS)
    }
    return map
  } catch {
    for (const id of ids) map.set(id, DEFAULT_PREFS)
    return map
  }
}

/** Single-user convenience wrapper around {@link getOrCreateEmailPrefsMap}. */
export async function getOrCreateEmailPrefs(userId: string): Promise<EmailPrefs> {
  const map = await getOrCreateEmailPrefsMap([userId])
  return map.get(userId) ?? DEFAULT_PREFS
}

/** Read prefs for the settings UI (does not create a row). */
export async function getEmailPrefs(userId: string): Promise<EmailPrefs> {
  return getOrCreateEmailPrefs(userId)
}

/** Update prefs for an authenticated user (settings UI). Upserts the row. */
export async function updateEmailPrefs(
  userId: string,
  patch: Partial<Record<EmailChannel, boolean>>,
): Promise<EmailPrefs | null> {
  const supabase = adminOrNull()
  if (!supabase) return null
  try {
    const { data, error } = await supabase
      .from("email_preferences")
      .upsert({ user_id: userId, ...patch }, { onConflict: "user_id" })
      .select(SELECT_COLS)
      .maybeSingle()
    if (error || !data) return null
    return rowToPrefs(data as Record<string, unknown>)
  } catch {
    return null
  }
}

/** Flip preferences off via the unsubscribe token (one-click, no session). */
export async function unsubscribeByToken(
  token: string,
  channel: EmailChannel | "all",
): Promise<boolean> {
  const supabase = adminOrNull()
  if (!supabase) return false
  const patch =
    channel === "all"
      ? { reminders: false, weekly_summary: false, blog: false }
      : { [channel]: false }
  try {
    const { error } = await supabase.from("email_preferences").update(patch).eq("unsubscribe_token", token)
    return !error
  } catch {
    return false
  }
}
