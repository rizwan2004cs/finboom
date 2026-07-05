-- Repair sip_payments RLS + grants (fixes "new row violates row-level security policy").
-- Run this if Mark paid fails after creating the table manually or if policies were skipped.

-- Ensure table + column exist (idempotent).
create table if not exists public.sip_payments (
  id uuid default gen_random_uuid() primary key,
  user_id text not null,
  sip_id uuid not null references public.sips(id) on delete cascade,
  month text not null check (month ~ '^\d{4}-\d{2}$'),
  paid_date date not null default current_date,
  amount numeric,
  transaction_id uuid references public.transactions(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.sip_payments
  add column if not exists transaction_id uuid references public.transactions(id) on delete set null;

create unique index if not exists sip_payments_unique_sip_month
  on public.sip_payments (sip_id, month);

create index if not exists idx_sip_payments_user_id on public.sip_payments(user_id);
create index if not exists idx_sip_payments_updated_at on public.sip_payments(updated_at);
create index if not exists idx_sip_payments_transaction_id on public.sip_payments (transaction_id);

-- Supabase roles need explicit table grants on manually-created tables.
grant select, insert, update, delete on public.sip_payments to authenticated;
grant all on public.sip_payments to service_role;

alter table public.sip_payments enable row level security;

drop policy if exists "Users can manage their own sip_payments" on public.sip_payments;
drop policy if exists "Users can manage own sip_payments" on public.sip_payments;
drop policy if exists "sip_payments_owner_all" on public.sip_payments;

create policy "sip_payments_owner_all" on public.sip_payments
  for all to authenticated
  using ((select auth.jwt() ->> 'sub') = user_id)
  with check ((select auth.jwt() ->> 'sub') = user_id);
