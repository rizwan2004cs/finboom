-- Native (Expo) push device tokens.
--
-- The web app delivers push via the Web-Push/VAPID `push_subscriptions` table.
-- The native mobile app instead registers an Expo push token per device; this
-- table stores those tokens so the shared notification pipeline can fan out to
-- both web subscriptions and native devices.

create table if not exists public.device_tokens (
  id uuid default gen_random_uuid() primary key,
  user_id text not null,
  token text not null unique,
  platform text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_device_tokens_user_id on public.device_tokens(user_id);

create or replace trigger set_updated_at_device_tokens
  before update on public.device_tokens
  for each row execute function update_updated_at_column();

-- RLS: a user can only manage their own device tokens. Keyed on the Clerk user
-- id from the JWT `sub` claim, matching every other owner-scoped table.
alter table public.device_tokens enable row level security;

drop policy if exists "device_tokens_owner_all" on public.device_tokens;
create policy "device_tokens_owner_all" on public.device_tokens
  for all to authenticated
  using ((select auth.jwt() ->> 'sub') = user_id)
  with check ((select auth.jwt() ->> 'sub') = user_id);
