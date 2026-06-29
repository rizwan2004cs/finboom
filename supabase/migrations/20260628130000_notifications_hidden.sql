-- Sticky "clear": hide notifications instead of deleting them.
--
-- Problem: "Clear all" deleted notification rows, which also wiped the dedupe
-- memory. The next time the bell was opened (or the daily cron ran), the
-- generator saw "no existing notification" and recreated the same alerts, so
-- cleared notifications came back "again and again". The (user_id, dedupe_key)
-- unique index from the prior migration prevents duplicate ROWS, but only while
-- the rows exist — deleting them defeated it.
--
-- Fix: clearing now sets hidden = true (a tombstone). The rows stay, so:
--   * the upsert's (user_id, dedupe_key) ON CONFLICT DO NOTHING still matches ->
--     no new row is created;
--   * the generator's in-memory "already notified" check still sees them ->
--     the candidate is skipped entirely (no insert, no push).
-- Daily types (overdue_payment / due_approaching / sip_reminder) re-fire the
-- next day because their dedupe_key includes the day; ever types
-- (goal_milestone / large_transaction / budget_exceeded) stay dismissed.
-- The bell reads with a client-side `!hidden` filter so tombstones are invisible.

alter table public.notifications
  add column if not exists hidden boolean not null default false;

create index if not exists idx_notifications_user_hidden
  on public.notifications (user_id, hidden);

-- One-time prune of any stale tombstones. Ongoing pruning runs once daily in
-- the notifications cron route.
delete from public.notifications
  where hidden = true and created_at < now() - interval '45 days';
