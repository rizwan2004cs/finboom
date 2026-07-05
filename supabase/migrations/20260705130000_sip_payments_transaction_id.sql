-- Link each SIP payment to the auto-created investment expense row.
-- Used by SipMonthChecklist when the user marks a SIP paid for the month.

alter table public.sip_payments
  add column if not exists transaction_id uuid references public.transactions(id) on delete set null;

create index if not exists idx_sip_payments_transaction_id
  on public.sip_payments (transaction_id);
