-- Make notifications duplicate-safe at the database level.
--
-- The generator does a read-then-write (prefetch existing -> check in memory ->
-- insert) and is called concurrently from two places: the daily cron (all
-- users, admin client) and the in-app bell check (per user, on mount + every
-- time the bell is opened). Without a uniqueness backstop, two concurrent calls
-- for the same user both observe "no existing notification" and both insert,
-- producing duplicate notification rows -- and each duplicate row drives its own
-- push delivery, so the user sees several pushes for a single logical alert.
--
-- `dedupe_key` is computed by the app for every notification:
--   daily types -> `type|id|YYYY-MM-DD`  (one per IST day)
--   ever types  -> `type|id`             (once, all-time)
-- The unique index on (user_id, dedupe_key) is the conflict target for an
-- upsert(..., { ignoreDuplicates: true }), so duplicates are silently dropped
-- instead of inserted, and only truly-new rows are pushed.

alter table public.notifications
  add column if not exists dedupe_key text;

-- Pre-existing rows have NULL dedupe_key. Postgres treats NULLs as distinct in
-- a unique index, so they coexist without conflict; new rows always carry a key.
create unique index if not exists notifications_unique_user_dedupe
  on public.notifications (user_id, dedupe_key);

-- Remove duplicates that already landed before this guard existed, keeping the
-- newest row per (user_id, type, data). `data` is jsonb and supports equality,
-- so it partitions correctly. Every notification type in the app stores an
-- identifying field (party_id / sip_id / transaction_id / goal_id+milestone /
-- budget_id+period) in `data`, so this grouping is lossless for real alerts.
with ranked as (
  select id,
         row_number() over (
           partition by user_id, type, data
           order by created_at desc nulls last, id desc
         ) as rn
  from public.notifications
)
delete from public.notifications n
where n.id in (select id from ranked where rn > 1);
