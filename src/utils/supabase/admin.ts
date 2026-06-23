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
/**
 * Resolve the Supabase secret used for RLS-bypassing server jobs. Accepts either
 * the legacy service-role JWT (`SUPABASE_SERVICE_ROLE_KEY`) or the newer Supabase
 * secret key (`SUPABASE_SECRET_KEY`, `sb_secret_…`). This project uses the new
 * publishable/secret key format, so server jobs should prefer `SUPABASE_SECRET_KEY`.
 */
export function getSupabaseSecretKey(): string | undefined {
  return process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;
}

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = getSupabaseSecretKey();

  if (!url || !secretKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or a Supabase secret key " +
        "(set SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY) — required for cross-user server jobs."
    );
  }

  return createClient(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
