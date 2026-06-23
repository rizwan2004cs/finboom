import { createClient } from "@supabase/supabase-js"
import { normalizeTopic } from "@/lib/blog/topic-utils"
import { getSupabaseSecretKey } from "@/utils/supabase/admin"

type DbTopicRow = {
  id: string
  title: string
  normalized_title: string
  status: "pending" | "posted" | "skipped"
}

function getAdminSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = getSupabaseSecretKey()
  if (!supabaseUrl || !serviceRoleKey) return null
  return createClient(supabaseUrl, serviceRoleKey)
}

async function tableAvailable() {
  const supabase = getAdminSupabaseClient()
  if (!supabase) return { available: false as const, supabase: null }

  const { error } = await supabase.from("blog_topics").select("id").limit(1)
  if (error) return { available: false as const, supabase: null }
  return { available: true as const, supabase }
}

export async function seedTopicQueueIfNeeded() {
  const { available, supabase } = await tableAvailable()
  if (!available || !supabase) {
    return { enabled: false as const }
  }
  return { enabled: true as const }
}

export async function syncQueueWithPublishedTitles(publishedTitles: string[]) {
  const { available, supabase } = await tableAvailable()
  if (!available || !supabase || !publishedTitles.length) return

  const normalizedPublished = publishedTitles.map((title) => normalizeTopic(title))
  await supabase
    .from("blog_topics")
    .update({ status: "posted", posted_at: new Date().toISOString() })
    .in("normalized_title", normalizedPublished)
    .neq("status", "posted")
}

export async function getNextPendingTopicFromQueue(): Promise<{ id: string; title: string } | null> {
  const { available, supabase } = await tableAvailable()
  if (!available || !supabase) return null

  const { data } = await supabase
    .from("blog_topics")
    .select("id,title")
    .eq("status", "pending")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle()

  if (!data) return null
  return { id: data.id, title: data.title }
}

export async function addFallbackTopicsToQueue(topics: string[]) {
  const { available, supabase } = await tableAvailable()
  if (!available || !supabase || !topics.length) return

  const rows = topics.map((title) => ({
    title,
    normalized_title: normalizeTopic(title),
    source: "ai_fallback",
    status: "pending",
    sort_order: 100000,
  }))

  await supabase.from("blog_topics").upsert(rows, { onConflict: "normalized_title" })
}

// Manual topics sort ahead of seeded ones (sort_order 1000) so an
// admin-added topic is picked on the next run.
export async function addManualTopicToQueue(title: string) {
  const { available, supabase } = await tableAvailable()
  if (!available || !supabase) {
    return { ok: false as const, error: "Topic queue is not available." }
  }

  const { error } = await supabase.from("blog_topics").upsert(
    {
      title,
      normalized_title: normalizeTopic(title),
      source: "manual",
      status: "pending",
      sort_order: 500,
    },
    { onConflict: "normalized_title" }
  )

  if (error) {
    return { ok: false as const, error: error.message }
  }
  return { ok: true as const }
}

export async function skipQueueTopic(id: string) {
  const { available, supabase } = await tableAvailable()
  if (!available || !supabase) {
    return { ok: false as const, error: "Topic queue is not available." }
  }

  const { error } = await supabase
    .from("blog_topics")
    .update({ status: "skipped" })
    .eq("id", id)
    .eq("status", "pending")

  if (error) {
    return { ok: false as const, error: error.message }
  }
  return { ok: true as const }
}

export async function markQueueTopicPosted(params: {
  id: string
  publishedTitle: string
  publishedSlug: string
}) {
  const { available, supabase } = await tableAvailable()
  if (!available || !supabase) return

  await supabase
    .from("blog_topics")
    .update({
      status: "posted",
      posted_at: new Date().toISOString(),
      published_title: params.publishedTitle,
      published_slug: params.publishedSlug,
    })
    .eq("id", params.id)
}

export async function getPostedTopicCount() {
  const { available, supabase } = await tableAvailable()
  if (!available || !supabase) return null

  const { count } = await supabase
    .from("blog_topics")
    .select("id", { head: true, count: "exact" })
    .eq("status", "posted")

  return count ?? 0
}

export async function getQueueHealth() {
  const { available, supabase } = await tableAvailable()
  if (!available || !supabase) {
    return { enabled: false, pending: 0, posted: 0 }
  }

  const { count: pendingCount } = await supabase
    .from("blog_topics")
    .select("id", { head: true, count: "exact" })
    .eq("status", "pending")

  const { count: postedCount } = await supabase
    .from("blog_topics")
    .select("id", { head: true, count: "exact" })
    .eq("status", "posted")

  return {
    enabled: true,
    pending: pendingCount ?? 0,
    posted: postedCount ?? 0,
  }
}

export async function listPendingQueueTopics(limit = 20) {
  const { available, supabase } = await tableAvailable()
  if (!available || !supabase) return []

  const { data } = await supabase
    .from("blog_topics")
    .select("id,title,normalized_title,status")
    .eq("status", "pending")
    .order("sort_order", { ascending: true })
    .limit(limit)

  return (data ?? []) as DbTopicRow[]
}
