# EvdekiHesap — Claude Code Instructions

## What This App Is

A mobile-first investment portfolio tracker for private households. Tracks multi-currency assets (Turkish mutual funds, BIST stocks, crypto, physical gold, fiat) with real performance metrics accounting for exchange rate fluctuations over time.

Full product requirements: `PRD.md`. Read it before planning or implementing anything.

Technical plan (stable slice contract): `.claude/TECHNICAL_PLAN.md`.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js (App Router) |
| Language | TypeScript — strict mode, no exceptions |
| UI | shadcn/ui (Radix UI) + Tailwind CSS v4 |
| Forms | React Hook Form + Zod |
| Charts | Recharts |
| Auth & Database | Supabase (PostgreSQL + Auth + RLS) |
| Mobile | Capacitor → Android APK |
| Deployment | Vercel (web) + Supabase Cloud (DB) |

---

## Architecture — Non-Negotiable Decisions

These are locked after the technical plan is approved. Do not deviate.

- **Mutations**: Server Actions only. Route Handlers are for webhooks and cron jobs only.
- **Supabase client**: Always use the server-side Supabase client for anything touching auth or protected data. Never use the anon key client-side for private data.
- **Auth check**: Every private route/page must verify the session server-side before rendering.
- **Folder structure**: All pages live under `src/app/`. Private pages (auth-gated) live under `src/app/(private)/` with session verification in `src/app/(private)/layout.tsx`. Auth pages (login, register, invite acceptance) live under `src/app/(auth)/`. The onboarding page (household creation) lives at `src/app/onboarding/page.tsx` — outside both route groups so it is accessible post-login but not subject to the household-redirect logic. Mutations are Server Actions in `src/lib/actions/`. Price fetchers are in `src/lib/price-fetchers/`. Database migrations are in `supabase/migrations/`. See `TECHNICAL_PLAN.md` §1 for the full tree.
- **Naming**: files and folders in kebab-case, React components in PascalCase, database tables in snake_case.

---

## Security Rules

Run this checklist mentally before completing any slice that touches the database:

- [ ] Every new table has a `household_id` column
- [ ] RLS policy applied: users can only access rows belonging to their household
- [ ] Role-based permissions (Manager / Editor / Viewer) enforced in server-side logic, not in RLS policies
- [ ] Auth verified server-side on every private route

---

## How We Work — Session Rules

These rules apply in every session without exception.

1. **Commit at logical checkpoints** within a session, not just at the end. Commit messages should state what works, not just what was done.
2. **One slice at a time.** Do not begin implementing a new slice until the PM confirms the previous one is working.
3. **End every session with test instructions.** The PM must be able to verify the deliverable without reading code. Provide clear, step-by-step instructions for what to do and what to look for.
4. **Update `/tests` and Current State at the end of every slice.** Add any new testable routes introduced in that slice to `src/app/tests/page.tsx` and update the Current State table in this file.
5. **When in doubt, ask.** If a decision is not covered by this file or the PRD, stop and ask the PM. Do not assume.
6. **No surprise dependencies.** Before installing any new package, state what it is and why it's needed. Wait for approval.
7. **No speculative work.** Do not implement things that aren't in the current slice, even if they seem related.
8. **No refactoring previous slices** unless it is directly blocking the current slice. Flag it if you see it; fix it only with PM approval.
9. **English only.** Do not use Turkish for any UI text, labels, error messages, or placeholders. English only for MVP.

---

## Price Fetching Rule

Different symbol types (Tefas funds, BIST stocks, crypto, physical gold, fiat FX) require different fetching logic and different external APIs. **Before implementing price fetching for any symbol type**, present the available API options to the PM and wait for a decision. Do not choose an API unilaterally.

---

## Slice Contract

The slice contract (shared types, API shapes, database schema) is defined in `.claude/TECHNICAL_PLAN.md`. It is a **stable contract document** — not a progress tracker. Treat it like the PRD: read it for reference, do not modify it unless the PM explicitly approves a replanning decision due to a requirements change or an architectural impasse.

**Do not modify `.claude/TECHNICAL_PLAN.md` without PM approval**, even if a change seems minor. Cross-slice breakage is the primary risk in this project.

---

## UI Plan

The visual design, layout, navigation, and page composition for all slices from Slice 6 onward are governed by `.claude/UI_PLAN.md` (approved v1.0).

