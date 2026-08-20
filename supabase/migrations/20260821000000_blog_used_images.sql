-- Blog used-images registry
-- One row per stock photo ever used in a published blog post (hero or
-- inline), keyed by a provider-scoped id (e.g. "unsplash-<id>", "pexels-<id>"
-- or a fallback URL). The generation pipeline seeds its image resolver from
-- this table so a photo used in ANY earlier post is never picked again —
-- previously dedup was only in-memory per post, so the same Unsplash photos
-- repeated across the blog listing.

create table if not exists public.blog_used_images (
  id uuid default gen_random_uuid() primary key,
  image_key text not null unique,
  image_url text,
  post_slug text,
  created_at timestamptz default now()
);

-- Service-role only (the automation pipeline). RLS on with no policies means
-- anon/authenticated clients cannot read or write it.
alter table public.blog_used_images enable row level security;
