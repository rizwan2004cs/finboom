-- SIP Tracker table
-- Stores recurring investment plans (SIPs). `sip_day` is the day-of-month the
-- SIP debits, used to generate reminders. Amounts are stored in INR like the
-- rest of the app; display conversion happens client-side.

create table if not exists public.sips (
  id uuid default gen_random_uuid() primary key,
  user_id text not null,
  profile_id uuid references public.profiles(id) on delete set null,
  name text not null,
  fund_name text,
  amount numeric not null default 0,
  currency text not null default 'INR',
  sip_day integer not null check (sip_day between 1 and 31),
  active boolean not null default true,
  reminder_enabled boolean not null default true,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Performance + delta-sync indexes
create index if not exists idx_sips_user_id on public.sips(user_id);
create index if not exists idx_sips_updated_at on public.sips(updated_at);
create index if not exists idx_sips_profile on public.sips(user_id, profile_id);

-- Auto-update updated_at on modification (reuses the shared trigger function)
create or replace trigger set_updated_at_sips
  before update on public.sips
  for each row execute function update_updated_at_column();

-- Row Level Security — owner-scoped via the Clerk JWT `sub` claim, matching
-- the pattern in 20260621000000_secure_rls_clerk.sql.
alter table public.sips enable row level security;

drop policy if exists "Users can manage their own sips" on public.sips;
drop policy if exists "sips_owner_all" on public.sips;

create policy "sips_owner_all" on public.sips for all to authenticated
  using ((select auth.jwt() ->> 'sub') = user_id)
  with check ((select auth.jwt() ->> 'sub') = user_id);
