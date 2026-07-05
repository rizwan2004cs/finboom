# FinBoom — Application Documentation

> **A comprehensive personal finance & net worth tracker for Indian investors.**
> Built as an offline-first Progressive Web App (PWA) with a liquid-glass UI inspired by iOS 26.
> Live: https://finboom-cyan.vercel.app

---

## Table of Contents

1. [Tech Stack Overview](#1-tech-stack-overview)
2. [Architecture Diagram](#2-architecture-diagram)
3. [Project Structure](#3-project-structure)
4. [Database Schema](#4-database-schema)
5. [Feature → Library Mapping](#5-feature--library-mapping)
6. [Features Deep Dive](#6-features-deep-dive)
7. [Offline-First Architecture](#7-offline-first-architecture)
8. [Authentication Flow](#8-authentication-flow)
9. [Currency Conversion System](#9-currency-conversion-system)
10. [Push Notifications](#10-push-notifications)
11. [Blog / CMS](#11-blog--cms)
12. [PWA & Service Worker](#12-pwa--service-worker)
13. [SEO & Metadata](#13-seo--metadata)
14. [Deployment & CI/CD](#14-deployment--cicd)
15. [Environment Variables](#15-environment-variables)
16. [Commit History & Changelog](#16-commit-history--changelog)

---

## 1. Tech Stack Overview

| Layer              | Technology                         | Purpose                                      |
|--------------------|------------------------------------|----------------------------------------------|
| **Framework**      | Next.js 16.2.6 (App Router)       | Server/client rendering, routing, API routes |
| **Language**       | TypeScript 5.x                     | Type safety across the codebase              |
| **UI Library**     | React 19.2.4                       | Component rendering                          |
| **Styling**        | Tailwind CSS 4.x                   | Utility-first CSS, liquid glass design       |
| **Auth**           | Clerk (`@clerk/nextjs` 7.x)        | User authentication, session management      |
| **Database**       | Supabase (PostgreSQL)              | Cloud data storage with RLS                  |
| **Supabase Client**| `@supabase/supabase-js` 2.x + `@supabase/ssr` | Server & client DB queries          |
| **State/Cache**    | TanStack React Query 5.x           | Server state, caching, background refetch    |
| **Offline Storage**| IndexedDB (raw API)                | Client-side data persistence                 |
| **Charts**         | Recharts 3.x                       | Line charts, pie charts, area charts         |
| **Diagrams**       | Mermaid 11.x                        | Rendering diagrams in blog posts             |
| **Icons**          | Lucide React 1.x                   | Consistent icon set across all pages         |
| **CMS**            | Sanity.io (`next-sanity` 12.x)     | Blog content management (headless CMS)       |
| **Blog AI**        | Gemini (`@google/generative-ai`) + Groq/OpenAI (REST) | AI blog generation with provider fallback |
| **Push**           | Web Push API (`web-push` 3.x)      | Server-side push notification delivery       |
| **Excel Import**   | SheetJS (`xlsx` 0.18.x)            | Parse Zerodha/Groww/CSV Excel exports        |
| **CSS Utilities**  | `clsx` + `tailwind-merge` + `class-variance-authority` | Conditional, conflict-free, variant class merging |
| **Hosting**        | Vercel                             | Deployment, serverless functions, cron jobs  |
| **Exchange Rates** | fawazahmed0/exchange-api (free)    | Daily currency conversion rates, no API key  |

---

## 2. Architecture Diagram

```
┌──────────────────────────────────────────────────────────────┐
│                         CLIENT (Browser)                      │
│                                                                │
│  ┌──────────┐   ┌──────────────┐   ┌──────────────────────┐  │
│  │  React    │   │ TanStack     │   │  IndexedDB           │  │
│  │  Pages    │──▶│ React Query  │──▶│  (Offline Cache)     │  │
│  │  (App     │   │  (Cache +    │   │  - All tables        │  │
│  │   Router) │   │   Dedup)     │   │  - Mutation queue    │  │
│  └──────────┘   └──────────────┘   └──────────────────────┘  │
│       │                │                      │                │
│       │         ┌──────┴──────┐       ┌───────┴──────┐        │
│       │         │ Online?     │       │ Service      │        │
│       │         │ Yes → API   │       │ Worker       │        │
│       │         │ No → IDB    │       │ (Precache +  │        │
│       │         └─────────────┘       │  Offline)    │        │
│       │                                └──────────────┘        │
└───────┼────────────────────────────────────────────────────────┘
        │
        ▼
┌──────────────────────────────────────────────────────────────┐
│                      VERCEL (Server)                          │
│                                                                │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────┐  │
│  │ Clerk        │  │ API Routes   │  │ Cron Jobs          │  │
│  │ Middleware   │  │ /api/...     │  │ - notifications     │  │
│  │ (Auth Gate)  │  │              │  │ - exchange-rates    │  │
│  └──────────────┘  └──────────────┘  └────────────────────┘  │
└───────┬───────────────────┬──────────────────┬────────────────┘
        │                   │                  │
        ▼                   ▼                  ▼
┌──────────────┐  ┌──────────────┐   ┌──────────────────────┐
│ Clerk API    │  │ Supabase     │   │ External APIs        │
│ (Auth)       │  │ (PostgreSQL  │   │ - Exchange Rate API  │
│              │  │  + RLS)      │   │ - Sanity CMS         │
│              │  │              │   │ - Web Push (VAPID)   │
└──────────────┘  └──────────────┘   └──────────────────────┘
```

---

## 3. Project Structure

```
finboom/
├── public/                          # Static assets
│   ├── manifest.json                # PWA manifest
│   ├── sw.js                        # Service worker
│   └── icons/                       # PWA icons (SVG, PNG)
├── scripts/
│   ├── create-post.mjs              # CLI to create a blog post in Sanity
│   ├── regenerate-blog.ts           # CLI: blog:new / blog:update / blog:regen
│   ├── seed-blog-topics.ts          # Seed the Supabase topic queue
│   ├── sync-blog-topics-with-sanity.ts # Reconcile queue with published posts
│   ├── blog-topic-seed-data.ts      # Seed topic list (by category)
│   ├── debug-blog-gen.ts            # Local probe for the generation pipeline
│   ├── debug-providers.ts           # Local probe for AI providers
│   └── stamp-sw.mjs                 # Prebuild: stamps SW version for cache busting
├── src/
│   ├── proxy.ts                     # Clerk middleware (route protection)
│   ├── app/
│   │   ├── layout.tsx               # Root layout (fonts, ClerkProvider, PWA popup)
│   │   ├── page.tsx                 # Landing page (marketing)
│   │   ├── loading.tsx              # Global loading skeleton
│   │   ├── globals.css              # Tailwind base + liquid glass + button/tooltip CSS
│   │   ├── robots.ts                # SEO: robots.txt generation
│   │   ├── sitemap.ts               # SEO: sitemap.xml (blog posts + /tools)
│   │   ├── feed.xml/route.ts        # RSS 2.0 feed (latest posts)
│   │   ├── opengraph-image.tsx      # Dynamic OG image generation
│   │   ├── apple-icon.tsx           # Dynamic Apple touch icon
│   │   │
│   │   ├── api/                     # API Routes (serverless functions)
│   │   │   ├── cron/
│   │   │   │   ├── notifications/route.ts   # Daily reminders push cron
│   │   │   │   ├── exchange-rates/route.ts  # Daily exchange rate fetch
│   │   │   │   ├── monthly-snapshot/route.ts# Monthly net worth snapshot cron
│   │   │   │   ├── weekly-summary/route.ts  # Weekly net worth push summary
│   │   │   │   └── blog-post/route.ts       # Daily AI blog auto-publish
│   │   │   ├── exchange-rates/refresh/route.ts  # User-triggered rate refresh
│   │   │   ├── blog/
│   │   │   │   ├── generate/route.ts        # Admin: generate a post on demand
│   │   │   │   └── publish/route.ts         # Blog publishing webhook
│   │   │   ├── admin/blog-automation/
│   │   │   │   ├── status/route.ts          # Queue health / next topic
│   │   │   │   ├── topics/route.ts          # Add/skip topics in the queue
│   │   │   │   └── trigger/route.ts         # Manually run the pipeline
│   │   │   ├── import/parse/route.ts        # Server-side import parsing
│   │   │   ├── notifications/check/route.ts # Notification check endpoint
│   │   │   └── push/subscribe/route.ts      # Push subscription registration
│   │   │
│   │   ├── auth/                    # Supabase auth callback + reset-password
│   │   ├── login/page.tsx           # Login page (Clerk)
│   │   │
│   │   ├── tools/                   # Public financial calculators (SEO)
│   │   │   ├── layout.tsx           # Calculators shell
│   │   │   ├── page.tsx             # Calculators landing grid + JSON-LD
│   │   │   └── [slug]/page.tsx      # Per-calculator page (metadata, FAQ, JSON-LD)
│   │   │
│   │   ├── blog/
│   │   │   ├── page.tsx             # Blog listing (Sanity CMS)
│   │   │   ├── [slug]/page.tsx      # Post detail (+ share-button, zoomable-image)
│   │   │   ├── category-filter.tsx  # Client-side category filter
│   │   │   ├── new/page.tsx         # Blog post creation (admin)
│   │   │   ├── preview/page.tsx     # Dev-only format preview (noindex)
│   │   │   └── automation/page.tsx  # Admin: automation queue dashboard
│   │   │
│   │   └── dashboard/               # Protected dashboard area
│   │       ├── layout.tsx           # Dashboard shell (sidebar, nav, providers)
│   │       ├── page.tsx             # Dashboard overview (net worth summary)
│   │       ├── assets/page.tsx      # Asset management (22+ classes) + analytics
│   │       ├── liabilities/page.tsx # Loan/debt tracking + EMI liquidity
│   │       ├── transactions/page.tsx# Income & expense tracking
│   │       ├── budget/page.tsx      # Monthly budget by category
│   │       ├── goals/page.tsx       # Financial goal planning
│   │       ├── snapshots/page.tsx   # Monthly net worth snapshots
│   │       ├── health/page.tsx      # Wealth Check (0–100 score)
│   │       ├── parties/page.tsx     # Lend/borrow tracking (Splitwise-like)
│   │       ├── profiles/page.tsx    # Family member profiles
│   │       ├── settings/page.tsx    # Currency, theme, export, PIN, account
│   │       └── more/page.tsx        # Mobile "more" menu
│   │
│   ├── components/
│   │   ├── navigation.tsx           # Sidebar + mobile bottom nav (with tooltips)
│   │   ├── top-bar.tsx              # Top bar (profile switcher, sync, notifications)
│   │   ├── sidebar-context.tsx      # Sidebar collapse state (React Context)
│   │   ├── query-provider.tsx       # TanStack React Query provider
│   │   ├── offline-provider.tsx     # Offline sync manager + update detection
│   │   ├── offline-indicator.tsx    # "You're offline" banner + SyncButton
│   │   ├── toast.tsx                # Global toast notification system
│   │   ├── tooltip.tsx             # Reusable delayed hover/focus tooltip (portal)
│   │   ├── pin-lock.tsx             # 4-digit PIN lock screen
│   │   ├── feature-tour.tsx         # First-time user guided tour
│   │   ├── notification-bell.tsx    # Notification dropdown
│   │   ├── portfolio-analytics.tsx  # Asset diversification / concentration UI
│   │   ├── auth-buttons.tsx         # Login/signup CTAs + auth redirect
│   │   ├── category-icon.tsx        # Dynamic Lucide icon resolver (by name)
│   │   ├── custom-select.tsx        # Custom dropdown select (no native <select>)
│   │   ├── app-dialog.tsx           # Global confirm/alert dialog (React Context)
│   │   ├── pwa-install-banner.tsx   # "Install FinBoom" banner (landing page)
│   │   ├── pwa-install-popup.tsx    # PWA install prompt popup
│   │   ├── mermaid-diagram.tsx      # Mermaid diagram renderer (lazy loaded)
│   │   ├── charts/
│   │   │   ├── net-worth-chart.tsx  # Area chart for net worth over time
│   │   │   ├── allocation-chart.tsx # Pie chart for asset allocation
│   │   │   └── spending-chart.tsx   # Category spending / MoM chart
│   │   ├── tools/                   # Calculator UI (one component per calculator)
│   │   │   ├── calculator-island.tsx# Renders the right calculator by slug
│   │   │   ├── ui.tsx               # Shared inputs/result components
│   │   │   └── {sip,step-up-sip,lumpsum,fd,xirr,hra,tax-regime}-calculator.tsx
│   │   └── modals/
│   │       ├── add-asset-modal.tsx
│   │       ├── add-transaction-modal.tsx
│   │       ├── add-party-modal.tsx
│   │       ├── add-party-transaction-modal.tsx
│   │       ├── edit-party-modal.tsx
│   │       └── import-modal.tsx     # Excel/CSV import (Zerodha, Groww)
│   │
│   ├── hooks/
│   │   ├── use-auth.tsx             # Clerk wrapper + offline user caching
│   │   ├── use-profile.tsx          # Multi-profile context provider
│   │   ├── use-currency.tsx         # Currency conversion context + formatting
│   │   ├── use-offline-query.ts     # React Query ↔ offline-first fetchTable bridge
│   │   ├── use-offline-mutation.ts  # Mutation hook with optimistic updates
│   │   └── use-push.ts              # Auto-subscribe to push notifications
│   │
│   ├── lib/
│   │   ├── constants.ts             # Asset classes, categories, currencies list
│   │   ├── types.ts                 # TypeScript interfaces for all entities
│   │   ├── utils.ts                 # cn() utility for Tailwind class merging
│   │   ├── site.ts                  # Public base URL + absoluteUrl() helper
│   │   ├── tools.ts                 # Calculator registry (metadata, SEO, FAQs)
│   │   ├── sanity.ts                # Sanity CMS client configuration
│   │   ├── finance/                 # Pure financial logic (no UI, unit-testable)
│   │   │   ├── calculators.ts       # SIP, step-up, lumpsum, FD, XIRR, HRA, tax
│   │   │   ├── portfolio.ts         # Asset-class bucketing, HHI, concentration
│   │   │   ├── wealth-check.ts      # 0–100 multi-dimensional health score
│   │   │   └── format.ts            # INR/compact number formatting helpers
│   │   ├── blog/                    # Blog automation pipeline
│   │   │   ├── ai-generation.ts     # Outline + writer prompts, provider fallback
│   │   │   ├── run-automation.ts    # Orchestrates generate → publish → notify
│   │   │   ├── markdown-to-portable-text.ts # MD → Sanity Portable Text
│   │   │   ├── categories.ts / category-balancer.ts # Category diversification
│   │   │   ├── topic-queue.ts / topic-utils.ts      # Topic selection + dedup
│   │   │   ├── trends.ts            # Trending-keyword seeding
│   │   │   ├── images.ts / sanity-image.ts          # Image resolve + hero upload
│   │   │   ├── automation-status.ts # Queue health reporting
│   │   │   └── admin-auth.ts        # requireEditorRole() for admin routes
│   │   └── offline/                 # Offline-first data engine
│   │       ├── index.ts             # Re-exports all offline modules
│   │       ├── db.ts                # IndexedDB CRUD wrapper (stores + queue)
│   │       ├── data.ts              # fetchTable, insertRow, updateRow, deleteRow
│   │       ├── queue.ts             # Mutation queue (for offline writes)
│   │       └── sync.ts              # Sync engine (replay queue + delta pull)
│   │
│   └── utils/supabase/
│       ├── client.ts                # Browser Supabase client
│       ├── server.ts                # Server-side Supabase client (cookies)
│       └── middleware.ts            # Supabase auth middleware helper
│
├── supabase/
│   ├── schema.sql                   # Full database schema
│   └── migrations/                  # Incremental migrations
│       ├── 20260508000000_notifications.sql
│       ├── 20260508000001_parties.sql
│       ├── 20260509000000_delta_sync_updated_at.sql
│       ├── 20260509100000_budgets.sql
│       ├── 20260511000000_exchange_rates.sql
│       ├── 20260608000000_blog_topics_queue.sql
│       └── 20260620000000_blog_topics_category_keywords.sql
│
├── vercel.json                      # Vercel config (crons, headers)
├── next.config.ts                   # Next.js config (images, turbopack)
├── tailwind.config / postcss        # CSS toolchain config
└── package.json                     # Dependencies & scripts (incl. blog:* CLIs)
```

---

## 4. Database Schema

**10 tables** in Supabase PostgreSQL, all with Row Level Security (RLS):

| Table                | Purpose                                       | Key Columns                                              |
|----------------------|-----------------------------------------------|----------------------------------------------------------|
| `profiles`           | Family member profiles                        | user_id, name, type (personal/spouse/parent/child/business) |
| `assets`             | Investment & asset tracking                   | profile_id, asset_class (22 types), current_value, invested_value, units |
| `liabilities`        | Loans & debts                                 | profile_id, liability_type, outstanding_amount, interest_rate, emi_amount |
| `transactions`       | Income & expenses                             | profile_id, type (income/expense), category, amount, date |
| `budgets`            | Monthly budget per category                   | profile_id, month, category, amount                       |
| `goals`              | Financial goals with inflation                | profile_id, target_amount, current_amount, target_date, inflation_rate, linked_assets |
| `snapshots`          | Monthly net worth snapshots                   | profile_id, total_assets, total_liabilities, net_worth, asset_breakdown (JSONB) |
| `parties`            | People you lend/borrow from                   | name, phone, notes                                        |
| `party_transactions` | Lent/borrowed/settled amounts                 | party_id, type (lent/received_back/borrowed/paid_back), amount, due_date |
| `exchange_rates`     | Cached currency conversion rates              | base_currency, target_currency, rate, fetched_at          |

Additional tables from migrations:
- `notifications` — Push notification records
- `push_subscriptions` — Web Push subscription endpoints
- `blog_topics` — Queue of blog topics for automated publishing (status `pending`/`posted`/`skipped`, `sort_order`, published slug/title; service-role managed, authenticated read)

All data tables have:
- `updated_at` auto-trigger for delta sync
- Indexes on `user_id` for fast queries
- RLS policies restricting access to own data

---

## 5. Feature → Library Mapping

| Feature                           | Library / Technology                    | Files Involved                                           |
|-----------------------------------|-----------------------------------------|----------------------------------------------------------|
| **App Framework & Routing**       | Next.js 16 App Router                  | `src/app/` (all `page.tsx`, `layout.tsx`, `route.ts`)    |
| **Authentication**                | Clerk (`@clerk/nextjs`)                 | `proxy.ts`, `use-auth.tsx`, `login/page.tsx`             |
| **Database (Cloud)**              | Supabase (`@supabase/supabase-js`)      | `utils/supabase/`, all data fetches                      |
| **Database (Offline)**            | IndexedDB (native browser API)          | `lib/offline/db.ts`                                      |
| **Server State & Caching**        | TanStack React Query                    | `query-provider.tsx`, `use-offline-query.ts`             |
| **Offline Sync Engine**           | Custom (mutation queue + replay)        | `lib/offline/sync.ts`, `queue.ts`, `data.ts`             |
| **Charting — Net Worth Trend**    | Recharts (`AreaChart`)                  | `components/charts/net-worth-chart.tsx`                   |
| **Charting — Asset Allocation**   | Recharts (`PieChart`)                   | `components/charts/allocation-chart.tsx`                  |
| **Charting — Budget Progress**    | Custom CSS (progress bars)              | `dashboard/budget/page.tsx`                              |
| **Financial Calculators (/tools)** | Pure TS logic + React islands           | `lib/finance/calculators.ts`, `lib/tools.ts`, `components/tools/`, `app/tools/` |
| **Portfolio Analytics**           | Custom (bucketing + HHI concentration)  | `lib/finance/portfolio.ts`, `components/portfolio-analytics.tsx` |
| **Wealth Check Score**            | Custom (0–100 multi-dimensional model)  | `lib/finance/wealth-check.ts`, `dashboard/health/page.tsx` |
| **Toast Notifications**           | Custom (React Context)                  | `components/toast.tsx`                                   |
| **Tooltips**                      | Custom (portal + hover/focus delay)     | `components/tooltip.tsx`                                 |
| **Blog AI Generation**            | Gemini/Groq/OpenAI + GROQ queries       | `lib/blog/ai-generation.ts`, `run-automation.ts`, `api/cron/blog-post/` |
| **Markdown → Portable Text**      | Custom converter (callouts, tables, mermaid) | `lib/blog/markdown-to-portable-text.ts`            |
| **RSS Feed**                      | Next.js route handler                   | `app/feed.xml/route.ts`                                 |
| **Icons**                         | Lucide React                            | Every component                                          |
| **Styling & Design System**       | Tailwind CSS 4 + custom CSS            | `globals.css` (liquid glass classes)                     |
| **Class Merging**                 | `clsx` + `tailwind-merge`               | `lib/utils.ts` → `cn()` helper                          |
| **Currency Formatting**           | Custom hook + Intl.NumberFormat         | `hooks/use-currency.tsx`                                 |
| **Exchange Rates**                | fawazahmed0/exchange-api (free, no key) | `api/cron/exchange-rates/`, `api/exchange-rates/refresh/` |
| **Blog CMS**                      | Sanity.io (`next-sanity`)               | `lib/sanity.ts`, `blog/` pages                           |
| **Blog Diagrams**                 | Mermaid.js (lazy loaded)                | `components/mermaid-diagram.tsx`                         |
| **Blog Images**                   | Sanity CDN + `@sanity/image-url`        | `lib/sanity.ts` → `urlFor()`                            |
| **Excel/CSV Import**              | SheetJS (`xlsx`)                        | `components/modals/import-modal.tsx`                     |
| **Push Notifications**            | Web Push API + `web-push` (server)      | `hooks/use-push.ts`, `api/push/subscribe/`, `api/cron/notifications/` |
| **PWA / Service Worker**          | Custom SW + Web App Manifest            | `public/sw.js`, `public/manifest.json`                   |
| **OG Image Generation**           | Next.js ImageResponse API              | `app/opengraph-image.tsx`                                |
| **SEO**                           | Next.js Metadata API                    | `robots.ts`, `sitemap.ts`, `layout.tsx`                  |
| **Guided Tour**                   | Custom component (no library)           | `components/feature-tour.tsx`                            |
| **PIN Lock**                      | Custom component (localStorage hash)    | `components/pin-lock.tsx`                                |
| **Deployment**                    | Vercel (serverless + crons)             | `vercel.json`                                            |
| **Middleware / Route Protection**  | Clerk middleware                        | `proxy.ts`                                               |

---

## 6. Features Deep Dive

### 6.1 Dashboard Overview (`/dashboard`)
- **Net worth** = total assets − total liabilities (real-time calc)
- **Net worth trend chart** — Recharts AreaChart from monthly snapshots
- **Asset allocation pie chart** — Recharts PieChart grouped by asset class
- **Goal progress cards** — visual progress toward financial goals
- **Receivables summary** — money owed to you from party transactions

### 6.2 Assets (`/dashboard/assets`)
- **22+ asset classes**: Stocks, Mutual Funds, FDs, PPF, EPF, NPS, SSY, SGB, Gold, Silver, Real Estate, Crypto, Savings Account, RD, Bonds, ELSS, ULIP, LIC, US Stocks, International, Cash, Other
- Add/edit/delete assets with current value, invested value, units
- Gain/loss percentage per asset
- **Import from Excel**: Zerodha, Groww, or generic CSV/Excel format (`xlsx` library parses the file client-side)
- **Portfolio analytics** (`portfolio-analytics.tsx` + `lib/finance/portfolio.ts`): groups holdings into asset-class buckets, computes a diversification/concentration score (Herfindahl–Hirschman Index), and surfaces concentration warnings (e.g. a single holding or class dominating the portfolio)

### 6.3 Liabilities (`/dashboard/liabilities`)
- Track: Home Loan, Car Loan, Personal Loan, Education Loan, Credit Card Debt, Gold Loan, Other
- Fields: outstanding amount, original amount, interest rate, EMI, start/end dates
- **EMI liquidity insight**: compares total monthly EMIs against income to flag when debt servicing eats too large a share of cash flow

### 6.4 Transactions (`/dashboard/transactions`)
- Income & expense tracking with **17 expense** and **9 income** categories
- Monthly summary: total income, total expense, savings rate
- Category-wise breakdown

### 6.5 Budget (`/dashboard/budget`)
- Monthly budget per expense category
- **Auto-suggest**: analyzes last 3 months of spending to suggest budgets
- **Copy from last month**: one-click budget duplication
- Visual progress bars per category (green → amber → red)
- Over-budget alerts

### 6.6 Goals (`/dashboard/goals`)
- Financial goal with target amount, current amount, target date
- **Inflation adjustment**: calculates real target with configurable inflation rate (default 6%)
- **Link assets**: connect specific assets to goals and auto-calculate progress
- Progress percentage with visual bars

### 6.7 Snapshots (`/dashboard/snapshots`)
- **Monthly net worth snapshot**: captures total assets, liabilities, net worth + asset breakdown
- Historical chart showing wealth growth over time
- Month-over-month percentage change

### 6.8 Wealth Check (`/dashboard/health`)
A single **0–100 wealth score** computed deterministically from the user's own data (`lib/finance/wealth-check.ts`) — nothing is invented. The score is a weighted average across **7 dimensions**, each rated `strong` (≥75) / `fair` (≥45) / `weak` (<45) with a one-line detail and a concrete action when below par:

| Dimension | Weight | What it measures |
|-----------|:------:|------------------|
| Asset allocation | 1.2 | Equity/debt split + diversification (HHI) from `portfolio.ts` |
| Emergency fund | 1.2 | Months of expenses saved vs. 6-month target |
| Insurance cover | 1.0 | Term (~10× income) + health cover adequacy |
| Tax efficiency (80C) | 0.8 | 80C headroom used via ELSS/PPF/EPF/NPS (of ₹1.5L) |
| Debt load | 1.0 | EMI-to-income ratio (or debt-to-assets fallback) |
| Savings rate | 1.0 | Savings as % of income over the last 6 months |
| Goal progress | 0.8 | Average funded % across goals (linked assets aware) |

The overall score maps to a grade — **Excellent** (≥80), **Good** (≥65), **Fair** (≥45), **Needs work** (<45) — and each weak dimension renders a personalized recommendation.

### 6.9 Parties / Lend & Borrow (`/dashboard/parties`)
- Track money lent to or borrowed from people (Splitwise-like)
- Transaction types: Gave (Lent), Received Back, Borrowed, Paid Back
- Net balance per party with settle-up flow
- Due date tracking with overdue alerts

### 6.10 Profiles (`/dashboard/profiles`)
- Multiple financial profiles: Personal, Spouse, Parent, Child, Business
- Each profile has its own assets, liabilities, transactions, goals
- Profile switcher in the top bar
- Combined net worth view across all profiles

### 6.11 Settings (`/dashboard/settings`)
- **Currency selection**: 10 currencies (INR, USD, EUR, GBP, SGD, AED, AUD, CAD, JPY, CHF)
- **Fetch latest rates**: manual trigger to refresh exchange rates from API
- **Theme**: Light / Dark / System
- **PIN lock**: 4-digit app lock with brute-force protection (5 attempts, 1-min lockout)
- **Export data**: Download all financial data as JSON or CSV
- **Delete account**: Complete account deletion with confirmation, styled with the destructive (red) button variant (`.liquid-glass-btn-destructive`)

### 6.12 Blog (`/blog`)
- Headless CMS powered by Sanity.io
- Blog listing with category filters (Tips, Market, Product, Guides)
- **Visual-first AI posts** — auto-generated posts lead with a "Key takeaways" callout, then use Mermaid diagrams and comparison tables so readers get the gist fast, with the full text available below for those who want depth
- Full blog post pages with:
  - Portable Text rendering, including custom `callout`, `table`, and `mermaid` blocks
  - Code blocks with syntax highlighting
  - Mermaid diagrams (lazy-loaded `mermaid.js`)
  - Zoomable images with pinch-to-zoom (`zoomable-image`)
  - Share button (Web Share API)
- **RSS feed** at `/feed.xml`
- Admin can create posts from `/blog/new` and manage the automation queue at `/blog/automation`
- See [§11 Blog / CMS](#11-blog--cms) for the full AI automation pipeline

### 6.13 Financial Calculators (`/tools`)
- A suite of **free, public, SEO-optimized calculators** (no login required), each with its own metadata, FAQ, and JSON-LD:
  - **SIP** and **Step-Up SIP** — future value of monthly investments (with annual top-up)
  - **Lumpsum** — compounded growth of a one-time investment
  - **FD** — fixed deposit maturity with compounding frequency
  - **XIRR** — annualized return across irregular cashflows
  - **HRA** — house rent allowance exemption
  - **Income Tax** — old vs new regime comparison
- Pure calculation logic lives in `lib/finance/calculators.ts` (UI-free, easy to test); the registry/metadata lives in `lib/tools.ts`; each calculator is a small client "island" in `components/tools/` mounted by `calculator-island.tsx`
- Professional Lucide icons (no emojis) via `category-icon.tsx`

### 6.14 Shared UI Primitives
- **Toasts** (`components/toast.tsx`): global, context-driven success/error/info notifications
- **Tooltips** (`components/tooltip.tsx`): accessible, portal-rendered tooltips shown on delayed hover/focus; attached to icon-only controls (nav, top bar, notification bell, budget actions) via `cloneElement` so no extra interactive wrapper is needed
- **Destructive button** (`.liquid-glass-btn-destructive` in `globals.css`): red liquid-glass variant for irreversible actions
- **Category icon** (`components/category-icon.tsx`): resolves a Lucide icon component by name string, used across calculators, categories, and nav

---

## 7. Offline-First Architecture

The app works fully offline using a 4-layer system:

### Layer 1: Service Worker (`public/sw.js`)
- **Precaches** all dashboard pages and static assets on install
- **Network-first** strategy for API calls (try network, fallback to cache)
- **Cache-first** for static assets (JS, CSS, images)
- **Offline fallback** for navigation requests (serves cached pages)
- Version-stamped caches for clean updates

### Layer 2: IndexedDB (`lib/offline/db.ts`)
- 9 data stores mirroring Supabase tables + mutation queue + metadata store
- All data cached locally after every successful Supabase fetch
- Delta sync via `updated_at` indexes (only fetch changes since last sync)

### Layer 3: Offline Data Layer (`lib/offline/data.ts`)
- **Reads**: Online → Supabase + cache to IDB. Offline → read from IDB.
- **Writes**: Online → Supabase + update IDB. Offline → write to IDB + enqueue mutation.
- Request deduplication prevents concurrent fetches for the same table

### Layer 4: Sync Engine (`lib/offline/sync.ts`)
- **Mutation queue**: All offline writes are queued with operation, table, data, and match criteria
- **Replay**: When online, mutations are replayed in order against Supabase
- **Delta pull**: After replay, pulls only records changed since last sync
- **Auto-retry**: 3 retries with escalating delays (3s, 8s, 20s)
- **Connectivity listeners**: Auto-sync on reconnect

### React Query Integration (`use-offline-query.ts`)
- `useOfflineQuery<T>()` wraps `fetchTable()` with React Query
- Automatic caching, deduplication, stale-while-revalidate
- Queries keyed by table + userId + filters for proper invalidation

---

## 8. Authentication Flow

```
User → Landing Page → "Get Started" → Clerk Login
                                           │
                                     ┌─────┴─────┐
                                     │  Clerk     │
                                     │  (Email,   │
                                     │   Google,  │
                                     │   etc.)    │
                                     └─────┬─────┘
                                           │
                                    Clerk Middleware
                                    (proxy.ts protects
                                     /dashboard/*)
                                           │
                                    ┌──────┴──────┐
                                    │ use-auth.tsx │
                                    │ Maps Clerk  │
                                    │ user → app  │
                                    │ AuthUser    │
                                    │ + caches to │
                                    │ localStorage│
                                    │ for offline │
                                    └─────────────┘
```

- **Clerk** handles all auth UI, OAuth providers, session tokens
- **`proxy.ts`** (Clerk middleware) protects all `/dashboard/*` routes
- **`use-auth.tsx`** wraps Clerk's `useUser`/`useAuth` hooks and adds offline caching — if Clerk can't load (offline), it falls back to a cached user from localStorage
- User's Clerk `id` is used as `user_id` in all Supabase tables

---

## 9. Currency Conversion System

### How it works:
1. **Rates source**: [fawazahmed0/exchange-api](https://github.com/fawazahmed0/exchange-api) — free, no API key, 150+ currencies
2. **Daily cron** (`/api/cron/exchange-rates`): Runs at 6:00 AM UTC via Vercel Cron, fetches INR→X rates for 9 target currencies, upserts into `exchange_rates` table
3. **Manual refresh** (`/api/exchange-rates/refresh`): User can click "Fetch latest rates" in Settings
4. **CurrencyProvider** (`use-currency.tsx`): React Context that loads rates from Supabase, provides:
   - `convert(amount)` — converts INR-stored amount to display currency
   - `formatCompact(amount)` — compact format (₹1.5L / $18K / €15K)
   - `formatCurrency(amount)` — full format (₹1,50,000 / $18,000.00)
   - `symbol` — currency symbol (₹, $, €, etc.)
5. **All values stored in INR** in the database — conversion happens at display time only
6. **INR uses Indian notation** (L = Lakh, Cr = Crore), other currencies use Western notation (K, M, B)

### Supported currencies:
INR (₹), USD ($), EUR (€), GBP (£), SGD (S$), AED (د.إ), AUD (A$), CAD (C$), JPY (¥), CHF (Fr)

---

## 10. Push Notifications

### Flow:
1. **Client subscribes** (`use-push.ts`): On login, auto-requests Notification permission, creates a PushSubscription via VAPID keys, sends to `/api/push/subscribe`
2. **Server stores** the subscription endpoint + keys in `push_subscriptions` table
3. **Daily cron** (`/api/cron/notifications`): Checks all users for:
   - Overdue party payments (due_date < today)
   - Upcoming payments (due within 3 days)
   - Goal milestones
4. **Sends push** via `web-push` library using VAPID credentials
5. **Service worker** receives push event and shows native OS notification

### Technologies:
- **VAPID** (Voluntary Application Server Identification) for push auth
- **`web-push`** npm package for server-side push delivery
- **Service Worker** `push` event listener for notification display

---

## 11. Blog / CMS

- **Sanity.io** as headless CMS (project: `ra4szzqu`)
- **`next-sanity`** for server-side data fetching with GROQ queries
- **`@sanity/image-url`** for CDN image URL generation
- **`@portabletext/react`** for rendering Sanity's Portable Text (rich content)
- Blog post features:
  - Categories with filter
  - Custom `callout`, `table`, and `mermaid` Portable Text blocks
  - Mermaid diagrams (rendered client-side, lazy-loaded)
  - Zoomable images (pinch-to-zoom on mobile)
  - Share via Web Share API
  - Author info from Clerk user data

### AI Automation Pipeline
Posts can be authored manually or generated automatically. The pipeline lives in `lib/blog/` and is orchestrated by `run-automation.ts`:

1. **Topic selection** — pulls the next `pending` topic from the `blog_topics` queue, balanced across categories (`category-balancer.ts`, `topic-queue.ts`) and seeded with trending keywords (`trends.ts`) so posts rank in search.
2. **AI writing** (`ai-generation.ts`) — generates an outline then the full **markdown** body with a multi-provider fallback chain (**Gemini → Groq → OpenAI**). Prompts enforce a visual-first structure: a "Key takeaways" callout, Mermaid diagrams, and well-formed comparison tables.
3. **Markdown → Portable Text** (`markdown-to-portable-text.ts`) — converts the markdown into Sanity blocks, including robust table parsing (tolerates AI output that omits trailing pipes) and `callout`/`mermaid`/`code` blocks.
4. **Images** (`images.ts`, `sanity-image.ts`) — resolves closely-related imagery and uploads a hero image to Sanity.
5. **Publish & notify** — writes the document to Sanity, marks the topic `posted` (with published slug/title), and fires a push notification.

**Entry points:**
- **Cron**: `/api/cron/blog-post` (daily, 08:00 UTC) auto-publishes one post.
- **Admin API**: `/api/blog/generate` (on-demand) and `/api/admin/blog-automation/{status,topics,trigger}` (queue health, add/skip topics, manual run), gated by `requireEditorRole()` (`admin-auth.ts`).
- **Admin UI**: `/blog/automation` dashboard.
- **CLI**: `yarn blog:new` (one new post), `yarn blog:update` (regenerate existing auto-posts into the latest format), `yarn blog:regen` (update latest + generate new). Topics are seeded with `scripts/seed-blog-topics.ts` and reconciled with `scripts/sync-blog-topics-with-sanity.ts`.

---

## 12. PWA & Service Worker

### Capabilities:
- **Installable** on iOS, Android, and desktop (Web App Manifest)
- **Offline access** to all dashboard pages (precached by SW)
- **Background sync** when coming back online
- **Push notifications** (native OS notifications)
- **App-like experience** (standalone display, no browser chrome)
- **Splash screen** with FinBoom logo (theme-aware)
- **Install prompts**: Banner on landing page + popup in dashboard

### Service Worker Strategy (`public/sw.js`):
- **Install**: Precache all dashboard routes + core assets
- **Activate**: Delete old caches (versioned cache names)
- **Fetch**:
  - Navigation → network-first, fallback to cache
  - API (`/api/`) → network only
  - Static assets → cache-first
- **Push**: Display notification from server payload

### Cache busting:
- `scripts/stamp-sw.mjs` runs on `prebuild`, stamps the SW with a new version hash
- Ensures users get the latest SW on each deployment

---

## 13. SEO & Metadata

| Feature              | Implementation                          |
|----------------------|-----------------------------------------|
| `<title>` tags       | Next.js Metadata API (per-page)         |
| Meta description     | Next.js Metadata API                    |
| OG image             | Dynamic generation (`opengraph-image.tsx`) |
| Apple touch icon     | Dynamic generation (`apple-icon.tsx`)    |
| `robots.txt`         | `app/robots.ts` (allows /, blocks /dashboard/ and /api/) |
| `sitemap.xml`        | `app/sitemap.ts` (static pages + all `/tools/*` + published blog posts) |
| RSS feed             | `app/feed.xml/route.ts` (RSS 2.0 of latest posts) |
| Structured data      | JSON-LD: `WebApplication` on landing, `SoftwareApplication`/`FAQPage` on calculator pages |
| Per-tool metadata    | Each `/tools/[slug]` page has its own title, description, OG tags, and FAQ |
| Canonical base URL   | `lib/site.ts` (`NEXT_PUBLIC_SITE_URL`) + `absoluteUrl()` |
| Keywords             | Comprehensive Indian finance keywords (incl. trending terms in blog posts) |

---

## 14. Deployment & CI/CD

- **Platform**: Vercel (auto-deploys on `git push` to `master`)
- **Serverless Functions**: All `route.ts` files in `src/app/api/` become Vercel Serverless Functions
- **Cron Jobs** (defined in `vercel.json`):
  - `/api/cron/exchange-rates` — daily at 6:00 AM UTC (refresh currency rates)
  - `/api/cron/blog-post` — daily at 8:00 AM UTC (AI auto-publish one post)
  - `/api/cron/notifications` — daily at 9:00 AM UTC (reminders push)
  - `/api/cron/weekly-summary` — Mondays at 3:00 AM UTC (net worth push summary)
  - `/api/cron/monthly-snapshot` — 1st of month at 12:00 AM UTC (capture net worth snapshot)
  - All cron endpoints are protected by the `CRON_SECRET` bearer token
- **Build**: `yarn build` (runs `stamp-sw.mjs` prebuild → `next build`)
- **Domain**: `finboom-cyan.vercel.app`

---

## 15. Environment Variables

| Variable                          | Where   | Purpose                              |
|-----------------------------------|---------|--------------------------------------|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Client  | Clerk auth (public key)              |
| `CLERK_SECRET_KEY`                 | Server  | Clerk auth (server operations)       |
| `NEXT_PUBLIC_SUPABASE_URL`         | Client  | Supabase project URL                 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`    | Client  | Supabase anonymous/public key        |
| `SUPABASE_SERVICE_ROLE_KEY`        | Server  | Supabase admin operations (cron, rates) |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY`     | Client  | Web Push VAPID public key            |
| `VAPID_PRIVATE_KEY`                | Server  | Web Push VAPID private key           |
| `CRON_SECRET`                      | Server  | Auth token for Vercel cron endpoints |
| `NEXT_PUBLIC_SANITY_PROJECT_ID`    | Client  | Sanity CMS project ID               |
| `NEXT_PUBLIC_SANITY_DATASET`       | Client  | Sanity dataset (production)          |
| `SANITY_EDITOR_TOKEN`              | Server  | Sanity write token (publish posts)   |
| `GEMINI_API_KEY`                   | Server  | Primary blog AI provider (Gemini)    |
| `GROQ_API_KEY`                     | Server  | Blog AI fallback provider (optional) |
| `OPENAI_API_KEY`                   | Server  | Blog AI fallback provider (optional) |
| `NEXT_PUBLIC_SITE_URL`             | Client  | Canonical base URL for SEO/sitemap/RSS |

> Blog automation (cron + `blog:*` CLIs) requires at least one AI provider key plus `SANITY_EDITOR_TOKEN`. If a provider key is missing, the generator falls back to the next available provider.

---

## 16. Commit History & Changelog

The table below documents the **first 45 commits** in chronological order (foundation of the app). The major feature waves added since are summarized in [Recent major additions](#recent-major-additions-commits-4671) below.

| # | Commit    | Type     | Description                                                  |
|---|-----------|----------|--------------------------------------------------------------|
| 1 | `31f7ad6` | feat     | Initial commit from Create Next App                          |
| 2 | `5c2098b` | feat     | iOS 26 liquid glass design system, skeleton loaders, dark mode |
| 3 | `d69c512` | chore    | Various edits                                                |
| 4 | `76f89b1` | chore    | Various edits                                                |
| 5 | `7e173ce` | feat     | ImportModal with Zerodha/Groww format detection              |
| 6 | `c7bd0b6` | feat     | App branding icon (SVG)                                      |
| 7 | `8683271` | feat     | Liquid Glass design system + Huashu-Design typography        |
| 8 | `befcbcd` | feat     | Blog creation & listing pages (Sanity CMS integration)       |
| 9 | `5c0a211` | feat     | UI component styling and layout improvements                 |
| 10 | `26d094c` | feat    | Offline support with IndexedDB + Service Worker              |
| 11 | `7027266` | refactor| Replace Clerk auth with custom `use-auth` hook + SW handling |
| 12 | `bd63d8c` | feat    | Blog: external images + table support in markdown            |
| 13 | `b7d4bd3` | feat    | MermaidDiagram component + PWA install popup                 |
| 14 | `19d3925` | feat    | Offline sync: auto-retry + reduced cooldown                  |
| 15 | `a7debab` | fix     | GoalFormModal form padding                                   |
| 16 | `9c4265f` | feat    | Offline-first PWA upgrade with TanStack React Query          |
| 17 | `b80010f` | fix     | Skeleton loader while Clerk auth loads                       |
| 18 | `2037202` | fix     | Hide Clerk built-in footer (duplicate toggle)                |
| 19 | `ce8ca1f` | fix     | Force-hide Clerk footer via CSS                              |
| 20 | `8aedf58` | fix     | Hide Clerk "Use phone" toggle                                |
| 21 | `af333c4` | fix     | Vibrant mermaid chart colors matching theme                  |
| 22 | `39a32d7` | fix     | Neutral mermaid theme for professional look                  |
| 23 | `5f126ae` | fix     | Muted gray mermaid dark mode                                 |
| 24 | `eada6ae` | fix     | Fully neutral mermaid dark mode (all chart palettes)         |
| 25 | `15cd8dc` | feat    | Premium OG image + light PWA icons                           |
| 26 | `6c671e5` | feat    | Theme-aware PWA splash screen with logo                      |
| 27 | `8cb81e7` | feat    | Playfair Display font + high-res apple-touch-icon            |
| 28 | `d41355e` | feat    | Export all financial data (JSON + CSV)                       |
| 29 | `ceaab1c` | feat    | Budget feature: per-category monthly limits                  |
| 30 | `d05911a` | fix     | Redirect logged-in users from landing → dashboard            |
| 31 | `ebe926e` | fix     | Hide Clerk "Use phone" via appearance API                    |
| 32 | `358fb10` | style   | Frosted glass login UI polish                                |
| 33 | `871c80e` | style   | Compact login page sizing                                    |
| 34 | `95afc77` | fix     | Hide number input spinners + prevent scroll-to-change        |
| 35 | `b24489d` | style   | Status bar color matching navbar                             |
| 36 | `743d3fc` | feat    | SyncButton + OfflineProvider context for manual sync         |
| 37 | `48918a6` | fix     | Remove status bar line (glass-elevated border)               |
| 38 | `9ea25ae` | fix     | "Install FinBoom" button visible in dark mode                |
| 39 | `85875f5` | fix     | Show skeleton while auth/profile loads (no ₹0 flash)        |
| 40 | `57d5eed` | fix     | FeatureTour layout/accessibility + no-scrollbar class        |
| 41 | `8028d0d` | feat    | Feature tour with spotlight highlights + nav data attributes |
| 42 | `0dde4f3` | fix     | Service worker version update + offline fallback             |
| 43 | `e874ec1` | feat    | Offline user caching in localStorage                         |
| 44 | `cf68ad1` | fix     | Remove obsolete .huashu-design subproject reference          |
| 45 | `942bd8d` | chore   | .gitignore update                                            |

### Summary by type:
- **Features (feat)**: 20 commits — major functionality additions
- **Bug fixes (fix)**: 17 commits — each targets a specific issue
- **Style**: 3 commits — UI polish only
- **Refactor**: 1 commit — auth system migration
- **Chore**: 4 commits — misc edits, gitignore

### Notable patterns:
- Commits 18-20 & 31: Multiple attempts to hide Clerk UI elements (phone toggle, footer) — resolved with CSS + appearance API
- Commits 21-24: Iterative mermaid dark mode fixes — 4 attempts to get chart colors right
- Commits 35 & 37: Status bar color matching — 2 iterations
- Each commit addresses a single, focused concern ✓

### Recent major additions (commits 46–71)

Beyond the foundation above, the project grew into a finance platform (currently **71 commits**). The notable waves:

| Theme | What was added |
|-------|----------------|
| **Currency & offline polish** | Fallback currency rates, better online/offline detection, refresh disabled when offline, snapshot/chart time-range filtering with smart date formatting |
| **Blog automation platform** | DB-backed topic queue + daily auto-generation cron, admin manual trigger + upcoming-topics dashboard, multi-provider AI fallback (Gemini 2.5-flash → Groq → OpenAI), resilient JSON/parse handling, topic similarity guard, graceful handling of broken Mermaid/images |
| **Blog reading experience & SEO** | Reading time + related posts, featured latest post with gradient artwork, blog search, canonicals + sitemap + JSON-LD, RSS feed (`/feed.xml`) |
| **UX feature roadmap** | Public financial calculators suite (`/tools`), Wealth Check 0–100 score, portfolio analytics (diversification/concentration), EMI liquidity insight, smart asset importer, global toast system |
| **Visual-first content** | Auto-posts restructured around key takeaways + Mermaid + tables, plus `blog:new`/`blog:update`/`blog:regen` regeneration tooling |
| **Production-grade UI polish** | Lucide icons replacing emojis on calculators, red destructive "Delete account" button, accessible hover/focus tooltips on icon-only controls |

> For the exact commit-by-commit history, run `git log --oneline`.
