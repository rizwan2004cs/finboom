# FinBoom Roadmap — User Pain Points & Planned Features

## Real Pain Points Users Face

### 1. "I opened the app but everything is zero"
**Problem:** New users land on an empty dashboard with no guidance. No sample data, no wizard, no "add your first asset" nudge. They bounce.

**Fix:** Guided onboarding flow — 3 steps max: add one asset, log one expense, take first snapshot. Show a meaningful dashboard immediately.

---

### 2. "I forget to update my numbers"
**Problem:** Net worth tracking only works if users manually take snapshots. Most forget. The trend chart stays empty or stale.

**Fix:** Auto-monthly snapshot (cron job on 1st of month). Plus a gentle weekly push reminder: "Your net worth was ₹X last month. Want to update?"

---

### 3. "I don't know where my money is going"
**Problem:** Users log transactions but there's no spending breakdown chart. They can't see "I spent ₹18k on food this month" at a glance.

**Fix:** Spending analytics — category pie chart, month-over-month comparison, top 3 categories highlighted on dashboard.

---

### 4. "I set a goal but the progress never updates"
**Problem:** Goals have a `linked_assets` field but it does nothing. Users must manually update `current_amount`. Nobody does.

**Fix:** Auto-sync goal progress from linked assets. If you link your "Emergency Fund" goal to your liquid fund asset, progress updates automatically.

---

### 5. "I missed my SIP date again"
**Problem:** No SIP tracking or reminders. Users track SIPs mentally or in separate apps.

**Fix:** SIP tracker with date-based push reminders. Simple: name, amount, date, fund name. Push on SIP day morning.

---

### 6. "March comes and I panic about taxes"
**Problem:** No visibility into tax implications until filing season. Users don't know their 80C utilization.

**Fix:** Tax dashboard showing 80C usage (EPF + PPF + ELSS + insurance from existing assets), HRA estimate, and gap to fill.

---

### 7. "The app doesn't celebrate my wins"
**Problem:** No positive reinforcement. Users save ₹10 lakh and the app shows the same neutral number.

**Fix:** Milestone celebrations — push notification + confetti when net worth crosses ₹1L, ₹5L, ₹10L, ₹25L, ₹50L, ₹1Cr. Weekly "you grew by X%" summary.

---

### 8. "I can't edit a transaction I entered wrong"
**Problem:** Transactions are delete-only. Typo in amount? Delete and re-enter.

**Fix:** Add edit capability to transactions.

---

### 9. "My spouse can't see our combined finances"
**Problem:** `shared_access` table exists in DB but there's zero UI. Families can't collaborate.

**Fix:** Wire up family sharing — invite by email, view-only or edit access per profile.

---

### 10. "I want to lock the app but PIN doesn't work"
**Problem:** PIN lock code exists (`pin-lock.tsx`) but is never mounted. Users asked for it.

**Fix:** Wire PIN lock into the app layout + add toggle in Settings.

---

## Implementation Priority

### Phase 1 — Quick Wins (1-2 days each)

| # | Feature | Impact | Effort |
|---|---------|--------|--------|
| 1 | **Edit transactions** | Removes daily friction | Low |
| 2 | **Auto monthly snapshot** | Core feature works passively | Low |
| 3 | **Spending analytics on dashboard** | Users see value immediately | Medium |
| 4 | **Wire PIN lock** | Security users asked for | Low |
| 5 | **Weekly net worth push summary** | Re-engagement without opening app | Low |

### Phase 2 — Core Value (3-5 days each)

| # | Feature | Impact | Effort |
|---|---------|--------|--------|
| 6 | **Goal auto-sync from linked assets** | Goals become useful | Medium |
| 7 | **SIP tracker + reminders** | Fills major gap for MF investors | Medium |
| 8 | **Guided onboarding (3 steps)** | Reduces bounce rate | Medium |
| 9 | **Milestone celebrations** | Retention + positive psychology | Low |
| 10 | **Budget overrun notifications** | Budget feature becomes proactive | Low |

### Phase 3 — Differentiation (1-2 weeks)

| # | Feature | Impact | Effort |
|---|---------|--------|--------|
| 11 | **Tax dashboard (80C tracker)** | Unique for Indian users | High |
| 12 | **Family sharing UI** | Household finances | High |
| 13 | **FIRE calculator** | Ties blog content to product | Medium |
| 14 | **Income vs Expense trend chart** | Cash flow visibility | Medium |
| 15 | **Recommended blog post after snapshot** | Content ↔ product loop | Low |

### Phase 4 — Growth (future)

| # | Feature | Impact | Effort |
|---|---------|--------|--------|
| 16 | Live MF/stock prices (MFU API / scraping) | Portfolio auto-updates | Very High |
| 17 | Bank statement CSV import | Less manual entry | High |
| 18 | Recurring transactions (auto EMI logging) | Reduces monthly work | Medium |
| 19 | Asset-class performance over time chart | Investment insights | Medium |
| 20 | Year-in-review annual summary | Shareable, viral potential | Medium |

---

## Bugs to Fix (found during audit)

| Bug | Location | Severity |
|-----|----------|----------|
| Goal `target_amount` may save as 0 on create | `goals/page.tsx` ~223-234 | High |
| Account delete doesn't remove parties, budgets, notifications | `settings/page.tsx` | Medium |
| INR hardcoded in parties/goals despite currency setting | Multiple files | Low |
| Health page tour copy doesn't match actual features | Feature tour config | Low |
| `/api/notifications/check` endpoint never called client-side | `notification-bell.tsx` | Low |

---

## Architecture Decisions

- **No external API integrations yet** — keep it simple, manual-first
- **Supabase for everything** — DB, auth integration (via Clerk), push subscriptions
- **Sanity for blog only** — decoupled from app data
- **Offline-first PWA** — IndexedDB sync queue already works
- **Gemini AI for blog** — free tier, no cost pressure
- **Vercel cron for automation** — blog posts, notifications, exchange rates, snapshots

---

## Success Metrics

- **DAU increase** after onboarding + weekly summary pushes
- **Snapshot frequency** after auto-monthly + reminders
- **Goal completion rate** after auto-sync
- **Session duration** after spending analytics
- **Retention D7/D30** after milestone celebrations

---

*Last updated: June 8, 2026*
