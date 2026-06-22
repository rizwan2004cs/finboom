import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

// When enabled, every Supabase request carries the signed-in user's Clerk token
// so Postgres RLS can scope rows to `auth.jwt() ->> 'sub'`. Kept behind a flag
// so it can be rolled out safely alongside the Supabase Third-Party Auth setup
// and the RLS migration. See docs/SECURITY-RLS-ROLLOUT.md.
const useClerkAuth = process.env.NEXT_PUBLIC_SUPABASE_CLERK_AUTH === "true";

type ClerkGlobal = typeof globalThis & {
  Clerk?: { session?: { getToken: () => Promise<string | null> } };
};

async function getClerkToken(): Promise<string | null> {
  const clerk = (globalThis as ClerkGlobal).Clerk;
  if (!clerk) return null;
  try {
    return (await clerk.session?.getToken()) ?? null;
  } catch {
    return null;
  }
}

export const createClient = () =>
  createBrowserClient(supabaseUrl!, supabaseKey!, {
    ...(useClerkAuth ? { accessToken: getClerkToken } : {}),
  });
