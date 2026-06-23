# Securing Supabase access (Clerk → Supabase RLS rollout)

## The problem this fixes

The app authenticates with **Clerk** but talks to **Supabase directly from the
browser** using the public publishable key. Until now every table used an open
Row Level Security policy (`using (true)`), so the only thing scoping data to a
user was a client-side `.eq("user_id", ...)` filter.

That filter is trivially bypassable. Anyone could call the Supabase REST API
with the public key and read or delete **every user's** assets, liabilities,
transactions, and contacts. Clerk middleware does **not** protect the Supabase
API (it's a separate host), so it gave no protection.

The fix is to make Supabase trust Clerk's session tokens and to rewrite the RLS
policies to match the Clerk user id (`auth.jwt() ->> 'sub'`).

## Rollout order (do these in sequence — order matters)

Each step is safe on its own and reversible. Do **not** skip ahead, or
authenticated queries can start returning zero rows.

### 1. Configure Clerk → Supabase (dashboards) — _no code/deploy_

1. In **Clerk Dashboard** → use **"Connect with Supabase"** (Integrations). This
   adds the `role: "authenticated"` claim to Clerk session tokens and gives you
   your Clerk **domain** (e.g. `your-app.clerk.accounts.dev`).
2. In **Supabase Dashboard** → **Authentication → Sign In / Up → Third-Party
   Auth** → **Add provider → Clerk**, and paste the Clerk domain.

After this, Supabase will accept Clerk tokens, but nothing has changed for the
running app yet (it still sends no token; policies are still open).

### 2. Set environment variables (Vercel) — _no behavior change yet_

- `SUPABASE_SECRET_KEY` — the server-only secret from Supabase → Project Settings
  → **API Keys** (the new `sb_secret_…` key; the legacy `SUPABASE_SERVICE_ROLE_KEY`
  JWT also works). Required by the cron/server jobs that operate across all users
  (they now fail loudly if it's missing instead of silently falling back to the
  anon key).
- `NEXT_PUBLIC_SUPABASE_CLERK_AUTH` — leave **unset** for now.

### 3. Deploy the code — _still safe_

The Supabase clients only attach the Clerk token when
`NEXT_PUBLIC_SUPABASE_CLERK_AUTH=true`. With it unset, behavior is identical to
today, so this deploy changes nothing at runtime.

### 4. Turn on Clerk tokens

Set `NEXT_PUBLIC_SUPABASE_CLERK_AUTH=true` in Vercel and redeploy. Now every
Supabase request carries the signed-in user's Clerk token. Policies are still
open, so the app keeps working — but requests are now *authenticated*, which is
the prerequisite for the lockdown.

Verify: sign in, confirm the dashboard still loads your data. In the browser
Network tab, requests to `*.supabase.co/rest/v1/*` should carry an
`Authorization: Bearer …` header.

### 5. Apply the RLS migration (the actual lockdown)

Run `supabase/migrations/20260621000000_secure_rls_clerk.sql` **and**
`supabase/migrations/20260622000000_sips.sql` (via the Supabase SQL Editor or
`supabase db push`). These swap the open policies for per-user ones and create
the missing `health_checks` and `sips` tables. Any interim open policies named
`"Users can manage their own …"` are dropped and replaced automatically.

Verify immediately:

- Signed in, your own data still loads and saves.
- The anonymous probe below now returns **zero rows** (it returned everything
  before):

```bash
curl 'https://<project-ref>.supabase.co/rest/v1/assets?select=*' \
  -H "apikey: <publishable_key>"
# expect: []
```

## Rollback

- Problem after step 5? Re-run the open policy temporarily:
  `create policy "tmp_open" on public.assets for all using (true) with check (true);`
  (repeat per table), then investigate.
- Problem after step 4? Set `NEXT_PUBLIC_SUPABASE_CLERK_AUTH=false` and redeploy.

## After rollout

Once verified in production, the `NEXT_PUBLIC_SUPABASE_CLERK_AUTH` flag can be
removed and token-sending made unconditional in
`src/utils/supabase/{client,server}.ts`.
