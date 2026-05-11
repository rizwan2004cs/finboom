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
| **Push**           | Web Push API (`web-push` 3.x)      | Server-side push notification delivery       |
| **Excel Import**   | SheetJS (`xlsx` 0.18.x)            | Parse Zerodha/Groww/CSV Excel exports        |
| **CSS Utilities**  | `clsx` + `tailwind-merge`          | Conditional & conflict-free class merging    |
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
│   ├── create-post.mjs              # CLI to create blog posts in Sanity
│   └── stamp-sw.mjs                 # Prebuild: stamps SW version for cache busting
├── src/
│   ├── proxy.ts                     # Clerk middleware (route protection)
│   ├── app/
│   │   ├── layout.tsx               # Root layout (fonts, ClerkProvider, PWA popup)
│   │   ├── page.tsx                 # Landing page (marketing)
│   │   ├── loading.tsx              # Global loading skeleton
│   │   ├── globals.css              # Tailwind base + liquid glass custom CSS
│   │   ├── robots.ts               # SEO: robots.txt generation
│   │   ├── sitemap.ts              # SEO: sitemap.xml generation
│   │   ├── opengraph-image.tsx      # Dynamic OG image generation
│   │   ├── apple-icon.tsx           # Dynamic Apple touch icon
│   │   │
│   │   ├── api/                     # API Routes (serverless functions)
│   │   │   ├── cron/
│   │   │   │   ├── notifications/route.ts   # Daily notification cron
│   │   │   │   └── exchange-rates/route.ts  # Daily exchange rate fetch
│   │   │   ├── exchange-rates/
│   │   │   │   └── refresh/route.ts         # User-triggered rate refresh
│   │   │   ├── blog/publish/                # Blog publishing webhook
│   │   │   ├── notifications/check/         # Notification check endpoint
│   │   │   └── push/subscribe/              # Push subscription registration
│   │   │
│   │   ├── auth/
│   │   │   ├── callback/route.ts    # Supabase auth callback handler
│   │   │   └── reset-password/page.tsx
│   │   │
│   │   ├── login/page.tsx           # Login page (Clerk)
│   │   │
│   │   ├── blog/
│   │   │   ├── page.tsx             # Blog listing (Sanity CMS)
│   │   │   ├── [slug]/page.tsx      # Blog post detail page
│   │   │   ├── category-filter.tsx  # Client-side category filter
│   │   │   └── new/page.tsx         # Blog post creation (admin)
│   │   │
│   │   └── dashboard/               # Protected dashboard area
│   │       ├── layout.tsx           # Dashboard shell (sidebar, nav, providers)
│   │       ├── page.tsx             # Dashboard overview (net worth summary)
│   │       ├── assets/page.tsx      # Asset management (22+ classes)
│   │       ├── liabilities/page.tsx # Loan/debt tracking
│   │       ├── transactions/page.tsx# Income & expense tracking
│   │       ├── budget/page.tsx      # Monthly budget by category
│   │       ├── goals/page.tsx       # Financial goal planning
│   │       ├── snapshots/page.tsx   # Monthly net worth snapshots
│   │       ├── health/page.tsx      # Financial health check
│   │       ├── parties/page.tsx     # Lend/borrow tracking (Splitwise-like)
│   │       ├── profiles/page.tsx    # Family member profiles
│   │       ├── settings/page.tsx    # Currency, theme, export, PIN, account
│   │       └── more/page.tsx        # Mobile "more" menu
│   │
│   ├── components/
│   │   ├── navigation.tsx           # Sidebar + mobile bottom nav
│   │   ├── top-bar.tsx              # Top bar (profile switcher, sync, notifications)
│   │   ├── sidebar-context.tsx      # Sidebar collapse state (React Context)
│   │   ├── query-provider.tsx       # TanStack React Query provider
│   │   ├── offline-provider.tsx     # Offline sync manager + update detection
│   │   ├── offline-indicator.tsx    # "You're offline" toast banner
│   │   ├── pin-lock.tsx             # 4-digit PIN lock screen
│   │   ├── feature-tour.tsx         # First-time user guided tour
│   │   ├── notification-bell.tsx    # Notification dropdown
│   │   ├── auth-buttons.tsx         # Login/signup CTAs + auth redirect
│   │   ├── category-icon.tsx        # Dynamic Lucide icon resolver
│   │   ├── custom-select.tsx        # Custom dropdown select (no native <select>)
│   │   ├── app-dialog.tsx           # Global confirm/alert dialog (React Context)
│   │   ├── pwa-install-banner.tsx   # "Install FinBoom" banner (landing page)
│   │   ├── pwa-install-popup.tsx    # PWA install prompt popup
│   │   ├── mermaid-diagram.tsx      # Mermaid diagram renderer (lazy loaded)
│   │   ├── charts/
│   │   │   ├── net-worth-chart.tsx  # Area chart for net worth over time
│   │   │   └── allocation-chart.tsx # Pie chart for asset allocation
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
│   │   └── use-push.ts             # Auto-subscribe to push notifications
│   │
│   ├── lib/
│   │   ├── constants.ts             # Asset classes, categories, currencies list
│   │   ├── types.ts                 # TypeScript interfaces for all entities
│   │   ├── utils.ts                 # cn() utility for Tailwind class merging
│   │   ├── sanity.ts                # Sanity CMS client configuration
│   │   └── offline/                 # Offline-first data engine
│   │       ├── index.ts             # Re-exports all offline modules
│   │       ├── db.ts                # IndexedDB CRUD wrapper (9 stores + queue)
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
│       └── 20260511000000_exchange_rates.sql
│
├── vercel.json                      # Vercel config (crons, headers)
├── next.config.ts                   # Next.js config (images, turbopack)
├── tailwind.config / postcss        # CSS toolchain config
└── package.json                     # Dependencies & scripts
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

