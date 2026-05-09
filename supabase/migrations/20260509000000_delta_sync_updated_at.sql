-- Add updated_at columns to tables missing them and create auto-update triggers
-- for delta sync support.

-- 1. Create the trigger function (reusable across all tables)
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- 2. Add updated_at to tables that don't have it yet
alter table transactions add column if not exists updated_at timestamptz default now();
alter table snapshots    add column if not exists updated_at timestamptz default now();
alter table profiles     add column if not exists updated_at timestamptz default now();
alter table parties      add column if not exists updated_at timestamptz default now();
alter table party_transactions add column if not exists updated_at timestamptz default now();

-- 3. Backfill: set updated_at = created_at for existing rows (so they get picked up on first delta sync)
update transactions      set updated_at = coalesce(created_at, now()) where updated_at is null;
update snapshots         set updated_at = coalesce(created_at, now()) where updated_at is null;
update profiles          set updated_at = coalesce(created_at, now()) where updated_at is null;
update parties           set updated_at = coalesce(created_at, now()) where updated_at is null;
update party_transactions set updated_at = coalesce(created_at, now()) where updated_at is null;

-- 4. Create auto-update triggers on ALL data tables
-- (assets, liabilities, goals already have updated_at column but no trigger)
create or replace trigger set_updated_at_assets
  before update on assets for each row execute function update_updated_at_column();

create or replace trigger set_updated_at_liabilities
  before update on liabilities for each row execute function update_updated_at_column();

create or replace trigger set_updated_at_transactions
  before update on transactions for each row execute function update_updated_at_column();

create or replace trigger set_updated_at_goals
  before update on goals for each row execute function update_updated_at_column();

create or replace trigger set_updated_at_snapshots
  before update on snapshots for each row execute function update_updated_at_column();

create or replace trigger set_updated_at_profiles
  before update on profiles for each row execute function update_updated_at_column();

create or replace trigger set_updated_at_parties
  before update on parties for each row execute function update_updated_at_column();

create or replace trigger set_updated_at_party_transactions
  before update on party_transactions for each row execute function update_updated_at_column();

-- 5. Add indexes on updated_at for fast delta queries
create index if not exists idx_assets_updated_at on assets(updated_at);
create index if not exists idx_liabilities_updated_at on liabilities(updated_at);
create index if not exists idx_transactions_updated_at on transactions(updated_at);
create index if not exists idx_goals_updated_at on goals(updated_at);
create index if not exists idx_snapshots_updated_at on snapshots(updated_at);
create index if not exists idx_profiles_updated_at on profiles(updated_at);
create index if not exists idx_parties_updated_at on parties(updated_at);
create index if not exists idx_party_transactions_updated_at on party_transactions(updated_at);
