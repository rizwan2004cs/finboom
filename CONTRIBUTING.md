# Contributing to FinBoom

First off — thank you for taking the time to contribute! 🎉 FinBoom is a community-friendly open-source project, and contributions of all kinds are welcome: code, docs, design, bug reports, and ideas.

By participating, you agree to abide by our [Code of Conduct](./CODE_OF_CONDUCT.md).

---

## Ways to contribute

- 🐛 **Report bugs** — open an issue using the Bug report template.
- 💡 **Suggest features** — open an issue using the Feature request template (check the [Roadmap](./ROADMAP.md) first).
- 🛠️ **Write code** — pick an open issue (especially `good first issue`) and send a PR.
- 📝 **Improve docs** — fix typos, clarify setup, expand [`DOCUMENTATION.md`](./DOCUMENTATION.md) or [`PRODUCT.md`](./PRODUCT.md).
- 🎨 **Design / UX** — propose improvements to the liquid-glass UI or flows.
- 🧹 **Triage** — reproduce bugs, add detail, or label issues.

### Good first issues

New here? Great starting points:

1. **React Compiler lint cleanup.** `npm run lint` currently reports findings from the new `react-hooks/*` rules (`set-state-in-effect`, `purity`, `immutability`, `refs`). The app works today, but each is a small, self-contained fix — perfect for a first PR. Fix one file at a time.
2. **Roadmap items** — see [`ROADMAP.md`](./ROADMAP.md); the "Phase 1 — Quick Wins" items are scoped and low-effort.
3. **Docs** — anything unclear in setup is fair game.

If an issue isn't assigned, comment that you'd like to take it so we avoid duplicate work.

---

## Local setup

**Prerequisites:** Node.js 24+, npm, and a Git client. The app uses Clerk (auth), Supabase (database), and optionally Sanity + an AI provider (blog).

```bash
# 1. Fork the repo on GitHub, then clone your fork
git clone https://github.com/<your-username>/finboom.git
cd finboom

# 2. Install dependencies
npm install

# 3. Set up environment variables
cp .env.example .env.local      # then fill in the values (see comments in the file)

# 4. Run the dev server
npm run dev                     # http://localhost:3000
```

> You don't need every service to work on most things. Clerk + Supabase get the dashboard running; Sanity + an AI key are only needed for the blog. UI/calculator/docs work needs little or no backend.

**Database:** apply the SQL in `supabase/schema.sql` and `supabase/migrations/` to your Supabase project (via the Supabase SQL editor or CLI).

A tour of the codebase lives in [`DOCUMENTATION.md`](./DOCUMENTATION.md#3-project-structure).

---

## Development workflow

1. **Create a branch** off `master`:
   - `feat/<short-name>`, `fix/<short-name>`, `docs/<short-name>`, `refactor/<short-name>`
2. **Make focused changes.** Keep PRs small and single-purpose — it makes review faster and friendlier.
3. **Check your work before pushing:**
   ```bash
   npm run typecheck   # must pass — this is the CI gate
   npm run lint        # for awareness (see "good first issues" about existing findings)
   npm run build       # optional, but a good final check
   ```
4. **Commit** using [Conventional Commits](https://www.conventionalcommits.org/):
   - `feat: add SIP step-up frequency option`
   - `fix: correct XIRR for same-day cashflows`
   - `docs: clarify Supabase setup`
   - Types we use: `feat`, `fix`, `docs`, `style`, `refactor`, `chore`.
5. **Open a Pull Request** against `master`, fill in the PR template, and link the issue it closes (e.g. `Closes #123`).

---

## Coding standards

- **TypeScript everywhere** — no `any` unless truly unavoidable; prefer precise types in `src/lib/types.ts`.
- **Pure financial logic** — keep calculations UI-free and deterministic in `src/lib/finance/` so they're easy to test and reuse.
- **Components** — function components + hooks. Reuse existing primitives (`tooltip`, `toast`, `custom-select`, `app-dialog`) before adding new ones.
- **Styling** — Tailwind CSS 4 with the liquid-glass design system in `globals.css`. Match the existing look (frosted cards, soft shadows, `#1d1d1f` ink).
- **Icons** — use `lucide-react` (no emojis in product UI). Resolve dynamic icons via `category-icon.tsx`.
- **Money** — store values in INR; convert/format at display time via `use-currency`.
- **Comments** — explain *why*, not *what*. Don't narrate obvious code.

---

## Reporting bugs & security issues

- **Bugs:** open a GitHub issue with steps to reproduce, expected vs. actual behavior, and screenshots if helpful.
- **Security vulnerabilities:** please do **not** open a public issue — see [`SECURITY.md`](./SECURITY.md).

---

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](./LICENSE).
