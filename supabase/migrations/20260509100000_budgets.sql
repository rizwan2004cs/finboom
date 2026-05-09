-- Monthly Budgets table
-- Stores per-category expense budgets for each month

create table if not exists budgets (
  id uuid default gen_random_uuid() primary key,
  user_id text not null,
  profile_id uuid references profiles(id) on delete set null,
  month text not null,          -- "YYYY-MM" format, e.g. "2026-05"
  category text not null,       -- matches EXPENSE_CATEGORIES ids
  amount numeric not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Prevent duplicate budget entries for same user+profile+month+category
create unique index if not exists budgets_unique_entry
  on budgets (user_id, profile_id, month, category);

-- Performance indexes
create index if not exists budgets_user_id_idx on budgets (user_id);
create index if not exists budgets_updated_at_idx on budgets (updated_at);
create index if not exists budgets_month_idx on budgets (user_id, profile_id, month);

-- Auto-update updated_at on modification (reuses existing trigger function)
create trigger budgets_updated_at
  before update on budgets
  for each row execute function update_updated_at_column();

-- Enable RLS
alter table budgets enable row level security;

-- RLS policy (matches existing pattern — open policies with Clerk middleware auth)
create policy "Users can manage their own budgets" on budgets
  for all using (true) with check (true);
