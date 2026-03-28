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
2. **End every session with test instructions.** The PM must be able to verify the deliverable without reading code. Provide clear, step-by-step instructions for what to do and what to look for.
3. **When in doubt, ask.** If a decision is not covered by this file or the PRD, stop and ask the PM. Do not assume.
4. **No surprise dependencies.** Before installing any new package, state what it is and why it's needed. Wait for approval.
5. **No speculative work.** Do not implement things that aren't in the current slice, even if they seem related.
6. **No refactoring previous slices** unless it is directly blocking the current slice. Flag it if you see it; fix it only with PM approval.
7. **English only.** Do not use Turkish for any UI text, labels, error messages, or placeholders. English only for MVP.

---

## Price Fetching Rule

Different symbol types (Tefas funds, BIST stocks, crypto, physical gold, fiat FX) require different fetching logic and different external APIs. **Before implementing price fetching for any symbol type**, present the available API options to the PM and wait for a decision. Do not choose an API unilaterally.

---

## Slice Contract

The slice contract (shared types, API shapes, database schema) is defined in `.claude/TECHNICAL_PLAN.md`. It is a **stable contract document** — not a progress tracker. Treat it like the PRD: read it for reference, do not modify it unless the PM explicitly approves a replanning decision due to a requirements change or an architectural impasse.

**Do not modify `.claude/TECHNICAL_PLAN.md` without PM approval**, even if a change seems minor. Cross-slice breakage is the primary risk in this project.

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
| Last completed slice | Slice 1b — Household Management |
| Next slice | Slice 2 — Symbols, Accounts & Assets |
| Known issues | TECHNICAL_PLAN §5 `createHousehold` lists `displayName` as second param — typo for `displayCurrency`. Implemented as `displayCurrency`. PM to confirm. |
| Technical plan | `.claude/TECHNICAL_PLAN.md` (moved from repo root) |
| Technical plan approved | Yes (v1.1, 2026-03-28) |