-- Backfill profile_id on existing health_checks rows.
--
-- The app now scopes the Financial Health Check per profile (each family member
-- keeps their own insurance / emergency-fund record). Rows created before this
-- change have a NULL profile_id and would otherwise "disappear" from the
-- profile-filtered view. Attach each orphaned row to the user's default profile
-- (falling back to their earliest-created profile).

update public.health_checks h
set profile_id = sub.pid
from (
  select
    user_id,
    (array_agg(id order by is_default desc, created_at asc))[1] as pid
  from public.profiles
  group by user_id
) sub
where h.profile_id is null
  and sub.user_id = h.user_id;
