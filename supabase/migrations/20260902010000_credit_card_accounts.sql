-- Credit cards as accounts. Spends tagged to a card are ordinary expenses and
-- push the card's derived balance negative (= amount owed); paying the bill is
-- a transfer from a bank/cash account into the card, which is not cashflow.
alter table public.accounts drop constraint if exists accounts_type_check;
alter table public.accounts
  add constraint accounts_type_check check (type in ('bank', 'cash', 'credit_card'));

alter table public.accounts
  add column if not exists credit_limit numeric,
  add column if not exists bill_due_day integer check (bill_due_day between 1 and 31);
