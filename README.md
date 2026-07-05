# FinBoom

[![CI](https://github.com/rizwan2004cs/finboom/actions/workflows/ci.yml/badge.svg)](https://github.com/rizwan2004cs/finboom/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](./CONTRIBUTING.md)
[![Made with Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org)

> **Know your true wealth.** An offline-first personal finance & net worth tracker built for Indian investors, with a liquid-glass UI inspired by iOS 26.

**Live:** https://finboom-cyan.vercel.app

FinBoom helps you track assets, liabilities, transactions, budgets, and goals across multiple family profiles — fully offline-capable as an installable PWA. It also ships a suite of free public financial calculators and an automated, SEO-optimized finance blog.

---

## Features

- **Net worth dashboard** — assets − liabilities in real time, with trend and allocation charts.
- **Assets** — 22+ Indian asset classes, gain/loss tracking, and **portfolio analytics** (diversification, concentration warnings).
- **Liabilities** — loan/EMI tracking with **EMI-to-income liquidity** insights.
- **Transactions & Budget** — income/expense logging, monthly budgets with auto-suggest and copy-from-last-month.
- **Goals** — inflation-adjusted targets with linked assets.
- **Wealth Check** — a 0–100 multi-dimensional financial health score with personalized actions.
- **Parties** — Splitwise-style lend/borrow tracking with due-date reminders.
- **Profiles** — separate finances for Personal, Spouse, Parent, Child, or Business.
- **Free calculators** (`/tools`) — SIP, Step-Up SIP, Lumpsum, FD, XIRR, HRA, and Income Tax (old vs new regime), each SEO-optimized.
- **Blog** — Sanity-backed, AI-generated, visual-first posts (key takeaways, Mermaid diagrams, comparison tables) with an RSS feed.
- **Offline-first PWA** — IndexedDB cache + mutation queue + service worker; installable with push notifications.
- **Multi-currency** — store in INR, display in 10 currencies with daily exchange rates.

## Tech Stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · Clerk (auth) · Supabase (Postgres + RLS) · TanStack React Query · IndexedDB · Recharts · Mermaid · Sanity.io (CMS) · Gemini/Groq/OpenAI (blog AI) · Web Push · Vercel.

## Getting Started

```bash
yarn install
cp .env.example .env.local   # then fill in the values (see below)
yarn dev
```

Open http://localhost:3000.

### Required environment variables

See [`DOCUMENTATION.md` → Environment Variables](./DOCUMENTATION.md#15-environment-variables) for the full list (Clerk, Supabase, VAPID, Sanity, AI providers, `CRON_SECRET`, `NEXT_PUBLIC_SITE_URL`).

## Scripts

| Script | Purpose |
|--------|---------|
| `yarn dev` | Start the dev server |
| `yarn build` | Production build (stamps the service worker, then `next build`) |
| `yarn start` | Serve the production build |
| `yarn lint` | ESLint |
| `yarn blog:new [topic]` | Generate and publish one new blog post |
| `yarn blog:update [count\|all\|<slugs>]` | Regenerate existing auto-posts into the latest format |
| `yarn blog:regen` | Update the latest auto-post **and** generate a new one |

> The `blog:*` scripts need AI + Sanity write keys in `.env.local` (`GEMINI_API_KEY`/`GROQ_API_KEY`/`OPENAI_API_KEY`, `SANITY_EDITOR_TOKEN`, `NEXT_PUBLIC_SANITY_PROJECT_ID`, `NEXT_PUBLIC_SANITY_DATASET`).

## Deployment

Auto-deploys to **Vercel** on push to `master`. Cron jobs (notifications, exchange rates, monthly snapshot, weekly summary, daily blog post) are defined in `vercel.json`.

## Documentation

- **[PRODUCT.md](./PRODUCT.md)** — the product & user journey (with visuals): personas, the end-to-end flow, and what each stage delivers.
- **[DOCUMENTATION.md](./DOCUMENTATION.md)** — architecture, data model, offline engine, and feature deep-dives.
- **[ROADMAP.md](./ROADMAP.md)** — planned features and known pain points.

## Contributing

Contributions are welcome and appreciated! 🙌 Whether it's code, docs, design, or bug reports — start with the **[Contributing Guide](./CONTRIBUTING.md)**.

- Good first issues: clearing the new React Compiler lint findings (`yarn lint`) and the "Quick Wins" in the [Roadmap](./ROADMAP.md).
- Be kind — we follow a [Code of Conduct](./CODE_OF_CONDUCT.md).
- Found a security issue? See the [Security Policy](./SECURITY.md).

If FinBoom is useful to you, please consider **starring the repo** ⭐ — it genuinely helps others discover it.

## License

[MIT](./LICENSE) © Rizwan and FinBoom contributors.
