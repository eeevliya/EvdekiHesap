# TECHNICAL_PLAN.md — EvdekiHesap

> **Status**: Approved
> **Version**: 1.3
> **Date**: 2026-04-04
>
> This document is the stable slice contract. Do not modify it without explicit PM approval.
> It defines: database schema, TypeScript domain types, Server Action signatures, folder structure, and slice breakdown.

---

## Table of Contents

1. [Folder Structure](#1-folder-structure)
2. [Database Schema (DDL)](#2-database-schema-ddl)
3. [RLS Policies](#3-rls-policies)
4. [TypeScript Domain Types](#4-typescript-domain-types)
5. [Server Action Signatures](#5-server-action-signatures)
6. [Price Fetching: Resolved Decisions](#6-price-fetching-resolved-decisions)
7. [Slice Breakdown](#7-slice-breakdown)

---

## 1. Folder Structure

```
c:\Code\EvdekiHesap\
├── src/
│   ├── app/
│   │   ├── (auth)/
│   │   │   ├── login/
│   │   │   │   └── page.tsx
│   │   │   ├── register/
│   │   │   │   └── page.tsx
│   │   │   └── invite/
│   │   │       └── [code]/
│   │   │           └── page.tsx
│   │   ├── (private)/
│   │   │   ├── layout.tsx          ← server-side session check; redirects to /login if unauthenticated
│   │   │   ├── dashboard/
│   │   │   │   └── page.tsx
│   │   │   ├── accounts/
│   │   │   │   └── page.tsx
│   │   │   ├── assets/
│   │   │   │   └── page.tsx
│   │   │   ├── transactions/
│   │   │   │   ├── page.tsx
│   │   │   │   └── new/
│   │   │   │       └── page.tsx
│   │   │   ├── household/
│   │   │   │   └── page.tsx        ← consolidates /settings/household + /settings/members
│   │   │   ├── rates/
│   │   │   │   ├── page.tsx        ← new top-level route (rates table + conversion tool)
│   │   │   │   └── symbols/
│   │   │   │       └── page.tsx    ← symbol management (manager-only)
│   │   │   └── settings/
│   │   │       └── page.tsx        ← personal account settings only
│   │   ├── api/
│   │   │   └── cron/
│   │   │       ├── snapshot/
│   │   │       │   └── route.ts    ← snapshot cron (every 6h)
│   │   │       └── price-fetch/
│   │   │           └── route.ts    ← price fetch cron (market hours schedule)
│   │   ├── onboarding/
│   │   │   └── page.tsx            ← household creation form (post-login, pre-household)
│   │   ├── layout.tsx              ← root layout (fonts, providers)
│   │   └── page.tsx                ← redirects to /dashboard or /login
│   ├── components/
│   │   ├── ui/                     ← shadcn/ui generated components (do not hand-edit)
│   │   ├── shared/
│   │   │   ├── app-shell.tsx       ← layout wrapper (sidebar + top-header + bottom-nav)
│   │   │   ├── sidebar.tsx         ← desktop fixed left sidebar (220px)
│   │   │   ├── bottom-nav.tsx      ← mobile fixed bottom navigation (5 items)
│   │   │   ├── top-header.tsx      ← mobile sticky top header with kebab menu
│   │   │   ├── page-header.tsx     ← page title + optional action button
│   │   │   ├── card.tsx            ← custom card (NOT shadcn) — design system tokens
│   │   │   ├── skeleton.tsx        ← shimmer loading placeholder
│   │   │   ├── badge.tsx           ← variant badge (positive/negative/warning/accent)
│   │   │   ├── mono-amount.tsx     ← monetary amount with font-mono + color
│   │   │   ├── relative-time.tsx   ← "3 min ago" with exact tooltip
│   │   │   ├── empty-state.tsx     ← icon + message + optional CTA
│   │   │   ├── confirm-dialog.tsx  ← destructive action confirmation (AlertDialog)
│   │   │   └── sign-out-button.tsx ← form wrapper for signOut server action
│   │   ├── dashboard/
│   │   │   ├── net-worth-card.tsx
│   │   │   ├── asset-breakdown-chart.tsx
│   │   │   ├── performance-chart.tsx
│   │   │   ├── asset-performance-table.tsx
│   │   │   ├── dashboard-grid.tsx  ← @dnd-kit sortable grid (desktop) / stack (mobile)
│   │   │   └── dashboard-client.tsx ← client wrapper managing activeSymbol state
│   │   ├── accounts/
│   │   ├── transactions/
│   │   ├── assets/
│   │   └── settings/
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── server.ts           ← createServerClient() for Server Components + Actions
│   │   │   └── middleware.ts       ← token refresh helper for Next.js middleware
│   │   ├── actions/
│   │   │   ├── auth.ts
│   │   │   ├── households.ts
│   │   │   ├── accounts.ts
│   │   │   ├── assets.ts
│   │   │   ├── transactions.ts
│   │   │   ├── symbols.ts
│   │   │   ├── snapshots.ts
│   │   │   └── dashboard.ts        ← getDashboardData() — portfolio summary loader
│   │   ├── types/
│   │   │   ├── database.types.ts   ← Supabase CLI generated (regenerated on schema changes)
│   │   │   └── domain.ts           ← hand-written domain types (the stable contract)
│   │   ├── utils/
│   │   │   ├── calculations.ts     ← CAGR, gain/loss, pctChange, daysBetween
│   │   │   └── format.ts           ← currency and number formatting
│   │   └── price-fetchers/
│   │       ├── index.ts            ← dispatch by symbol type
│   │       ├── fiat.ts
│   │       ├── tefas.ts
│   │       ├── stocks.ts
│   │       ├── crypto.ts
│   │       └── gold.ts
│   └── middleware.ts               ← Next.js edge middleware (auth token refresh)
├── supabase/
│   ├── migrations/                 ← versioned SQL migration files (00001_, 00002_, …)
│   └── seed.sql                    ← global symbols seed data
├── capacitor.config.ts             ← added in Slice 8
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json                   ← strict mode
└── package.json
```

> **CLAUDE.md update required after approval**: fill `[to be filled after technical plan approval]` in the Folder Structure section with the `src/app/(private)/layout.tsx` auth check pattern.

---

## 2. Database Schema (DDL)

All migrations live in `supabase/migrations/` as numbered SQL files. Every table (except `profiles` and `households` themselves) carries a `household_id` column per the security rules.

### 2.1 profiles

```sql
-- 00001_profiles.sql
create table profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  email        text not null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Automatically create a profile on auth.users insert
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into profiles (id, display_name, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)), new.email);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();
```

### 2.2 households

```sql
-- 00002_households.sql
create table households (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  display_currency text not null default 'TRY'
                     check (display_currency in ('TRY', 'USD', 'EUR')),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
```

### 2.3 household_members

```sql
-- 00003_household_members.sql
create table household_members (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  user_id      uuid not null references profiles(id) on delete cascade,
  role         text not null check (role in ('manager', 'editor', 'viewer')),
  joined_at    timestamptz not null default now(),
  unique (household_id, user_id)
);
```

### 2.4 household_invites

```sql
-- 00004_household_invites.sql
create table household_invites (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  code         text not null unique,
  role         text not null check (role in ('editor', 'viewer')),
  created_by   uuid not null references profiles(id),
  expires_at   timestamptz,               -- null = no expiry
  max_uses     integer,                   -- null = unlimited
  use_count    integer not null default 0,
  created_at   timestamptz not null default now()
);
```

### 2.5 symbols

```sql
-- 00005_symbols.sql
create table symbols (
  id                      uuid primary key default gen_random_uuid(),
  household_id            uuid references households(id) on delete cascade, -- null = global
  code                    text not null,
  name                    text,
  description             text,
  type                    text not null check (type in (
                            'fiat_currency',
                            'stock',
                            'tefas_fund',
                            'physical_commodity',
                            'cryptocurrency',
                            'custom'
                          )),
  primary_conversion_fiat text,           -- null for fiat symbols themselves
  is_active               boolean not null default true,
  fetch_config            jsonb,          -- symbol-type-specific config; structure defined per fetcher
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

-- Global symbols: code is globally unique (household_id IS NULL)
create unique index symbols_global_code_unique
  on symbols (code)
  where household_id is null;

-- Household symbols: code is unique within the household
create unique index symbols_household_code_unique
  on symbols (household_id, code)
  where household_id is not null;
```

### 2.6 exchange_rates

```sql
-- 00006_exchange_rates.sql
-- Stores one rate per symbol per fetch. household_id mirrors the symbol's household_id.
-- Global symbol rates (household_id = null) are readable by all authenticated users.
create table exchange_rates (
  id           uuid primary key default gen_random_uuid(),
  symbol_id    uuid not null references symbols(id) on delete cascade,
  household_id uuid references households(id) on delete cascade, -- null for global symbols
  rate         numeric not null,   -- price of 1 unit in primary_conversion_fiat
  fetched_at   timestamptz not null default now(),
  source       text                -- e.g., 'tcmb', 'coingecko', 'tefas', 'binance'
);

-- Index for latest-rate lookups
create index exchange_rates_symbol_fetched_idx on exchange_rates (symbol_id, fetched_at desc);
```

### 2.7 price_fetch_log

```sql
-- 00007_price_fetch_log.sql
create table price_fetch_log (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid references households(id) on delete cascade, -- null for global symbol fetches
  symbol_id    uuid references symbols(id) on delete set null,
  status       text not null check (status in ('success', 'error', 'skipped')),
  message      text,
  fetched_at   timestamptz not null default now()
);
```

### 2.8 accounts

```sql
-- 00008_accounts.sql
create table accounts (
  id                  uuid primary key default gen_random_uuid(),
  household_id        uuid not null references households(id) on delete cascade,
  owner_id            uuid not null references profiles(id),
  name                text not null,
  institution         text,
  account_identifier  text,   -- IBAN, wallet address, etc.
  default_symbol_id   uuid references symbols(id),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (household_id, name)
);
```

### 2.9 assets

```sql
-- 00009_assets.sql
create table assets (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  account_id   uuid not null references accounts(id) on delete cascade,
  symbol_id    uuid not null references symbols(id),
  amount       numeric not null default 0 check (amount >= 0),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (account_id, symbol_id)
);
```

### 2.10 transactions

```sql
-- 00010_transactions.sql
create table transactions (
  id             uuid primary key default gen_random_uuid(),
  household_id   uuid not null references households(id) on delete cascade,
  type           text not null check (type in ('deposit', 'debit', 'transfer', 'interest', 'trade')),
  date           timestamptz not null default now(),
  to_asset_id    uuid references assets(id),
  from_asset_id  uuid references assets(id),
  fee_side       text check (fee_side in ('to', 'from')),  -- which asset bears the fee (derived from to/from asset)
  entry_mode     text check (entry_mode in ('both_amounts', 'to_amount_and_rate', 'from_amount_and_rate')),
  to_amount      numeric check (to_amount > 0),
  from_amount    numeric check (from_amount > 0),
  fee_amount     numeric check (fee_amount >= 0),
  exchange_rate  numeric check (exchange_rate > 0),  -- rate used for this specific transaction
  notes          text,
  created_by     uuid not null references profiles(id),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  -- Type-level constraints
  constraint chk_deposit  check (type != 'deposit'  or (to_asset_id is not null and to_amount is not null and from_asset_id is null and from_amount is null)),
  constraint chk_debit    check (type != 'debit'    or (from_asset_id is not null and from_amount is not null and to_asset_id is null and to_amount is null)),
  constraint chk_interest check (type != 'interest' or (to_asset_id is not null and to_amount is not null and from_asset_id is null and from_amount is null)),
  constraint chk_transfer check (type != 'transfer' or (to_asset_id is not null and from_asset_id is not null and to_amount is not null and from_amount is not null)),
  constraint chk_trade    check (type != 'trade'    or (to_asset_id is not null and from_asset_id is not null and to_amount is not null and from_amount is not null and exchange_rate is not null)),
  constraint chk_fee      check (fee_amount is null or fee_side is not null)
);

create index transactions_household_date_idx on transactions (household_id, date desc);
```

### 2.11 snapshots

```sql
-- 00011_snapshots.sql
create table snapshots (
  id              uuid primary key default gen_random_uuid(),
  household_id    uuid not null references households(id) on delete cascade,
  taken_at        timestamptz not null default now(),
  net_worth_try   numeric,
  net_worth_usd   numeric,
  net_worth_eur   numeric,
  trigger         text not null check (trigger in ('scheduled', 'manual')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()  -- mutable: reserved for future snapshot-editing feature
);

create index snapshots_household_taken_idx on snapshots (household_id, taken_at desc);
```

### 2.12 snapshot_assets

```sql
-- 00012_snapshot_assets.sql + 00013_snapshot_assets_values.sql
create table snapshot_assets (
  id           uuid primary key default gen_random_uuid(),
  snapshot_id  uuid not null references snapshots(id) on delete cascade,
  household_id uuid not null references households(id) on delete cascade,
  asset_id     uuid not null references assets(id),
  symbol_id    uuid not null references symbols(id),
  amount       numeric not null,
  value_try    numeric,   -- asset value in TRY at snapshot time
  value_usd    numeric,   -- asset value in USD at snapshot time (null if USD/TRY rate unavailable)
  value_eur    numeric,   -- asset value in EUR at snapshot time (null if EUR/TRY rate unavailable)
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()  -- mutable: reserved for future snapshot-editing feature
);
```

### 2.13 Transaction RPC Functions (Atomicity)

All transaction mutations (create, update, delete) must go through these PostgreSQL functions called via Supabase RPC. This guarantees that the transaction record and every affected asset's `amount` are modified in a single atomic database operation. **Server Actions must never issue sequential separate queries for this; they must call these RPCs.**

```sql
-- 00013_transactions.sql + 00014_fee_side_entry_mode.sql (applied together)

-- ── apply_transaction ───────────────────────────────────────────────────────
-- Inserts a transaction and atomically adjusts asset amounts.
-- Fee asset is always derived from fee_side + to/from asset id (no separate fee_asset_id).
-- Returns the new transaction's id.
create or replace function apply_transaction(
  p_household_id  uuid,
  p_type          text,
  p_date          timestamptz,
  p_to_asset_id   uuid,
  p_from_asset_id uuid,
  p_fee_side      text,          -- 'to', 'from', or null
  p_to_amount     numeric,
  p_from_amount   numeric,
  p_fee_amount    numeric,
  p_exchange_rate numeric,
  p_entry_mode    text,
  p_notes         text,
  p_created_by    uuid
) returns uuid language plpgsql security definer
set search_path = public as $$
declare v_id uuid;
begin
  insert into transactions (
    household_id, type, date,
    to_asset_id, from_asset_id, fee_side, fee_amount,
    to_amount, from_amount, exchange_rate, entry_mode, notes, created_by
  ) values (
    p_household_id, p_type, p_date,
    p_to_asset_id, p_from_asset_id, p_fee_side, p_fee_amount,
    p_to_amount, p_from_amount, p_exchange_rate, p_entry_mode, p_notes, p_created_by
  ) returning id into v_id;

  -- to_asset: gains to_amount, minus fee if fee_side = 'to'
  if p_to_asset_id is not null and p_to_amount is not null then
    if p_fee_side = 'to' and p_fee_amount is not null and p_fee_amount > 0 then
      update assets set amount = amount + p_to_amount - p_fee_amount, updated_at = now() where id = p_to_asset_id;
    else
      update assets set amount = amount + p_to_amount, updated_at = now() where id = p_to_asset_id;
    end if;
  end if;

  -- from_asset: loses from_amount, plus fee if fee_side = 'from'
  if p_from_asset_id is not null and p_from_amount is not null then
    if p_fee_side = 'from' and p_fee_amount is not null and p_fee_amount > 0 then
      update assets set amount = amount - p_from_amount - p_fee_amount, updated_at = now() where id = p_from_asset_id;
    else
      update assets set amount = amount - p_from_amount, updated_at = now() where id = p_from_asset_id;
    end if;
  end if;

  return v_id;
end; $$;

-- ── reverse_and_delete_transaction ─────────────────────────────────────────
-- Net-delta per unique asset — no intermediate state, no ordering issue.
create or replace function reverse_and_delete_transaction(
  p_transaction_id uuid
) returns void language plpgsql security definer
set search_path = public as $$
declare t transactions%rowtype;
begin
  select * into t from transactions where id = p_transaction_id;
  if not found then raise exception 'transaction not found'; end if;

  if t.to_asset_id is not null and t.to_amount is not null then
    if t.fee_side = 'to' and t.fee_amount is not null and t.fee_amount > 0 then
      update assets set amount = amount - t.to_amount + t.fee_amount, updated_at = now() where id = t.to_asset_id;
    else
      update assets set amount = amount - t.to_amount, updated_at = now() where id = t.to_asset_id;
    end if;
  end if;

  if t.from_asset_id is not null and t.from_amount is not null then
    if t.fee_side = 'from' and t.fee_amount is not null and t.fee_amount > 0 then
      update assets set amount = amount + t.from_amount + t.fee_amount, updated_at = now() where id = t.from_asset_id;
    else
      update assets set amount = amount + t.from_amount, updated_at = now() where id = t.from_asset_id;
    end if;
  end if;

  delete from transactions where id = p_transaction_id;
end; $$;

-- ── update_transaction ──────────────────────────────────────────────────────
-- Single-pass net-delta per unique asset. fee_side and entry_mode are immutable.
-- Delta formulas:
--   to_asset:   (p_to_amount - t.to_amount) + if fee_side='to': (t.fee_amount - p_fee_amount)
--   from_asset: (t.from_amount - p_from_amount) + if fee_side='from': (t.fee_amount - p_fee_amount)
create or replace function update_transaction(
  p_transaction_id uuid,
  p_date           timestamptz,
  p_to_amount      numeric,
  p_from_amount    numeric,
  p_fee_amount     numeric,
  p_exchange_rate  numeric,
  p_notes          text
) returns void language plpgsql security definer
set search_path = public as $$
declare
  t            transactions%rowtype;
  v_to_delta   numeric;
  v_from_delta numeric;
begin
  select * into t from transactions where id = p_transaction_id;
  if not found then raise exception 'transaction not found'; end if;

  if t.to_asset_id is not null then
    v_to_delta := coalesce(p_to_amount, 0) - coalesce(t.to_amount, 0);
    if t.fee_side = 'to' then
      v_to_delta := v_to_delta + coalesce(t.fee_amount, 0) - coalesce(p_fee_amount, 0);
    end if;
    update assets set amount = amount + v_to_delta, updated_at = now() where id = t.to_asset_id;
  end if;

  if t.from_asset_id is not null then
    v_from_delta := coalesce(t.from_amount, 0) - coalesce(p_from_amount, 0);
    if t.fee_side = 'from' then
      v_from_delta := v_from_delta + coalesce(t.fee_amount, 0) - coalesce(p_fee_amount, 0);
    end if;
    update assets set amount = amount + v_from_delta, updated_at = now() where id = t.from_asset_id;
  end if;

  update transactions set
    date          = p_date,
    to_amount     = p_to_amount,
    from_amount   = p_from_amount,
    fee_amount    = p_fee_amount,
    exchange_rate = p_exchange_rate,
    notes         = p_notes,
    updated_at    = now()
  where id = p_transaction_id;
end; $$;
```

---

## 3. RLS Policies

RLS is the safety net against cross-household data leaks. Role-based permission enforcement (Editor vs Viewer) is handled in Server Actions, not in RLS.

### Helper function

```sql
-- Used by all RLS policies
create or replace function is_household_member(hid uuid)
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from household_members
    where household_id = hid and user_id = auth.uid()
  );
$$;

create or replace function get_household_role(hid uuid)
returns text language sql security definer stable as $$
  select role from household_members
  where household_id = hid and user_id = auth.uid()
  limit 1;
$$;
```

### Policy summary per table

| Table | Policy |
|---|---|
| `profiles` | Users can SELECT/UPDATE their own row only |
| `households` | Members of the household can SELECT; only manager can UPDATE |
| `household_members` | Members can SELECT their own household's rows; only manager can INSERT/UPDATE/DELETE |
| `household_invites` | Members can SELECT; only manager can INSERT/DELETE |
| `symbols` | Any auth user can SELECT global symbols (household_id IS NULL); members SELECT household symbols; only manager can INSERT/UPDATE/DELETE household symbols |
| `exchange_rates` | Any auth user can SELECT global rates (household_id IS NULL); members SELECT household-specific rates |
| `price_fetch_log` | Members SELECT their household's log; system user INSERT |
| `accounts` | Members can SELECT; editors and managers can INSERT/UPDATE/DELETE own-household accounts |
| `assets` | Members can SELECT; editors and managers can INSERT/UPDATE/DELETE |
| `transactions` | Members can SELECT; editors and managers can INSERT/UPDATE/DELETE |
| `snapshots` | Members can SELECT; system service role INSERT/UPDATE |
| `snapshot_assets` | Members can SELECT; system service role INSERT/UPDATE |

> **Note**: Cron jobs and snapshot writers run under the Supabase `service_role` key (server-side only) and bypass RLS. They must never be exposed client-side.

---

## 4. TypeScript Domain Types

These types live in `src/lib/types/domain.ts` and are the stable contract all slices share.

```typescript
// src/lib/types/domain.ts

export type Role = 'manager' | 'editor' | 'viewer';

export type SymbolType =
  | 'fiat_currency'
  | 'stock'
  | 'tefas_fund'
  | 'physical_commodity'
  | 'cryptocurrency'
  | 'custom';

export type TransactionType =
  | 'deposit'
  | 'debit'
  | 'transfer'
  | 'interest'
  | 'trade';

export type DisplayCurrency = 'TRY' | 'USD' | 'EUR';

export type PriceFetchStatus = 'success' | 'error' | 'skipped';

export type SnapshotTrigger = 'scheduled' | 'manual';

export type FeeSide = 'to' | 'from';

export type EntryMode = 'both_amounts' | 'to_amount_and_rate' | 'from_amount_and_rate';

// ─── Entities ───────────────────────────────────────────────────────────────

export interface Profile {
  id: string;
  displayName: string;
  email: string;
  createdAt: string;
  updatedAt: string;
}

export interface Household {
  id: string;
  name: string;
  displayCurrency: DisplayCurrency;
  createdAt: string;
  updatedAt: string;
}

export interface HouseholdMember {
  id: string;
  householdId: string;
  userId: string;
  role: Role;
  joinedAt: string;
  // Joined fields (populated when queried with profile)
  profile?: Pick<Profile, 'id' | 'displayName' | 'email'>;
}

export interface HouseholdInvite {
  id: string;
  householdId: string;
  code: string;
  role: Exclude<Role, 'manager'>;
  createdBy: string;
  expiresAt: string | null;
  maxUses: number | null;
  useCount: number;
  createdAt: string;
}

export interface Symbol {
  id: string;
  householdId: string | null;    // null = global symbol
  code: string;
  name: string | null;
  description: string | null;
  type: SymbolType;
  primaryConversionFiat: string | null;
  isActive: boolean;
  fetchConfig: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface ExchangeRate {
  id: string;
  symbolId: string;
  householdId: string | null;
  rate: number;
  fetchedAt: string;
  source: string | null;
}

export interface PriceFetchLog {
  id: string;
  householdId: string | null;
  symbolId: string | null;
  status: PriceFetchStatus;
  message: string | null;
  fetchedAt: string;
}

export interface Account {
  id: string;
  householdId: string;
  ownerId: string;
  name: string;
  institution: string | null;
  accountIdentifier: string | null;
  defaultSymbolId: string | null;
  createdAt: string;
  updatedAt: string;
  // Joined fields
  ownerProfile?: Pick<Profile, 'id' | 'displayName'>;
  defaultSymbol?: Pick<Symbol, 'id' | 'code' | 'name'>;
}

export interface Asset {
  id: string;
  householdId: string;
  accountId: string;
  symbolId: string;
  amount: number;
  createdAt: string;
  updatedAt: string;
  // Joined fields
  symbol?: Symbol;
  currentRate?: ExchangeRate;
}

export interface Transaction {
  id: string;
  householdId: string;
  type: TransactionType;
  date: string;
  toAssetId: string | null;
  fromAssetId: string | null;
  feeSide: FeeSide | null;       // which asset bears the fee; null = no fee
  toAmount: number | null;
  fromAmount: number | null;
  feeAmount: number | null;
  exchangeRate: number | null;
  entryMode: EntryMode | null;   // null treated as 'both_amounts'
  notes: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  // Joined fields (populated on list/detail queries)
  toAsset?: Asset & { symbol: Symbol };
  fromAsset?: Asset & { symbol: Symbol };
}

export interface Snapshot {
  id: string;
  householdId: string;
  takenAt: string;
  netWorthTry: number | null;
  netWorthUsd: number | null;
  netWorthEur: number | null;
  trigger: SnapshotTrigger;
  createdAt: string;
  updatedAt: string;
}

export interface SnapshotAsset {
  id: string;
  snapshotId: string;
  householdId: string;
  assetId: string;
  symbolId: string;
  amount: number;
  exchangeRate: number;
  valueInDisplayCurrency: number;
  createdAt: string;
  updatedAt: string;
}

// ─── Computed / View types ────────────────────────────────────────────────

/** Asset enriched with computed performance metrics */
export interface AssetWithPerformance extends Asset {
  symbol: Symbol;
  currentValueInDisplayCurrency: number;
  costBasisInDisplayCurrency: number | null;
  gainLoss: number | null;
  gainLossPct: number | null;
  cagr: number | null;
}

/** Dashboard summary */
export interface PortfolioSummary {
  netWorth: number;
  displayCurrency: DisplayCurrency;
  change24h: number | null;
  change7d: number | null;
  change30d: number | null;
  changeAllTime: number | null;
  byType: Record<SymbolType, number>;
  byCurrencyExposure: { try: number; usd: number; eur: number; other: number };
}

// ─── Server Action result wrapper ────────────────────────────────────────

export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };
```

---

## 5. Server Action Signatures

All mutations are Server Actions. These signatures define the stable API contract between slices.

### auth.ts

```typescript
createHousehold(input: { householdName: string; displayCurrency: DisplayCurrency }): Promise<ActionResult<{ householdId: string }>>
```

### households.ts

```typescript
updateHousehold(householdId: string, input: { name?: string; displayCurrency?: DisplayCurrency }): Promise<ActionResult>
deleteHousehold(householdId: string): Promise<ActionResult>

createInvite(householdId: string, input: { role: 'editor' | 'viewer'; expiresAt?: string; maxUses?: number }): Promise<ActionResult<HouseholdInvite>>
revokeInvite(inviteId: string): Promise<ActionResult>
acceptInvite(code: string): Promise<ActionResult<{ householdId: string }>>

updateMemberRole(memberId: string, role: Role): Promise<ActionResult>
removeMember(memberId: string): Promise<ActionResult>
```

### symbols.ts

```typescript
createSymbol(householdId: string, input: Omit<Symbol, 'id' | 'createdAt' | 'updatedAt'>): Promise<ActionResult<Symbol>>
updateSymbol(symbolId: string, input: Partial<Pick<Symbol, 'name' | 'description' | 'isActive' | 'fetchConfig'>>): Promise<ActionResult<Symbol>>
deleteSymbol(symbolId: string): Promise<ActionResult>
```

### accounts.ts

```typescript
createAccount(householdId: string, input: { name: string; institution?: string; accountIdentifier?: string; defaultSymbolId?: string }): Promise<ActionResult<Account>>
updateAccount(accountId: string, input: { name?: string; institution?: string; accountIdentifier?: string; defaultSymbolId?: string; ownerId?: string }): Promise<ActionResult<Account>>
deleteAccount(accountId: string): Promise<ActionResult>
```

### assets.ts

```typescript
createAsset(householdId: string, input: { accountId: string; symbolId: string; amount?: number }): Promise<ActionResult<Asset>>
updateAssetAmount(assetId: string, amount: number): Promise<ActionResult<Asset>>
deleteAsset(assetId: string): Promise<ActionResult>
```

### transactions.ts

```typescript
createTransaction(householdId: string, input: {
  type: TransactionType;
  date: string;
  toAssetId?: string;
  fromAssetId?: string;
  feeSide?: FeeSide;             // which asset bears the fee
  toAmount?: number;
  fromAmount?: number;
  feeAmount?: number;
  exchangeRate?: number;
  entryMode?: EntryMode;         // Trade only; null → 'both_amounts'
  notes?: string;
}): Promise<ActionResult<Transaction>>

updateTransaction(transactionId: string, input: Partial<{
  date: string;
  toAmount: number;
  fromAmount: number;
  feeAmount: number;
  exchangeRate: number;
  notes: string;
  // feeSide and entryMode are immutable after creation
}>): Promise<ActionResult<Transaction>>

deleteTransaction(transactionId: string): Promise<ActionResult>
```

### snapshots.ts

```typescript
triggerManualSnapshot(householdId: string): Promise<ActionResult<Snapshot>>
```

---

## 6. Price Fetching: Resolved Decisions

All API decisions are resolved. The `fetch_config` JSONB column on `symbols` accommodates any per-symbol configuration these fetchers require without a schema change.

> **Cron scheduling decisions** are also recorded here.

---

### 6.1 Fiat FX Rates

**Decision**: TCMB EVDS for TRY pairs + Frankfurter API for EUR/USD cross.

| Symbol | Source | Notes |
|---|---|---|
| USD/TRY, EUR/TRY, GBP/TRY, CHF/TRY | TCMB EVDS | Official Turkish Central Bank rates. Free, unlimited, requires API key stored in env. |
| EUR/USD, GBP/USD, CHF/USD (cross rates) | Frankfurter API | ECB-based, free, no key required. Used to derive non-TRY cross rates. |

---

### 6.2 Tefas Mutual Funds

**Decision**: `tefas-crawler` npm package.

Wraps the unofficial Tefas JSON endpoint. No API key required. Package is open source and actively maintained. Fund codes (e.g., `TI1`, `MAC`) go in `fetch_config.tefasCode`.

---

### 6.3 BIST Stocks

**Decision**: `yahoo-finance2` npm package.

Covers all BIST-listed stocks via the `.IS` suffix (e.g., `THYAO.IS`, `XU100.IS`). Prices returned in TRY. No API key required. Ticker suffix goes in `fetch_config.yahooTicker`. Google Finance has no public API and must not be used.

---

### 6.4 Cryptocurrency

**Decision**: Binance Public REST API.

> **Implementation note**: The PM has existing JS code for this fetcher. When Slice 5 reaches crypto price fetching, **stop and wait for the PM to provide the script** before implementing `src/lib/price-fetchers/crypto.ts`.

No authentication required for public price endpoints. Symbol pair (e.g., `BTCUSDT`) goes in `fetch_config.binancePair`.

---

### 6.5 Physical Gold & Silver (TRY-denominated)

**Decision**: CollectAPI (100 req/month free plan, ~2 req/day — sufficient for scheduled fetching).

> **Implementation note**: The PM has existing JS code for this fetcher. When Slice 5 reaches gold price fetching, **stop and wait for the PM to provide the script** before implementing `src/lib/price-fetchers/gold.ts`.

Covers Turkish physical gold variants (gram altın, çeyrek, yarım, tam altın) and XAU/XAG. API key stored in env. Identifier goes in `fetch_config.collectApiKey`.

---

### 6.6 Global Symbol Seed List

The following symbols are seeded in `seed.sql` as global symbols (`household_id = null`):

| Code | Name | Type | primary_conversion_fiat |
|---|---|---|---|
| `TRY` | Turkish Lira | fiat_currency | null |
| `USD` | US Dollar | fiat_currency | null |
| `EUR` | Euro | fiat_currency | null |
| `GBP` | British Pound | fiat_currency | null |
| `BTC` | Bitcoin | cryptocurrency | USD |
| `ETH` | Ethereum | cryptocurrency | USD |
| `XAU` | Gold (Troy oz) | physical_commodity | USD |
| `XAG` | Silver (Troy oz) | physical_commodity | USD |
| `ALTIN_GRAM` | Gram Altın | physical_commodity | TRY |
| `ALTIN_CEYREK` | Çeyrek Altın | physical_commodity | TRY |
| `ALTIN_YARIM` | Yarım Altın | physical_commodity | TRY |
| `ALTIN_TAM` | Tam Altın | physical_commodity | TRY |

**Turkish gold variant identifiers**: Standard ISO codes do not exist for gram/çeyrek/yarım/tam altın. These use the `ALTIN_*` prefix convention and are typed as `physical_commodity`. Their `fetch_config` will reference CollectAPI identifiers once the PM provides the script. This is not a schema issue — the `symbols` table accommodates any string code; uniqueness is enforced globally for these as for all global symbols.

---

### 6.7 Cron Scheduling

Two separate Vercel cron jobs (free tier supports up to 2 cron expressions):

| Job | Route | Schedule | Notes |
|---|---|---|---|
| Price fetch | `/api/cron/price-fetch` | `*/15 * * * *` (every 15 min, 24/7) | All time restrictions are symbol-type-based in the dispatcher: tefas_fund weekdays 10:00–17:00 Istanbul; physical_commodity any day 10:00–17:00 Istanbul; fiat/crypto/stock unrestricted |
| Snapshot | `/api/cron/snapshot` | `0 0,6,12,18 * * *` (00:00, 06:00, 12:00, 18:00 UTC) | Every 6 hours |

Both routes are secured with a `CRON_SECRET` header checked at the start of each handler.

---

### 6.8 Multi-Household UX (MVP Decision)

The schema supports users belonging to multiple households. For the MVP:
- Skip the household picker UI entirely.
- After login, the app defaults to the user's first household (ordered by `joined_at asc`).
- If the user belongs to no household, redirect to household creation.
- Multi-household switching will be added in a later phase.

---

## 7. Slice Breakdown

### Slice 1a — Project Scaffold + Auth

**Deliverables:**
- Next.js project initialized with TypeScript strict, Tailwind CSS v4, shadcn/ui
- `tsconfig.json` with `strict: true`; `next.config.ts` with no `output: 'export'` (Vercel URL wrapper for Capacitor)
- Supabase project connected; server-side client in `src/lib/supabase/server.ts`
- Migrations for: `profiles`, `households`, `household_members`, `household_invites`
- `handle_new_user` trigger (auto-creates `profiles` row on auth.users insert)
- RLS policies for all four tables
- Login and register pages (`/login`, `/register`) — email + password via Supabase Auth
- Auth middleware (`src/middleware.ts`) for token refresh
- Protected layout (`src/app/(private)/layout.tsx`) — verifies session server-side; redirects unauthenticated users to `/login`
- Post-signup redirect: if the user belongs to no household, redirect to `/onboarding` (household creation form)
- Root page (`/`) redirects to `/dashboard` or `/login`

**Testable outcome**: PM can register, log in, see the household creation prompt (because no household exists yet), and be redirected to `/dashboard` after creating one. Navigating directly to `/dashboard` while logged out redirects to `/login`.

---

### Slice 1b — Household Management

**Deliverables:**
- Household creation form at `/onboarding` (name + display currency)
- `createHousehold` Server Action — creates `households` row and inserts creator as `manager` in `household_members`
- Invite link generation (Manager-only): `createInvite` Server Action producing a unique code
- Invite acceptance page at `/invite/[code]` — verifiable by unauthenticated users; requires login/register before accepting
- `acceptInvite` Server Action — validates code (not expired, under max uses), inserts `household_members` row, increments `use_count`
- Settings — Household page (`/settings/household`): edit name, display currency; delete household (Manager only)
- Settings — Members page (`/settings/members`): list members with roles; change role (Manager only); remove member (Manager only); list and revoke active invite links (Manager only)

**Testable outcome**: PM can create a household, generate an invite link, open it in incognito, register a second account, accept the invite, and see both users on the Members settings page. The PM can change the second user's role and remove them.

---

### Slice 2 — Symbols, Accounts & Assets

**Deliverables:**
- Migrations for: `symbols`, `accounts`, `assets`
- `seed.sql` seeding all global symbols from Section 6.6
- RLS policies for all three tables
- Settings — Symbols page (`/settings/symbols`): Manager can add/edit/deactivate household-custom symbols; global symbols displayed read-only
- Accounts page (`/accounts`): list accounts with owner and asset count; create, edit, delete (Editor/Manager for own accounts; Manager for any)
- Assets panel within accounts: list assets per account; add asset (symbol picker + initial amount); edit amount; delete
- Role enforcement in all Server Actions: Viewer cannot mutate; Editor restricted to own accounts

**Testable outcome**: PM can create two accounts, add different assets to each, and see them listed. A Viewer-role member can view but gets an error when trying to create or edit.

---

### Slice 3 — Transactions

**Deliverables:**
- Migrations for: `transactions` (DDL in §2.10) and `apply_transaction` / `update_transaction` / `reverse_and_delete_transaction` RPCs (DDL in §2.13)
- RLS policies for `transactions`
- Transaction list page (`/transactions`): filterable by date range, type, account, symbol; shows all five types
- New transaction form (`/transactions/new`): type selector renders the appropriate field set:
  - **Deposit / Interest**: to_asset, to_amount, date, notes
  - **Debit**: from_asset, from_amount, date, notes
  - **Transfer**: from_asset, to_asset (same symbol enforced client + server), from_amount, to_amount, date, notes
  - **Trade**: from_asset, to_asset, from_amount, to_amount, exchange_rate (auto-computed from amounts or user-override), fee_asset, fee_amount, date, notes
- Edit transaction form (same layout as new; restricted to mutable fields)
- Delete transaction (with confirmation dialog)
- **Atomicity requirement**: `createTransaction`, `updateTransaction`, and `deleteTransaction` Server Actions must call `apply_transaction`, `update_transaction`, and `reverse_and_delete_transaction` Supabase RPCs respectively. Sequential separate queries for transaction + asset updates are not permitted. The RPC call is a single `supabase.rpc(...)` invocation; the database function handles both the transaction record and all asset amount changes within one transaction.

**Testable outcome**: PM can record a Trade (buy BTC with USD), see BTC balance increase and USD balance decrease accordingly. PM can edit the trade amount and see balances recalculate. PM can delete the trade and see balances return to their prior values.

---

### Slice 4 — Price Fetching

**Deliverables:**
- Migrations for: `exchange_rates` (DDL in §2.6), `price_fetch_log` (DDL in §2.7)
- RLS policies for both tables
- `src/lib/price-fetchers/index.ts` — dispatcher: iterates active symbols, routes to fetcher by `type`
- `src/lib/price-fetchers/fiat.ts` — TCMB EVDS + Frankfurter (Section 6.1)
- `src/lib/price-fetchers/tefas.ts` — `tefas-crawler` package (Section 6.2)
- `src/lib/price-fetchers/stocks.ts` — `yahoo-finance2` package (Section 6.3)
- `src/lib/price-fetchers/crypto.ts` — **STOP: wait for PM to provide existing JS script before implementing**
- `src/lib/price-fetchers/gold.ts` — **STOP: wait for PM to provide existing JS script before implementing**
- `fetch_config` shape per fetcher type documented in code comments
- Cron Route Handler (`/api/cron/price-fetch`) secured with `CRON_SECRET` header; runs every 15 min weekdays, crypto unconditionally
- `triggerPriceFetch` Server Action for manual "Refresh Now" button
- Price fetch status widget: last fetched time, source, last error per symbol (uses `price_fetch_log`)
- Fallback: on fetch error, log the error and retain the most recent `exchange_rates` row

**Testable outcome**: PM can see current prices for all seeded symbols. After "Refresh Now", `fetched_at` timestamps update. PM can view the status widget showing last update time and any errors.

---

### Slice 5 — Snapshots

**Deliverables:**
- Migrations for: `snapshots` (DDL in §2.11), `snapshot_assets` (DDL in §2.12)
- RLS policies for both tables
- Snapshot creation logic: for each asset in the household, record `amount`, latest `exchange_rate`, and computed `value_in_display_currency`; sum to produce `net_worth_try/usd/eur`
- Cron Route Handler (`/api/cron/snapshot`) secured with `CRON_SECRET`; schedule: `0 0,6,12,18 * * *`
- `triggerManualSnapshot` Server Action (wired to "Refresh Now" button)
- Snapshot history list: read-only table of past snapshots with timestamp, trigger, and net worth values (for debugging/verification)

**Testable outcome**: PM can click "Refresh Now" and see a new snapshot row appear in the history with the correct net worth. Simulating a cron call to `/api/cron/snapshot` with the correct secret produces another row.

---

### Slice 6 — Dashboard

**Deliverables:**
- Dashboard page (`/dashboard`) with mobile-first layout (375px minimum width, 44px tap targets)
- Net worth card: current value in household display currency; 24h / 7d / 30d / all-time change (sourced from `snapshots`)
- Net worth chart (Recharts): day / week / month / year time-range toggle; data from `snapshots`
- Asset breakdown: donut chart by `SymbolType`; bar or stacked chart by currency exposure (TRY-indexed / USD-indexed / EUR-indexed)
- Individual asset performance table: symbol, amount, current value, cost basis, G/L (amount and %), CAGR
- `src/lib/utils/calculations.ts` implementing:

```typescript
// CAGR formula per PRD
function cagr(currentValue: number, costBasis: number, daysHeld: number): number {
  const dailyRate = Math.pow(currentValue / costBasis, 1 / daysHeld) - 1;
  return Math.pow(1 + dailyRate, 365) - 1;  // annualised; multiply exponent by 30/7 for monthly/weekly
}
```

**Testable outcome**: PM can see their total net worth, the chart showing historical snapshots, asset type breakdown, and per-asset CAGR. All values are consistent with manual calculations from known transactions and snapshot data.

---

### Slice 7 — Household Management UI Polish

**Deliverables:**
- Admin panel pages reach feature-complete state per PRD:
  - Edit account ownership (Manager only) — wires `updateAccount` `ownerId` field
  - Manager-only: edit and delete any account/asset (not just own)
  - Household delete flow with confirmation
- Price fetch status accessible from settings (link from `/settings/household`)
- Any UX gaps from earlier slices flagged by the PM, scoped and fixed in this slice

**Testable outcome**: PM can transfer account ownership to another member and delete an account that belongs to another user (as Manager). PM can delete the household with a confirmation dialog.

---

### Slice 8 — Android APK (Capacitor)

**Architecture decision**: The APK is a WebView wrapper pointing to the deployed Vercel URL. `output: 'export'` is not used in `next.config.ts`. Server Actions remain unaffected.

**Deliverables:**
- `@capacitor/core` and `@capacitor/android` installed
- `capacitor.config.ts` configured: `appId`, `appName`, `webDir: 'out'` overridden with `server.url` pointing to the production Vercel URL
- Android project generated (`npx cap add android`)
- `capacitor.config.ts` sets `server.url` to Vercel deployment URL so the WebView loads the live app
- APK build steps documented in `README.md` (run once, stored for reference)
- Splash screen and app icon configured
- Tested on at minimum one physical Android device

**Testable outcome**: PM can build the APK, install it on their Android device, and use the full app including login, dashboard, and transaction entry.

---

## 8. Clarifications

Post-approval clarifications that refine slice behaviour without changing the slice contract structure.

---

### Manual Snapshot Window Logic (post-approval clarification, 2026-04-04)

`triggerManualSnapshot` must implement window-based deduplication. Algorithm:

1. Find the most recent `scheduled` snapshot for the household — its `taken_at` defines the current window start.
2. Check for a `manual` snapshot with `taken_at` after that boundary.
3. If found: update it in place (`taken_at`, net worth fields, `updated_at` only — never `id` or `created_at`), delete its `snapshot_assets` child rows and re-insert fresh ones.
4. If not found: insert normally.

Scheduled snapshots are entirely unaffected by this logic. If no scheduled snapshot exists, the insert path is always taken.

*End of TECHNICAL_PLAN.md — awaiting PM review and approval.*
