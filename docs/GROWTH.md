# Open-sourcing & growing FinBoom

A practical playbook for taking FinBoom public, attracting contributors, and getting it discovered. Work top-to-bottom.

---

## 1. Before you flip the repo to public

- [ ] **Scrub secrets from git history.** `.env*` is gitignored, but double-check nothing was committed earlier:
  ```bash
  git log -p | grep -iE "sk_|service_role|VAPID_PRIVATE|_SECRET|TOKEN" || echo "clean"
  ```
  If anything leaked, **rotate those keys** (Clerk, Supabase, Sanity, VAPID, AI) and scrub history with `git filter-repo` before publishing.
- [ ] Confirm the app still builds: `npm run typecheck && npm run build`.
- [ ] These community files are in place: `LICENSE`, `README.md`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`, `.github/` templates, `.env.example`.
- [ ] Make the repo **Public** (Settings → General → Danger Zone → Change visibility).

## 2. Make the GitHub repo itself sell the project

First impressions happen on the repo page — optimize it:

- [ ] **About box:** add a one-line description + the live URL (`https://finboom-cyan.vercel.app`).
- [ ] **Topics** (Settings/About → Topics): `personal-finance`, `nextjs`, `react`, `typescript`, `pwa`, `offline-first`, `supabase`, `india`, `net-worth`, `fintech`, `tailwindcss`, `financial-calculators`. Topics power GitHub search & "Explore".
- [ ] **Social preview image** (Settings → General → Social preview): upload a 1280×640 banner so links unfurl nicely on X/LinkedIn/Slack. Reuse the journey artwork in `docs/assets/product/`.
- [ ] **Enable Discussions** (Settings → Features) for Q&A and ideas.
- [ ] **Pin the repo** on your GitHub profile.
- [ ] **Cut a release** (`v0.1.0`) with notes — releases show up in feeds and look maintained.
- [ ] Add a short **demo GIF / screenshots** near the top of the README (use the `PRODUCT.md` visuals or a screen recording).
- [ ] Add **"good first issue"** and **"help wanted"** labels and tag 5–10 issues with them (the lint cleanup + Roadmap quick wins are ideal).

## 3. Where to list it (open-source spaces)

**Awesome lists** (open a PR adding FinBoom — highest-quality, long-tail traffic):
- `awesome-nextjs`, `awesome-react`, `awesome-tailwindcss`
- `awesome-selfhosted` (it's a self-hostable PWA)
- personal-finance / fintech awesome lists (e.g. `awesome-financial`, `awesome-personal-finance`)

**Directories & catalogs:**
- [AlternativeTo](https://alternativeto.net) — list it as an alternative to mainstream net-worth/finance apps.
- [LibHunt](https://libhunt.com), [OpenSourceAlternative.to](https://www.opensourcealternative.to), [Awesomeopensource].
- [Open Source Friday](https://opensourcefriday.com), [console.dev](https://console.dev) (submit a tool).
- [Peerlist](https://peerlist.io) Projects (great reach in the Indian dev community).

**Launch platforms (time these as one coordinated launch):**
- [Product Hunt](https://www.producthunt.com) — launch 12:01 AM PT; prep a tagline, gallery (use the journey images), and first comment.
- [Hacker News](https://news.ycombinator.com) — a **"Show HN: FinBoom – open-source net-worth tracker for India"** post; reply to every comment.
- [Lobsters](https://lobste.rs), [Indie Hackers](https://www.indiehackers.com), [Hacker News Show HN].

**Communities (share genuinely, lead with value not spam):**
- Reddit: r/india, r/IndiaInvestments, r/personalfinanceindia, r/selfhosted, r/opensource, r/reactjs, r/nextjs, r/webdev, r/SideProject.
- Dev blogs: write a build/launch post on **dev.to**, **Hashnode**, or **Medium** ("How I built an offline-first finance PWA with Next.js + Supabase") and cross-link the repo.
- X/Twitter + LinkedIn: a thread with the journey screenshots; tag #buildinpublic, #opensource, #nextjs.
- Discord/Slack: Next.js, Supabase, and Indian-dev communities.

> Tip: don't blast everywhere on day one. Do GitHub hygiene → one anchor launch (Show HN **or** Product Hunt) → then ride the momentum into Reddit/awesome-list PRs over the following 2–3 weeks.

## 4. Turn visitors into contributors

- [ ] Keep **good first issues** stocked and well-described (context + pointers to files).
- [ ] **Respond fast** to issues/PRs (even a "thanks, I'll look this week" keeps people engaged).
- [ ] Use clear **labels**: `good first issue`, `help wanted`, `bug`, `enhancement`, `docs`, `area:*`.
- [ ] Adopt **[all-contributors](https://allcontributors.org)** to credit everyone in the README.
- [ ] Participate in **[Hacktoberfest](https://hacktoberfest.com)** (October) — add the topic and curate issues.
- [ ] Write a short **architecture/onboarding** note (you already have `DOCUMENTATION.md` — link it from issues).
- [ ] Add a **CHANGELOG** and thank contributors in release notes.

## 5. Use FinBoom's own growth engine

FinBoom already ships an organic-growth flywheel — lean on it:

- **Free calculators (`/tools`)** and the **blog** are SEO-optimized and public. Keep publishing (the daily blog cron + `npm run blog:new`) to grow search traffic, which funnels to signups and GitHub.
- Make sure `sitemap.xml`, `robots.txt`, and `/feed.xml` are submitted to **Google Search Console**.
- Each blog post and calculator is a shareable artifact — link the repo from them.

## 6. Metrics to watch

- **GitHub:** stars, forks, unique visitors/clones (Insights → Traffic), contributor count.
- **Product:** signups, D7/D30 retention, calculator/blog organic sessions (see `ROADMAP.md → Success Metrics`).
- Celebrate milestones publicly (100 stars, first external PR) — it compounds.

---

*Keep this file updated as you learn what works. The single biggest lever is **showing up consistently**: ship, respond, and share.*
