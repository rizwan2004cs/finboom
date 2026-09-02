-- Consistency fixes (schema side of the 2026-09 audit).
--
-- 1. sip_payments.transaction_id: ON DELETE SET NULL → ON DELETE CASCADE.
--    Deleting the auto-created investment expense used to leave the payment
--    row behind with status 'paid' and no transaction, so the SIP checklist,
--    "SIPs due" and "Left after SIPs" all still treated it as paid while the
--    money had vanished from cashflow. The row now goes with its expense.
-- 2. Index party_transactions(settles_transaction_id) — the targeted
--    settlement lookup (parties page, dashboard, cron) filters on it.
-- 3. Every set_updated_at_* trigger fires BEFORE INSERT as well as UPDATE.
--    The client stamps updated_at on some inserts; a row created offline and
--    replayed later kept that stale client time (the column default does not
--    apply when the value is supplied), so other devices whose delta-sync
--    watermark had already moved past it never received the row. transactions
--    and accounts already had this (20260801000000); this makes it uniform.
-- 4. Child profile_id FKs: ON DELETE SET NULL → ON DELETE CASCADE. The
--    profiles page promises "all data for this profile will be deleted";
--    previously the rows survived unassigned and kept counting in crons/emails.
--    The client also deletes children through the offline layer (so IndexedDB
--    matches) — the DB cascade is the server-side guarantee.
--
-- Constraint names are looked up from pg_constraint rather than hard-coded:
-- the FKs were created inline (`references ...`) so their names are
-- auto-generated and may differ between environments.

-- 1. sip_payments.transaction_id → cascade ----------------------------------
do $$
declare
  c record;
begin
  for c in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    join pg_attribute att on att.attrelid = rel.oid and att.attnum = any(con.conkey)
    where con.contype = 'f'
      and nsp.nspname = 'public'
      and rel.relname = 'sip_payments'
      and att.attname = 'transaction_id'
  loop
    execute format('alter table public.sip_payments drop constraint %I', c.conname);
  end loop;

  alter table public.sip_payments
    add constraint sip_payments_transaction_id_fkey
    foreign key (transaction_id) references public.transactions(id) on delete cascade;
end $$;

-- 2. Targeted-settlement index ------------------------------------------------
create index if not exists idx_party_transactions_settles
  on public.party_transactions (settles_transaction_id);

-- 3. updated_at triggers: before insert or update --------------------------------
-- budgets originally got its trigger under a different name
-- (20260509100000: budgets_updated_at); drop it so the row is stamped once.
drop trigger if exists budgets_updated_at on public.budgets;

do $$
declare
  t text;
begin
  foreach t in array array[
    'assets', 'liabilities', 'goals', 'snapshots', 'profiles',
    'parties', 'party_transactions', 'budgets', 'health_checks',
    'sips', 'sip_payments', 'feature_ideas'
  ]
  loop
    execute format(
      'create or replace trigger %I before insert or update on public.%I ' ||
      'for each row execute function update_updated_at_column()',
      'set_updated_at_' || t, t
    );
  end loop;
end $$;

-- 4. profile_id FKs → cascade -------------------------------------------------
do $$
declare
  t text;
  c record;
begin
  foreach t in array array[
    'accounts', 'transactions', 'assets', 'liabilities', 'goals',
    'snapshots', 'budgets', 'sips', 'health_checks'
  ]
  loop
    for c in
      select con.conname
      from pg_constraint con
      join pg_class rel on rel.oid = con.conrelid
      join pg_namespace nsp on nsp.oid = rel.relnamespace
      join pg_attribute att on att.attrelid = rel.oid and att.attnum = any(con.conkey)
      where con.contype = 'f'
        and nsp.nspname = 'public'
        and rel.relname = t
        and att.attname = 'profile_id'
    loop
      execute format('alter table public.%I drop constraint %I', t, c.conname);
    end loop;

    execute format(
      'alter table public.%I add constraint %I foreign key (profile_id) ' ||
      'references public.profiles(id) on delete cascade',
      t, t || '_profile_id_fkey'
    );
  end loop;
end $$;
