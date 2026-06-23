import { createClient } from "@supabase/supabase-js"
import { getSupabaseSecretKey } from "@/utils/supabase/admin"

export type BlogAutomationStatus = {
  queueEnabled: boolean
  nextTopic: {
    id: string
    title: string
    source: string
  } | null
  pendingCount: number
  postedCount: number
  lastAutoPost: {
    title: string
    slug: string
    postedAt: string
  } | null
}

export async function getBlogAutomationStatus(): Promise<BlogAutomationStatus> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceRoleKey = getSupabaseSecretKey()
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    return {
      queueEnabled: false,
      nextTopic: null,
      pendingCount: 0,
      postedCount: 0,
      lastAutoPost: null,
    }
  }

  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey)

  const [nextResult, pendingResult, postedResult, lastPostResult] = await Promise.all([
    supabase
      .from("blog_topics")
      .select("id,title,source")
      .eq("status", "pending")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("blog_topics")
      .select("id", { head: true, count: "exact" })
      .eq("status", "pending"),
    supabase
      .from("blog_topics")
      .select("id", { head: true, count: "exact" })
      .eq("status", "posted"),
    supabase
      .from("blog_topics")
      .select("published_title,published_slug,posted_at")
      .not("published_slug", "is", null)
      .order("posted_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  if (pendingResult.error || postedResult.error) {
    return {
      queueEnabled: false,
      nextTopic: null,
      pendingCount: 0,
      postedCount: 0,
      lastAutoPost: null,
    }
  }

  return {
    queueEnabled: true,
    nextTopic: nextResult.data
      ? {
          id: nextResult.data.id,
          title: nextResult.data.title,
          source: nextResult.data.source,
        }
      : null,
    pendingCount: pendingResult.count ?? 0,
    postedCount: postedResult.count ?? 0,
    lastAutoPost:
      lastPostResult.data &&
      lastPostResult.data.published_title &&
      lastPostResult.data.published_slug &&
      lastPostResult.data.posted_at
        ? {
            title: lastPostResult.data.published_title,
            slug: lastPostResult.data.published_slug,
            postedAt: lastPostResult.data.posted_at,
          }
        : null,
  }
}

