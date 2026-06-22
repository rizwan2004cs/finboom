import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { auth } from "@clerk/nextjs/server";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

// See docs/SECURITY-RLS-ROLLOUT.md. When enabled, server-side Supabase requests
// carry the request's Clerk token so they satisfy per-user RLS policies.
const useClerkAuth = process.env.NEXT_PUBLIC_SUPABASE_CLERK_AUTH === "true";

async function getClerkToken(): Promise<string | null> {
  try {
    const { getToken } = await auth();
    return (await getToken()) ?? null;
  } catch {
    return null;
  }
}

export const createClient = (cookieStore: Awaited<ReturnType<typeof cookies>>) => {
  return createServerClient(supabaseUrl!, supabaseKey!, {
    ...(useClerkAuth ? { accessToken: getClerkToken } : {}),
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
        } catch {
          // The `setAll` method was called from a Server Component.
          // This can be ignored if you have middleware refreshing
          // user sessions.
        }
      },
    },
  });
};
