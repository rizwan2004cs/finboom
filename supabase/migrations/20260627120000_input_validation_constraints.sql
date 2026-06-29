-- Server-side input validation + the snapshots same-day uniqueness that the
-- client upsert relies on. The client now validates phone / amount / dates, but
-- the DB must also reject bad rows so a bypassed/legacy/stale client can never
-- persist invalid data (defense in depth).
--
-- CHECK constraints are added NOT VALID so existing rows that violate them are
-- left untouched (we don't silently rewrite or delete user history); new
-- inserts/updates are still fully enforced.

-- 1. parties.phone — normalise to digits-only, then enforce 6–15 digits.
update parties
  set phone = regexp_replace(phone, '[^0-9]', '', 'g')
  where phone is not null;

-- Drop phones that became empty after stripping non-digits.
update parties
  set phone = null
  where phone is not null and phone = '';

alter table parties
  add constraint parties_phone_digits_check
  check (phone is null or phone ~ '^[0-9]{6,15}$') not valid;

-- 2. transactions.amount — must be strictly positive (0 / negative are invalid).
alter table transactions
  add constraint transactions_amount_positive_check
  check (amount > 0) not valid;

-- 3. party_transactions.amount — must be strictly positive.
alter table party_transactions
  add constraint party_transactions_amount_positive_check
  check (amount > 0) not valid;

-- 4. party_transactions.due_date — a due date can't precede the transaction date.
alter table party_transactions
  add constraint party_transactions_due_date_order_check
  check (due_date is null or due_date >= date) not valid;

-- 5. sips.amount — must be strictly positive.
alter table sips
  add constraint sips_amount_positive_check
  check (amount > 0) not valid;

-- 6. snapshots — one row per (profile_id, snapshot_date) so a same-day re-take
--    overwrites instead of stacking duplicates. First drop the duplicates that
--    the old find-then-insert logic could leave behind (keep the newest), then
--    create the unique index the client upserts against.
with ranked as (
  select id,
         row_number() over (
           partition by profile_id, snapshot_date
           order by updated_at desc nulls last, created_at desc nulls last
         ) as rn
  from snapshots
  where profile_id is not null
)
delete from snapshots s
where s.id in (select id from ranked where rn > 1);

-- Postgres treats NULLs as distinct in a unique index, so snapshots with a null
-- profile_id (e.g. after a profile delete) won't collide with each other.
create unique index if not exists snapshots_unique_profile_date
  on snapshots (profile_id, snapshot_date);