- Read `UI_PLAN.md` alongside `TECHNICAL_PLAN.md` at the start of any UI-touching slice.
- `.claude/ui-reference/` contains a read-only v0.app visual reference.
- Route consolidations in effect: `/settings/household` and `/settings/members` redirect to `/household`; the Rates page lives at `/rates`.
- `UI_PAGES.md` (`.claude/UI_PAGES.md`) is a temporary supplement to `UI_PLAN.md` covering page layouts for Accounts, Transactions, Rates, and Dashboard. Where the two documents conflict on layout, `UI_PAGES.md` takes precedence. `UI_PAGES.md` will be merged into `UI_PLAN.md` and deleted after Slice 7 is complete.

---

## Pre-Slice 6 Notes

These route decisions are approved and must be followed from Slice 6 onward. `TECHNICAL_PLAN.md` §1 folder structure predates `UI_PLAN.md` v1.0 and does not reflect these consolidations — update §1 when implementing the affected routes.

- `/settings/household` and `/settings/members` are consolidated into `/household` per `UI_PLAN.md` §4.1 and §5.5. The page file lives at `src/app/(private)/household/page.tsx`.
- `/rates` is a new top-level route per `UI_PLAN.md` §4.1 and §5.4. The page file lives at `src/app/(private)/rates/page.tsx`. Symbols subpage at `src/app/(private)/rates/symbols/page.tsx`.
- When implementing these routes in Slices 6 and 7, update the folder structure in `TECHNICAL_PLAN.md` §1 to reflect the actual file locations.

---

## Infrastructure

| Resource | Value |
|---|---|
| Supabase project | `EvdekiHesap` — ref `mhibzdfazufxhikqiabg` — region `eu-central-1` |
| Supabase URL | `https://mhibzdfazufxhikqiabg.supabase.co` |
| Vercel project | `evdeki-hesap` — linked to GitHub repo `eeevliya/EvdekiHesap` |
| Supabase CLI | Installed via Scoop; run `supabase login` if session expires |

### Environment variables
All three variables (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`) are set in Vercel for Production, Preview, and Development. Local `.env.local` also contains `SUPABASE_DB_PASSWORD` for running migrations via CLI.

---

## Current State

> **This is the only section updated regularly. Update it at the end of every session.**

| Field | Value |
|---|---|
| Last completed slice | Slice 7 + post-slice UI fixes: navigation (Users icon for Household, 4-item mobile bottom nav, logo/home button in mobile header), dashboard grid gap fix (peek cards in separate grid row), Rates page additions (Manage Symbols on mobile, global + per-symbol last updated timestamps, Fetch Prices button with spinner + router.refresh), Manager-only access guard on /settings/price-status and /settings/snapshots, gold symbol display names corrected via migration 20260405000001. |
| Next slice | Slice 8 (TBD) |
| Known issues | `tefas-crawler` package does not exist on npm — tefas.ts uses direct HTTP to tefas.gov.tr instead. `COLLECTAPI_ENABLED=false` in .env.local — gold fetches skipped locally until Google Sheets is decommissioned. G/L is null for assets with no snapshot yet (new households before first snapshot). Trade transaction type currently has no validation restricting both legs to include at least one fiat symbol. This restriction should be added to `createTransaction` Server Action validation in a future slice. A future stablecoin symbol type (e.g. USDT) should pass this fiat-leg validation. Display logic in `UI_PAGES.md` §4.2 includes a defensive case for both-non-fiat trades but this case cannot currently be reached. Accounts mobile polish (accordion expand/collapse behaviour) is explicitly deferred to a future slice. |
| Packages added | `recharts`, `@dnd-kit/core`, `@dnd-kit/sortable`, `geist`, `shadcn Sheet component` |
| Cron scheduling | Vercel Hobby plan only allows once-daily crons. Both cron routes (`/api/cron/price-fetch`, `/api/cron/snapshot`) are triggered externally via cron-job.org. `vercel.json` has no cron definitions. `CRON_SECRET` header check remains in place. |
| PRD | `PRD.md` v2.3 |
| Technical plan | `.claude/TECHNICAL_PLAN.md` v1.4 |
| Technical plan approved | Yes (v1.4) |
| UI plan | `.claude/UI_PLAN.md` v1.0 (approved) |
| PM testing hub | `/tests` — lists all testable routes grouped by slice |