-- Email preferences + one-click unsubscribe
-- One row per user. Booleans default true (opted-in); the unsubscribe_token is a
-- stable, unguessable id used for RFC 8058 one-click unsubscribe links/headers so
-- a logged-out click can still opt out. Accessed server-side via the admin client
-- (cron, unsubscribe route, preferences API), so it never needs a client session.

create table if not exists public.email_preferences (
  user_id text primary key,
  reminders boolean not null default true,
  weekly_summary boolean not null default true,
  blog boolean not null default true,
  unsubscribe_token uuid not null default gen_random_uuid() unique,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_email_preferences_token
  on public.email_preferences(unsubscribe_token);

create or replace trigger set_updated_at_email_preferences
  before update on public.email_preferences
  for each row execute function update_updated_at_column();

-- RLS: owner-scoped via the Clerk JWT `sub` claim (matches the rest of the app).
-- Server jobs use the service-role client, which bypasses RLS.
alter table public.email_preferences enable row level security;

drop policy if exists "email_preferences_owner_all" on public.email_preferences;

create policy "email_preferences_owner_all" on public.email_preferences for all to authenticated
  using ((select auth.jwt() ->> 'sub') = user_id)
  with check ((select auth.jwt() ->> 'sub') = user_id);
