-- Exchange rates cache table (updated daily by cron)
-- All rates are relative to INR (base currency)
create table if not exists public.exchange_rates (
  base_currency text not null default 'INR',
  target_currency text not null,
  rate numeric not null,
  fetched_at timestamptz not null default now(),
  primary key (base_currency, target_currency)
);

-- Allow anyone to read (no user_id, it's global data)
alter table public.exchange_rates enable row level security;

create policy "Anyone can read exchange rates"
  on public.exchange_rates for select
  using (true);

-- Only service role can insert/update (cron job)
create policy "Service role can manage exchange rates"
  on public.exchange_rates for all
  using (auth.role() = 'service_role');
