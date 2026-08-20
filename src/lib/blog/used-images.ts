import { createClient } from "@supabase/supabase-js"
import { getSupabaseSecretKey } from "@/utils/supabase/admin"
import type { UsedImage } from "@/lib/blog/images"

// Persistent cross-post image dedup. The resolver in images.ts only tracks
// photos within a single generation, so the same stock photos kept reappearing
// on different posts. This module loads every image key ever used (to seed the
// resolver) and records the keys a new post consumed. All calls are graceful
// no-ops when the table or env is missing — image dedup must never block a
// post from publishing.

function getAdminSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = getSupabaseSecretKey()
  if (!supabaseUrl || !serviceRoleKey) return null
  return createClient(supabaseUrl, serviceRoleKey)
}

export async function getUsedImageKeys(): Promise<string[]> {
  const supabase = getAdminSupabaseClient()
  if (!supabase) return []

  const { data, error } = await supabase.from("blog_used_images").select("image_key")
  if (error || !data) return []
  return data.map((row) => row.image_key as string).filter(Boolean)
}

export async function saveUsedImages(images: UsedImage[], postSlug?: string): Promise<void> {
  const supabase = getAdminSupabaseClient()
  if (!supabase || images.length === 0) return

  const rows = images.map((image) => ({
    image_key: image.key,
    image_url: image.url,
    post_slug: postSlug ?? null,
  }))
  await supabase
    .from("blog_used_images")
    .upsert(rows, { onConflict: "image_key", ignoreDuplicates: true })
}
