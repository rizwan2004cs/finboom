-- Feature Board table
-- Personal backlog of feature ideas for the app. Each row is one idea the
-- owner wants to revisit later; `status` tracks whether it's still just an
-- idea, planned, or already shipped.

create table if not exists public.feature_ideas (
  id uuid default gen_random_uuid() primary key,
  user_id text not null,
  title text not null,
  description text,
  status text not null default 'idea' check (status in ('idea', 'planned', 'done')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Performance + delta-sync indexes
create index if not exists idx_feature_ideas_user_id on public.feature_ideas(user_id);
create index if not exists idx_feature_ideas_updated_at on public.feature_ideas(updated_at);

-- Auto-update updated_at on modification (reuses the shared trigger function)
create or replace trigger set_updated_at_feature_ideas
  before update on public.feature_ideas
  for each row execute function update_updated_at_column();

-- Row Level Security — owner-scoped via the Clerk JWT `sub` claim, matching
-- the pattern in 20260621000000_secure_rls_clerk.sql.
alter table public.feature_ideas enable row level security;

drop policy if exists "feature_ideas_owner_all" on public.feature_ideas;

create policy "feature_ideas_owner_all" on public.feature_ideas for all to authenticated
  using ((select auth.jwt() ->> 'sub') = user_id)
  with check ((select auth.jwt() ->> 'sub') = user_id);
