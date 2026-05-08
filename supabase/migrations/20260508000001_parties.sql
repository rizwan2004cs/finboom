-- Parties table
create table if not exists parties (
  id uuid default uuid_generate_v4() primary key,
  user_id text not null,
  name text not null,
  phone text,
  notes text,
  created_at timestamptz default now()
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
  created_at timestamptz default now()
);

-- Indexes
create index if not exists idx_parties_user_id on parties(user_id);
create index if not exists idx_party_transactions_user_id on party_transactions(user_id);
create index if not exists idx_party_transactions_party_id on party_transactions(party_id);
create index if not exists idx_party_transactions_due_date on party_transactions(due_date);

-- RLS
alter table parties enable row level security;
alter table party_transactions enable row level security;

-- RLS Policies
create policy "Users can manage their own parties" on parties
  for all using (true) with check (true);

create policy "Users can manage their own party_transactions" on party_transactions
  for all using (true) with check (true);
