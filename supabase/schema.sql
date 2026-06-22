-- FinBoom Database Schema
-- Run this in Supabase SQL Editor (https://supabase.com/dashboard → SQL Editor)

-- Enable UUID generation
create extension if not exists "uuid-ossp";

-- Profiles table
create table if not exists profiles (
  id uuid default uuid_generate_v4() primary key,
  user_id text not null,
  name text not null,
  type text not null check (type in ('personal', 'spouse', 'parent', 'child', 'business')),
  is_default boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Assets table
create table if not exists assets (
  id uuid default uuid_generate_v4() primary key,
  user_id text not null,
  profile_id uuid references profiles(id) on delete set null,
  name text not null,
  asset_class text not null,
  current_value numeric not null default 0,
  invested_value numeric not null default 0,
  currency text not null default 'INR',
  units numeric,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Liabilities table
create table if not exists liabilities (
  id uuid default uuid_generate_v4() primary key,
  user_id text not null,
  profile_id uuid references profiles(id) on delete set null,
  name text not null,
  liability_type text not null,
  outstanding_amount numeric not null default 0,
  original_amount numeric not null default 0,
  interest_rate numeric not null default 0,
  emi_amount numeric,
  currency text not null default 'INR',
  start_date date,
  end_date date,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Transactions table
create table if not exists transactions (
  id uuid default uuid_generate_v4() primary key,
  user_id text not null,
  profile_id uuid references profiles(id) on delete set null,
  type text not null check (type in ('income', 'expense')),
  category text not null,
  amount numeric not null default 0,
  currency text not null default 'INR',
  description text,
  date date not null default current_date,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Goals table
create table if not exists goals (
  id uuid default uuid_generate_v4() primary key,
  user_id text not null,
  profile_id uuid references profiles(id) on delete set null,
  name text not null,
  target_amount numeric not null default 0,
  current_amount numeric not null default 0,
  currency text not null default 'INR',
  target_date date not null,
  inflation_rate numeric not null default 6,
  linked_assets text[] default '{}',
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Snapshots table
create table if not exists snapshots (
  id uuid default uuid_generate_v4() primary key,
  user_id text not null,
  profile_id uuid references profiles(id) on delete set null,
  total_assets numeric not null default 0,
  total_liabilities numeric not null default 0,
  net_worth numeric not null default 0,
  asset_breakdown jsonb default '{}',
  currency text not null default 'INR',
  snapshot_date date not null default current_date,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Health Check data (insurance, emergency fund) for the Wealth Check score
create table if not exists health_checks (
  id uuid default uuid_generate_v4() primary key,
  user_id text not null,
  profile_id uuid references profiles(id) on delete set null,
  has_term_insurance boolean default false,
  term_insurance_cover numeric default 0,
  has_health_insurance boolean default false,
  health_insurance_cover numeric default 0,
  emergency_fund_months numeric default 0,
  monthly_expenses numeric default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Shared Access table
create table if not exists shared_access (
  id uuid default uuid_generate_v4() primary key,
  profile_id uuid references profiles(id) on delete cascade,
  owner_user_id text not null,
  shared_with_email text not null,
  permission text not null check (permission in ('view', 'edit')),
  created_at timestamptz default now()
);

-- Parties table
create table if not exists parties (
  id uuid default uuid_generate_v4() primary key,
  user_id text not null,
  name text not null,
  phone text,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Party Transactions table
create table if not exists party_transactions (
  id uuid default uuid_generate_v4() primary key,
  user_id text not null,
  party_id uuid not null references parties(id) on delete cascade,
  type text not null check (type in ('lent', 'received_back', 'borrowed', 'paid_back')),
  amount numeric not null default 0,
  currency text not null default 'INR',
  date date not null default current_date,
  due_date date,
  notes text,
  linked_transaction_id uuid references transactions(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Budgets table
create table if not exists budgets (
  id uuid default uuid_generate_v4() primary key,
  user_id text not null,
  profile_id uuid references profiles(id) on delete set null,
  month text not null,
  category text not null,
  amount numeric not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create unique index if not exists budgets_unique_entry
  on budgets (user_id, profile_id, month, category);

-- Auto-update trigger for updated_at
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create or replace trigger set_updated_at_assets before update on assets for each row execute function update_updated_at_column();
create or replace trigger set_updated_at_liabilities before update on liabilities for each row execute function update_updated_at_column();
create or replace trigger set_updated_at_transactions before update on transactions for each row execute function update_updated_at_column();
create or replace trigger set_updated_at_goals before update on goals for each row execute function update_updated_at_column();
create or replace trigger set_updated_at_snapshots before update on snapshots for each row execute function update_updated_at_column();
create or replace trigger set_updated_at_profiles before update on profiles for each row execute function update_updated_at_column();
create or replace trigger set_updated_at_parties before update on parties for each row execute function update_updated_at_column();
create or replace trigger set_updated_at_party_transactions before update on party_transactions for each row execute function update_updated_at_column();
create or replace trigger set_updated_at_budgets before update on budgets for each row execute function update_updated_at_column();
create or replace trigger set_updated_at_health_checks before update on health_checks for each row execute function update_updated_at_column();

-- Indexes for fast lookups
create index if not exists idx_assets_user_id on assets(user_id);
create index if not exists idx_liabilities_user_id on liabilities(user_id);
create index if not exists idx_transactions_user_id on transactions(user_id);
create index if not exists idx_goals_user_id on goals(user_id);
create index if not exists idx_snapshots_user_id on snapshots(user_id);
create index if not exists idx_profiles_user_id on profiles(user_id);

create index if not exists idx_parties_user_id on parties(user_id);
create index if not exists idx_party_transactions_user_id on party_transactions(user_id);
create index if not exists idx_party_transactions_party_id on party_transactions(party_id);
create index if not exists idx_party_transactions_due_date on party_transactions(due_date);

create index if not exists idx_budgets_user_id on budgets(user_id);
create index if not exists idx_budgets_month on budgets(user_id, profile_id, month);

create index if not exists idx_health_checks_user_id on health_checks(user_id);
create index if not exists idx_health_checks_updated_at on health_checks(updated_at);

-- Indexes for delta sync
create index if not exists idx_assets_updated_at on assets(updated_at);
create index if not exists idx_liabilities_updated_at on liabilities(updated_at);
create index if not exists idx_transactions_updated_at on transactions(updated_at);
create index if not exists idx_goals_updated_at on goals(updated_at);
create index if not exists idx_snapshots_updated_at on snapshots(updated_at);
create index if not exists idx_profiles_updated_at on profiles(updated_at);
create index if not exists idx_parties_updated_at on parties(updated_at);
create index if not exists idx_party_transactions_updated_at on party_transactions(updated_at);
create index if not exists idx_budgets_updated_at on budgets(updated_at);

-- Row Level Security (RLS)
-- Every row is scoped to its owner via the Clerk user id, which arrives in the
-- JWT `sub` claim once Clerk is configured as a Supabase Third-Party Auth
-- provider and the app sends Clerk tokens. See docs/SECURITY-RLS-ROLLOUT.md.
-- (auth.jwt() ->> 'sub') is wrapped in a subselect so it is evaluated once per
-- statement rather than once per row.
alter table assets enable row level security;
alter table liabilities enable row level security;
alter table transactions enable row level security;
alter table goals enable row level security;
alter table snapshots enable row level security;
alter table profiles enable row level security;
alter table shared_access enable row level security;
alter table parties enable row level security;
alter table party_transactions enable row level security;
alter table budgets enable row level security;
alter table health_checks enable row level security;

create policy "assets_owner_all" on assets for all to authenticated
  using ((select auth.jwt() ->> 'sub') = user_id) with check ((select auth.jwt() ->> 'sub') = user_id);

create policy "liabilities_owner_all" on liabilities for all to authenticated
  using ((select auth.jwt() ->> 'sub') = user_id) with check ((select auth.jwt() ->> 'sub') = user_id);

create policy "transactions_owner_all" on transactions for all to authenticated
  using ((select auth.jwt() ->> 'sub') = user_id) with check ((select auth.jwt() ->> 'sub') = user_id);

create policy "goals_owner_all" on goals for all to authenticated
  using ((select auth.jwt() ->> 'sub') = user_id) with check ((select auth.jwt() ->> 'sub') = user_id);

create policy "snapshots_owner_all" on snapshots for all to authenticated
  using ((select auth.jwt() ->> 'sub') = user_id) with check ((select auth.jwt() ->> 'sub') = user_id);

create policy "profiles_owner_all" on profiles for all to authenticated
  using ((select auth.jwt() ->> 'sub') = user_id) with check ((select auth.jwt() ->> 'sub') = user_id);

create policy "shared_access_owner_all" on shared_access for all to authenticated
  using ((select auth.jwt() ->> 'sub') = owner_user_id) with check ((select auth.jwt() ->> 'sub') = owner_user_id);

create policy "parties_owner_all" on parties for all to authenticated
  using ((select auth.jwt() ->> 'sub') = user_id) with check ((select auth.jwt() ->> 'sub') = user_id);

create policy "party_transactions_owner_all" on party_transactions for all to authenticated
  using ((select auth.jwt() ->> 'sub') = user_id) with check ((select auth.jwt() ->> 'sub') = user_id);

create policy "budgets_owner_all" on budgets for all to authenticated
  using ((select auth.jwt() ->> 'sub') = user_id) with check ((select auth.jwt() ->> 'sub') = user_id);

create policy "health_checks_owner_all" on health_checks for all to authenticated
  using ((select auth.jwt() ->> 'sub') = user_id) with check ((select auth.jwt() ->> 'sub') = user_id);
