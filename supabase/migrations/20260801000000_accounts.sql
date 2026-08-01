-- Cash & Bank accounts (Vyapar-style)
-- Every money account (Cash In Hand + user-added bank accounts) for a profile.
-- Balances are never stored: they're derived client-side as
-- opening_balance + Σ income − Σ expense over transactions tagged with the
-- account, so nothing can drift out of sync.

create table if not exists public.accounts (
  id uuid default gen_random_uuid() primary key,
  user_id text not null,
  profile_id uuid references profiles(id) on delete set null,
  name text not null,
  type text not null default 'bank' check (type in ('bank', 'cash')),
  opening_balance numeric not null default 0,
  opening_date date not null default current_date,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Performance + delta-sync indexes
create index if not exists idx_accounts_user_id on public.accounts(user_id);
create index if not exists idx_accounts_updated_at on public.accounts(updated_at);

-- Stamp updated_at server-side on INSERT as well as UPDATE (reuses the shared
-- trigger function): rows created offline are replayed later with a stale
-- client timestamp, and other devices' delta sync (gte updated_at watermark)
-- would miss them until the next full refresh.
create or replace trigger set_updated_at_accounts
  before insert or update on public.accounts
  for each row execute function update_updated_at_column();

-- Same fix for transactions — offline-created transfer legs / entries must be
-- visible to other devices' delta pulls as soon as they replay.
create or replace trigger set_updated_at_transactions
  before insert or update on public.transactions
  for each row execute function update_updated_at_column();

-- Row Level Security — owner-scoped via the Clerk JWT `sub` claim, matching
-- the pattern in 20260621000000_secure_rls_clerk.sql.
alter table public.accounts enable row level security;

drop policy if exists "accounts_owner_all" on public.accounts;

create policy "accounts_owner_all" on public.accounts for all to authenticated
  using ((select auth.jwt() ->> 'sub') = user_id)
  with check ((select auth.jwt() ->> 'sub') = user_id);

-- Tag transactions with the account money moved through ("Paid from" /
-- "Received in"). Nullable so every existing transaction stays valid and
-- account tracking remains optional. Deleting an account unlinks its
-- transactions instead of deleting them.
alter table public.transactions
  add column if not exists account_id uuid references public.accounts(id) on delete set null;

-- Links the two legs of an account-to-account transfer (expense leg out of
-- one account + income leg into the other) so they can be deleted together.
alter table public.transactions
  add column if not exists transfer_group_id uuid;

create index if not exists idx_transactions_account_id on public.transactions(account_id);
create index if not exists idx_transactions_transfer_group_id on public.transactions(transfer_group_id);
