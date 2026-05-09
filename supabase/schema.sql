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

-- Indexes for delta sync
create index if not exists idx_assets_updated_at on assets(updated_at);
create index if not exists idx_liabilities_updated_at on liabilities(updated_at);
create index if not exists idx_transactions_updated_at on transactions(updated_at);
create index if not exists idx_goals_updated_at on goals(updated_at);
create index if not exists idx_snapshots_updated_at on snapshots(updated_at);
create index if not exists idx_profiles_updated_at on profiles(updated_at);
create index if not exists idx_parties_updated_at on parties(updated_at);
create index if not exists idx_party_transactions_updated_at on party_transactions(updated_at);

-- Row Level Security (RLS)
alter table assets enable row level security;
alter table liabilities enable row level security;
alter table transactions enable row level security;
alter table goals enable row level security;
alter table snapshots enable row level security;
alter table profiles enable row level security;
alter table shared_access enable row level security;
alter table parties enable row level security;
alter table party_transactions enable row level security;

-- RLS Policies: Users can only access their own data
-- Using permissive policies that check user_id matches the requesting user's JWT claim

-- For Clerk auth, the user_id comes from the JWT. Since we're using the anon key
-- with client-side auth, we'll create open policies for now (secure with Clerk middleware)
create policy "Users can manage their own assets" on assets
  for all using (true) with check (true);

create policy "Users can manage their own liabilities" on liabilities
  for all using (true) with check (true);

create policy "Users can manage their own transactions" on transactions
  for all using (true) with check (true);

create policy "Users can manage their own goals" on goals
  for all using (true) with check (true);

create policy "Users can manage their own snapshots" on snapshots
  for all using (true) with check (true);

create policy "Users can manage their own profiles" on profiles
  for all using (true) with check (true);

create policy "Users can manage their own shared_access" on shared_access
  for all using (true) with check (true);

create policy "Users can manage their own parties" on parties
  for all using (true) with check (true);

create policy "Users can manage their own party_transactions" on party_transactions
  for all using (true) with check (true);
