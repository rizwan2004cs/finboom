-- Lock down Row Level Security so each user can only touch their own rows.
--
-- BACKGROUND
-- Earlier policies were created as `for all using (true) with check (true)`,
-- which means ANY holder of the public anon/publishable key (it ships in the
-- browser bundle) could read, modify, or delete EVERY user's financial data
-- straight through the Supabase REST API. The Clerk middleware only guards the
-- Next.js routes, not the Supabase Data API, so it provided no protection here.
--
-- This migration replaces those open policies with per-user policies keyed on
-- the Clerk user id, which arrives in the JWT `sub` claim once Clerk is wired up
-- as a Supabase Third-Party Auth provider (see docs/SECURITY-RLS-ROLLOUT.md).
-- `(select auth.jwt() ->> 'sub')` is wrapped in a subselect so Postgres
-- evaluates it once per statement instead of once per row.
--
-- ⚠️  Do NOT apply this until the Clerk↔Supabase integration is configured and
--     the app is sending Clerk tokens, or every authenticated query will return
--     zero rows. Follow the runbook in docs/SECURITY-RLS-ROLLOUT.md.

-- 1. Make sure the health_checks table actually exists (the app writes to it but
--    it was missing from the applied schema, so saves only ever lived in IndexedDB).
create table if not exists public.health_checks (
  id uuid default gen_random_uuid() primary key,
  user_id text not null,
  profile_id uuid references public.profiles(id) on delete set null,
  has_term_insurance boolean default false,
  term_insurance_cover numeric default 0,
  has_health_insurance boolean default false,
  health_insurance_cover numeric default 0,
  emergency_fund_months numeric default 0,
  monthly_expenses numeric default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_health_checks_user_id on public.health_checks(user_id);
create index if not exists idx_health_checks_updated_at on public.health_checks(updated_at);

create or replace trigger set_updated_at_health_checks
  before update on public.health_checks
  for each row execute function update_updated_at_column();

-- 2. Replace the open policies with per-user policies on every owner-scoped table.
do $$
declare
  t text;
  owned_tables text[] := array[
    'profiles', 'assets', 'liabilities', 'transactions', 'goals',
    'snapshots', 'parties', 'party_transactions', 'budgets',
    'notifications', 'push_subscriptions', 'health_checks'
  ];
begin
  foreach t in array owned_tables loop
    execute format('alter table public.%I enable row level security', t);

    -- Drop both historical permissive policy names if present.
    execute format('drop policy if exists "Users can manage their own %s" on public.%I', t, t);
    execute format('drop policy if exists "Users can manage own %s" on public.%I', t, t);
    execute format('drop policy if exists %I on public.%I', t || '_owner_all', t);

    execute format(
      'create policy %I on public.%I for all to authenticated '
      || 'using ((select auth.jwt() ->> ''sub'') = user_id) '
      || 'with check ((select auth.jwt() ->> ''sub'') = user_id)',
      t || '_owner_all', t
    );
  end loop;
end $$;

-- 3. shared_access is keyed on owner_user_id, so it needs its own policy.
alter table public.shared_access enable row level security;
drop policy if exists "Users can manage their own shared_access" on public.shared_access;
drop policy if exists "Users can manage own shared_access" on public.shared_access;
drop policy if exists "shared_access_owner_all" on public.shared_access;
create policy "shared_access_owner_all" on public.shared_access
  for all to authenticated
  using ((select auth.jwt() ->> 'sub') = owner_user_id)
  with check ((select auth.jwt() ->> 'sub') = owner_user_id);

-- exchange_rates is intentionally left as-is: public read, service-role writes.