### 6.3 Liabilities (`/dashboard/liabilities`)
- Track: Home Loan, Car Loan, Personal Loan, Education Loan, Credit Card Debt, Gold Loan, Other
- Fields: outstanding amount, original amount, interest rate, EMI, start/end dates

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

### 6.8 Financial Health Check (`/dashboard/health`)
- Assess 3 pillars: Term Insurance, Health Insurance, Emergency Fund
- Scoring system (0-100) for each pillar
- **Term insurance**: checks if cover ≥ 10x annual income
- **Health insurance**: checks if cover ≥ ₹5L or 50% annual income
- **Emergency fund**: checks if savings ≥ 6 months of expenses
- Personalized recommendations

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
- **Delete account**: Complete account deletion with confirmation

### 6.12 Blog (`/blog`)
- Headless CMS powered by Sanity.io
- Blog listing with category filters (Tips, Market, Product, Guides)
- Full blog post pages with:
  - Markdown rendering via Sanity's Portable Text
  - Code blocks with syntax highlighting
  - Mermaid diagrams (lazy-loaded `mermaid.js`)
  - Zoomable images with pinch-to-zoom
  - Share button (Web Share API)
- Admin can create new posts from `/blog/new`

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
  - Mermaid diagrams (rendered client-side, lazy-loaded)
  - Zoomable images (pinch-to-zoom on mobile)
  - Share via Web Share API
  - Author info from Clerk user data

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
| `sitemap.xml`        | `app/sitemap.ts`                        |
| Structured data      | JSON-LD WebApplication schema on landing page |
| Keywords             | Comprehensive Indian finance keywords    |

---

## 14. Deployment & CI/CD

- **Platform**: Vercel (auto-deploys on `git push` to `master`)
- **Serverless Functions**: All `route.ts` files in `src/app/api/` become Vercel Serverless Functions
- **Cron Jobs** (defined in `vercel.json`):
  - `/api/cron/notifications` — daily at 9:00 AM UTC
  - `/api/cron/exchange-rates` — daily at 6:00 AM UTC
- **Build**: `npm run build` (runs `stamp-sw.mjs` prebuild → `next build`)
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

---

## 16. Commit History & Changelog

45 commits total, in chronological order:

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
