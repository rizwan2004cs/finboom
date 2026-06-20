-- Adds category + keyword tagging to the blog topic queue so the daily
-- automation can balance the publishing mix and seed SEO keywords per topic.
-- Additive only (safe to apply at any time); existing rows default to NULL.
alter table public.blog_topics
  add column if not exists category text,
  add column if not exists keywords text[] not null default '{}';

-- Speeds up "next pending topic for category X" lookups once the queue
-- becomes category-aware.
create index if not exists idx_blog_topics_category_status
  on public.blog_topics(category, status, sort_order, created_at);
