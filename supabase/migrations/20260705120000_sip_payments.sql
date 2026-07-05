-- Track which SIPs were fulfilled (debited/paid) in each calendar month.
-- One row per (sip_id, month) lets users mark individual SIPs complete without
-- guessing from a lump-sum "investment" expense.

create table if not exists public.sip_payments (
  id uuid default gen_random_uuid() primary key,
  user_id text not null,
  sip_id uuid not null references public.sips(id) on delete cascade,
  month text not null check (month ~ '^\d{4}-\d{2}$'),
  paid_date date not null default current_date,
  amount numeric,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create unique index if not exists sip_payments_unique_sip_month
  on public.sip_payments (sip_id, month);

create index if not exists idx_sip_payments_user_id on public.sip_payments(user_id);
create index if not exists idx_sip_payments_updated_at on public.sip_payments(updated_at);

create or replace trigger set_updated_at_sip_payments
  before update on public.sip_payments
  for each row execute function update_updated_at_column();

alter table public.sip_payments enable row level security;

drop policy if exists "sip_payments_owner_all" on public.sip_payments;
create policy "sip_payments_owner_all" on public.sip_payments for all to authenticated
  using ((select auth.jwt() ->> 'sub') = user_id)
  with check ((select auth.jwt() ->> 'sub') = user_id);
