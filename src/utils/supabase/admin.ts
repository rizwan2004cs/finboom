import { createClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client for trusted server-only jobs (cron, automation)
 * that legitimately operate across all users. It bypasses RLS, so it must NEVER
 * be imported into client code or any route that isn't already authorized.
 *
 * Throws if the service-role key is missing instead of silently falling back to
 * the public anon key — once RLS is locked down, an anon fallback would simply
 * return no rows and the job would appear to "succeed" while doing nothing.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY — required for cross-user server jobs."
    );
  }

  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
