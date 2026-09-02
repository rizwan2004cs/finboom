-- SIP month rows can now be "skipped" (no expense created) as well as "paid".
alter table public.sip_payments
  add column if not exists status text not null default 'paid'
  check (status in ('paid', 'skipped'));
