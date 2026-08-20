-- Targeted settlement for party transactions.
-- A repayment (received_back / paid_back) created via an entry's "Settle"
-- button records WHICH lent/borrowed entry it settles. Without this link,
-- repayments were allocated FIFO (oldest obligation first), so settling a
-- specific overdue entry could leave it "unsettled" because the money was
-- absorbed by an older open entry.

alter table public.party_transactions
  add column if not exists settles_transaction_id uuid
    references public.party_transactions(id) on delete set null;
