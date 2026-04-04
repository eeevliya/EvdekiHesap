# UI_PLAN.md — EvdekiHesap

> **Status**: Approved
> **Version**: 1.0
> **Date**: 2026-04-04
>
> This document governs UI implementation decisions: visual design, layout, navigation,
> page composition, and component structure.
>
> It does not define business logic, data computation rules, or Server Action behaviour —
> those belong in TECHNICAL_PLAN.md and PRD.md. When this document and TECHNICAL_PLAN.md
> appear to conflict on a non-visual matter, TECHNICAL_PLAN.md takes precedence.
>
> Do not modify without explicit PM approval.

---

## Table of Contents

1. [Reference Material](#1-reference-material)
2. [Design System](#2-design-system)
3. [Layout Patterns](#3-layout-patterns)
4. [Navigation](#4-navigation)
5. [Page Specifications](#5-page-specifications)
6. [Component Inventory](#6-component-inventory)
7. [Implementation Notes](#7-implementation-notes)

---

## 1. Reference Material

The visual reference for this project is a v0.app-generated dashboard located at:

```
.claude/ui-reference/
```

This folder is **read-only reference material**. Do not run it, merge its config files, or copy
code verbatim. Adapt its visual patterns, color values, and component structures into the
project's own component architecture under `src/components/`.

The reference project has its own `next.config.mjs`, `tsconfig.json`, `package.json`, and
`postcss.config.mjs`. Ignore all of these. Only component and style files are relevant.

---

## 2. Design System

### 2.1 Color Tokens

Define these as CSS variables in `src/app/globals.css`. All components reference these
variables — never hardcode color values.

```css
/* Background layers */
--color-bg-base:        oklch(0.22 0.04 255);   /* page background */
--color-bg-card:        oklch(0.14 0.05 255);   /* card surface */
--color-bg-card-hover:  oklch(0.17 0.05 255);   /* card hover */
--color-bg-input:       oklch(0.18 0.04 255);   /* form inputs */
--color-bg-sidebar:     oklch(0.12 0.05 255);   /* sidebar / bottom nav */

/* Foreground */
--color-fg-primary:     oklch(0.98 0 0);        /* primary text */
--color-fg-secondary:   oklch(0.70 0.02 255);   /* muted text */
--color-fg-disabled:    oklch(0.45 0.02 255);   /* disabled / placeholder */

/* Accent — vivid cyan */
--color-accent:         oklch(0.80 0.16 195);   /* primary accent, active states */
--color-accent-dim:     oklch(0.65 0.12 195);   /* accent on dark bg, icons */
--color-accent-subtle:  oklch(0.22 0.05 195);   /* accent tint bg */

/* Semantic */
--color-positive:       oklch(0.75 0.15 155);   /* green — gains, success */
--color-negative:       oklch(0.65 0.18 25);    /* red — losses, errors */
--color-warning:        oklch(0.80 0.14 75);    /* amber — warnings, stale */
--color-neutral:        oklch(0.70 0.02 255);   /* neutral change */

/* Chart palette — used in order for multi-series charts */
--color-chart-1:        oklch(0.80 0.16 195);   /* cyan */
--color-chart-2:        oklch(0.65 0.18 270);   /* indigo */
--color-chart-3:        oklch(0.70 0.18 300);   /* violet */
--color-chart-4:        oklch(0.75 0.15 155);   /* green */
--color-chart-5:        oklch(0.72 0.16 240);   /* blue */

/* Borders */
--color-border:         oklch(0.28 0.04 255);   /* subtle card/input border */
--color-border-strong:  oklch(0.38 0.04 255);   /* focused input, dividers */

/* Shadows */
--shadow-card:          0 8px 32px oklch(0 0 0 / 0.40);
--shadow-elevated:      0 16px 48px oklch(0 0 0 / 0.55);
```

### 2.2 Typography

Use the `Geist` font family (already available in Next.js). Do not substitute Inter, Roboto,
or system fonts.

| Role | Class | Usage |
|---|---|---|
| Display | `text-3xl font-bold tracking-tight` | Net worth headline, page titles |
| Heading | `text-lg font-semibold` | Card titles, section headers |
| Body | `text-sm font-normal` | Default text, table rows |
| Caption | `text-xs font-normal` | Labels, timestamps, helper text |
| Mono | `font-mono text-sm` | Amounts, rates, asset codes |

All monetary amounts use `font-mono` to ensure digit alignment in tables.

### 2.3 Spacing & Sizing

- Minimum tap target: **44px** (height and width) on all interactive elements
- Card padding: `p-5` on mobile, `p-6` on desktop
- Card gap: `gap-4` on mobile, `gap-5` on desktop
- Card border-radius: `rounded-2xl`
- Input and button border-radius: `rounded-xl`

### 2.4 Shadows & Depth

Every card uses `shadow-card`. Modals, dropdowns, and popovers use `shadow-elevated`.
Do not use flat cards — shadow depth creates the layered-navy visual identity.

### 2.5 Interactive States

| State | Treatment |
|---|---|
| Hover (card) | `bg-[--color-bg-card-hover]` + `translate-y-[-1px]` |
| Hover (button) | `hover:brightness-110` |
| Active nav item | `text-[--color-accent]` + accent-tinted background pill |
| Focus (input) | `border-[--color-border-strong]` + `ring-1 ring-[--color-accent]` |
| Disabled | `opacity-40 cursor-not-allowed` |
| Loading | Skeleton shimmer (see §6.2) |

---

## 3. Layout Patterns

### 3.1 Responsive Breakpoints

| Breakpoint | Layout |
|---|---|
| `< 768px` | Single column cards, fixed bottom navigation |
| `768px–1024px` | Two-column card grid, fixed left sidebar (icon-only) |
| `> 1024px` | Three-column masonry card grid, fixed left sidebar (full labels) |

Minimum supported width: **375px**.

### 3.2 Mobile Layout

- Cards stack in a single column, full width, `gap-4`
- Fixed bottom navigation bar, height 64px, `pb-safe` for notch safe area
- Page content has `pb-20` to clear the bottom nav
- Sticky top bar: page title left, primary action button right
- No sidebar on mobile

### 3.3 Desktop Layout

- Fixed left sidebar: 220px wide, full height, `bg-[--color-bg-sidebar]`
- Main content: `ml-[220px]`, `px-6 py-6`
- Cards in CSS columns masonry: `columns-1 md:columns-2 lg:columns-3`, `gap-5`
- Dashboard card drag-and-drop: **in-session only, no persistence**. Use
  `@dnd-kit/core` + `@dnd-kit/sortable`. Order resets on page reload.
  Install these packages only when implementing the Dashboard slice.

### 3.4 Card Anatomy

```
┌─────────────────────────────────────┐
│  Card Title            [Action btn] │  ← flex justify-between items-center
│─────────────────────────────────────│  ← optional divider
│                                     │
│  Card content                       │
│                                     │
└─────────────────────────────────────┘
```

Use the shared `<Card>` wrapper from `src/components/shared/card.tsx` (custom — not shadcn Card).

### 3.5 Loading States

Every async data region uses a **skeleton shimmer** placeholder. Spinners are reserved for
in-progress actions (button states, form submission). Define the shimmer animation once in
`globals.css`; apply via the `<Skeleton>` component.

### 3.6 Empty States

Every list, table, and chart must have an empty state:
- A lucide-react icon
- One-line explanation ("No transactions yet")
- CTA button where applicable ("Add your first transaction")

---

## 4. Navigation

### 4.1 Items

| Label | Route | Icon (lucide-react) | Visibility |
|---|---|---|---|
| Dashboard | `/dashboard` | `LayoutDashboard` | Both |
| Accounts | `/accounts` | `Wallet` | Both |
| Transactions | `/transactions` | `ArrowLeftRight` | Both |
| Rates | `/rates` | `TrendingUp` | Both |
| Household | `/household` | `Home` | Both |
| Settings | `/settings` | `Settings` | Desktop sidebar only |

Mobile bottom nav shows five items: Dashboard, Accounts, Transactions, Rates, Household.
Settings is excluded from the bottom nav — reachable via the kebab menu (⋮) in the top header.

### 4.2 Top Header (Mobile)

Fixed sticky bar on all mobile pages:
- Left: current page title
- Right: kebab menu (⋮) → Settings + Sign Out

### 4.3 Desktop Sidebar

- App logo / name at top
- Nav items: icon + label, vertically stacked
- Active item: accent text + accent-tinted background pill
- User display name at bottom — clicking opens a popover with Settings and Sign Out links

---

## 5. Page Specifications

---

### 5.1 Dashboard (`/dashboard`)

Four cards in a fixed responsive layout — no drag-and-drop.

Column layout by breakpoint:
- **xl (≥1280 px) — 3 columns**: Col 1 = Net Worth + Performance | Col 2 = Asset Breakdown | Col 3 = Chart
- **md (768–1279 px) — 2 columns**: Col 1 = Net Worth + Performance | Col 2 = Asset Breakdown then Chart below
- **mobile (< 768 px) — 1 column**: Net Worth → Performance → Asset Breakdown → Chart

#### Net Worth Card
- Large `font-mono` display of current net worth in household display currency
- Three change badges: 24h / 7d / 30d — each badge shows an up/down arrow alongside
  the percentage; positive uses `--color-positive`, negative uses `--color-negative`
- "Refresh Now" button — calls `triggerManualSnapshot`. See `TECHNICAL_PLAN.md` for
  overwrite behaviour.

#### Asset Breakdown Card
- Donut chart (Recharts `PieChart`) with `--color-chart-*` palette
- Segments by asset (one segment per distinct symbol held)
- Legend below: symbol code + percentage of total net worth

#### Chart Card
Two tabs:

**Gain/Loss tab** — line chart (Recharts `LineChart`):
- One line per asset, using `--color-chart-*` palette
- Total gain/loss line: thicker (`strokeWidth={3}`)
- X-axis: time. Range buttons: 1D / 1W / 1M / 1Y

**Net Worth tab** — stacked bar chart (Recharts `BarChart`):
- Each bar segment = one asset's contribution to net worth at that point in time
- Same `--color-chart-*` palette, consistent asset-to-color mapping across both tabs
- Same time range buttons: 1D / 1W / 1M / 1Y

Both charts use `ResponsiveContainer` to fill card width.

#### Performance Card
Always-visible summary:
- Total G/L: prominent `font-mono` amount in display currency with up/down arrow
  (red/green). Derived G/L % shown below (`gainLossAmount / costBasis × 100`).
  Both show "—" when no snapshot G/L data exists yet.
- Best / Worst columns: two columns, up to 3 assets each, ranked by G/L % desc/asc.
  Best uses `--color-positive`, Worst uses `--color-negative`. Hidden entirely when
  no assets have G/L data.
Asset performance table (only assets with G/L data):
- Columns: Symbol | Amount | Current Value | Cost Basis | G/L | G/L % | CAGR
- Client-side sortable on any column. Default: current value desc.
- Monetary values right-aligned, `font-mono`.
- Positive G/L: `--color-positive`. Negative: `--color-negative`.
- CAGR: annualized %, two decimal places.
- Rendered flat (no nested card border) inside the Performance card.

**Desktop**: table always visible inline below the summary — no toggle.

**Mobile**: expand/collapse toggle (ChevronDown/Up) bottom-right. Table collapsed by default; expands inline inside the card.

---

### 5.2 Accounts (`/accounts`)

Vertically stacked list of account cards. Each is an expandable accordion.

#### Account Card (collapsed)
- Account name | Institution (if set) | Owner display name
- Asset count badge | Total value in display currency
- Expand chevron right-aligned
- Edit + Delete icon buttons:
  - Manager: visible on all accounts
  - Editor: visible on own accounts only
  - Viewer: neither

#### Account Card (expanded)
Asset table: Symbol Code | Symbol Name | Amount | Current Value | Last Rate | Rate Age

- Rate Age: relative time since `fetched_at` (e.g. "3 min ago")
- Add Asset button at bottom (Editor/Manager only)
- Each asset row: Edit (amount) + Delete icon buttons (Editor/Manager, own accounts only)

#### Add / Edit Account Sheet (shadcn `Sheet`)
Fields: Name (required) | Institution | Account Identifier | Default Symbol (picker)

Owner field:
- Manager editing any account: Owner is an editable member picker
- Editor creating an account: Owner defaults to self, not editable
- Editor editing own account: Owner not shown

#### Add / Edit Asset Sheet
- Creating: Symbol (searchable picker from active symbols) | Initial Amount (optional, defaults 0)
- Editing: Amount field only

---

### 5.3 Transactions (`/transactions`)

#### Transaction Table
Columns: Date | Type | From | To | Amount | Fee | Notes | Actions

- From / To cells: `[Symbol Code] @ [Account Name]` or "—" if null
- Amount cell:
  - Trade: `[from_amount] [from_symbol] → [to_amount] [to_symbol]`
  - Other types: single amount + symbol
- Type badge (color-coded pill):
  - Deposit / Interest: `--color-positive` tint
  - Debit: `--color-negative` tint
  - Transfer: `--color-neutral` tint
  - Trade: `--color-accent` tint
- Actions: Edit | Delete — Editor/Manager only

#### Filters Bar
Filters: Account (multi-select) | Account Owner (member picker) | Symbol (multi-select) |
Type (multi-select) | Date range

All filters are client-side on the current loaded dataset. "Clear filters" resets all.
Sorting: click column header toggles asc/desc. Default: date desc.

#### Page Header
"Add Transaction" button — top right — navigates to `/transactions/new`

#### New / Edit Transaction (`/transactions/new`, `/transactions/[id]/edit`)

- Type selector at top (segmented control): Deposit | Debit | Transfer | Interest | Trade
- Field sets per type as specified in `TECHNICAL_PLAN.md` §7 Slice 3
- Asset pickers: searchable dropdown showing `[Account Name] — [Symbol Code]`
- Transfer: same-symbol constraint should be visually communicated — once From asset is
  selected, the To asset picker is pre-filtered to the same symbol
- Trade entry mode toggle: **Both Amounts** | **From + Rate** | **To + Rate** —
  the derived field is shown read-only
- Exchange rate label: `[to_symbol] per [from_symbol]` (e.g. "BTC per USD")
- Fee section: collapsed by default, expandable. Contains Fee Side toggle + Fee Amount field
- Date: defaults to now, user-overridable
- "Save Transaction" button. Cancel navigates back.

---

### 5.4 Rates (`/rates`)

#### Conversion Tool (top of page)
- From symbol picker | Amount input → swap button (↔) → To symbol picker | Result (read-only)
- Pure client-side calculation using rates already loaded on the page — no API call

#### Rates Table
Columns: Symbol | Name | Type | Rate | Currency | Source | Last Updated | Status

- Status badge: Success (green) | Error (red) | Stale (amber)
- Staleness threshold defined in `TECHNICAL_PLAN.md`
- Last Updated: relative time with exact timestamp on hover (tooltip)
- Error rows: last error message from `price_fetch_log` shown on hover
- Rows grouped by `SymbolType` with collapsible group headers

#### Page Header
- "Refresh Now" button — top right — triggers price fetch for all active symbols.
  Spinner while in-flight. Table updates on completion.
- "Manage Symbols" button — secondary — navigates to `/rates/symbols`

#### Symbols Subpage (`/rates/symbols`)

Manager-only. Editors and Viewers see a permission message.

- Global symbols: read-only rows with a "Global" badge
- Household symbols: Edit + Delete controls for Manager
- "Add Symbol" button — top right — opens Add Symbol sheet

Add / Edit Symbol Sheet:
Fields: Code | Name | Description | Type (select) | Primary Conversion Fiat | Active (toggle)

---

### 5.5 Household (`/household`)

All members can view. Only Manager can edit.

#### Household Preferences Section
- Household name: inline editable (Manager only)
- Display currency selector: TRY / USD / EUR (Manager only)
- Danger zone: "Delete Household" — requires typing household name to confirm,
  followed by a confirmation dialog. Manager only.

#### Members Section
Table: Display Name | Email | Role | Joined | Actions

- Actions (Manager only): Change Role (inline select) | Remove (trash + confirm dialog)
- Manager cannot change their own role or remove themselves
- "Invite Member" button — opens Invite Sheet

Invite Sheet (Manager only):
- Role: Editor | Viewer
- Optional: expiry date | max uses
- On submit: display generated invite link with a copy button
- List active invites below with individual revoke buttons

---

### 5.6 Settings (`/settings`)

Personal account settings only. Household management is at `/household`.

#### Profile Section
- Display name (editable)
- Email (read-only)
- Phone number (optional, editable) — read/written via `supabase.auth.updateUser`, no migration needed
- Save button

#### Password Section
- Current password | New password | Confirm new password
- Save triggers `supabase.auth.updateUser` with new password

#### Appearance Section
Placeholder card only: "More settings coming soon." Do not implement.

---

### 5.7 Onboarding (`/onboarding`)

Simple centered card (no sidebar, no bottom nav):
- App logo / name at top
- "Welcome — let's set up your household" heading
- Fields: Household name | Display currency (TRY / USD / EUR, default TRY)
- "Create Household" button full width
- Matches app color scheme and card styling

---

### 5.8 Login (`/login`) and Register (`/register`)

Simple centered single-card layout (no sidebar, no bottom nav):
- App logo centered above card
- Card: `bg-[--color-bg-card]`, `shadow-elevated`, `rounded-2xl`, `p-8`
- Email + password fields
- Submit button full width
- Link between pages
- Inline field-level error messages (not toasts)
- Login only: "Forgot password?" link — triggers Supabase password reset email, no custom page needed

---

### 5.9 Invite Acceptance (`/invite/[code]`)

Centered card layout matching Login/Register style. Four states:

1. **Valid, not logged in**: Household name + role being granted. "Log in to accept" and
   "Register to accept" buttons.
2. **Valid, logged in**: Invite details. "Accept Invite" button.
3. **Expired / invalid**: "This invite link is no longer valid."
4. **Already a member**: "You're already a member of this household."

---

## 6. Component Inventory

Build shared components before or alongside the first slice that needs them.

### 6.1 Layout Components

| Component | Path |
|---|---|
| `AppShell` | `src/components/shared/app-shell.tsx` |
| `Sidebar` | `src/components/shared/sidebar.tsx` |
| `BottomNav` | `src/components/shared/bottom-nav.tsx` |
| `TopHeader` | `src/components/shared/top-header.tsx` |
| `PageHeader` | `src/components/shared/page-header.tsx` |

### 6.2 Primitive Components

| Component | Path | Notes |
|---|---|---|
| `Card` | `src/components/shared/card.tsx` | Custom — not shadcn Card |
| `Skeleton` | `src/components/shared/skeleton.tsx` | Shimmer loading placeholder |
| `Badge` | `src/components/shared/badge.tsx` | Wraps shadcn Badge with variant map |
| `MonoAmount` | `src/components/shared/mono-amount.tsx` | Monetary amount, `font-mono` + color |
| `RelativeTime` | `src/components/shared/relative-time.tsx` | "3 min ago" with tooltip |
| `EmptyState` | `src/components/shared/empty-state.tsx` | Icon + message + optional CTA |
| `ConfirmDialog` | `src/components/shared/confirm-dialog.tsx` | Destructive action confirmation |

### 6.3 Feature Components

| Component | Path | First used |
|---|---|---|
| `NetWorthCard` | `src/components/dashboard/net-worth-card.tsx` | Dashboard |
| `AssetBreakdownChart` | `src/components/dashboard/asset-breakdown-chart.tsx` | Dashboard |
| `PerformanceChart` | `src/components/dashboard/performance-chart.tsx` | Dashboard |
| `AssetPerformanceTable` | `src/components/dashboard/asset-performance-table.tsx` | Dashboard |
| `AccountCard` | `src/components/accounts/account-card.tsx` | Accounts |
| `AssetRow` | `src/components/accounts/asset-row.tsx` | Accounts |
| `TransactionTable` | `src/components/transactions/transaction-table.tsx` | Transactions |
| `TransactionForm` | `src/components/transactions/transaction-form.tsx` | Transactions |
| `RatesTable` | `src/components/rates/rates-table.tsx` | Rates |
| `ConversionTool` | `src/components/rates/conversion-tool.tsx` | Rates |
| `MembersTable` | `src/components/household/members-table.tsx` | Household |
| `InviteSheet` | `src/components/household/invite-sheet.tsx` | Household |

---

## 7. Implementation Notes

- **Read `.claude/ui-reference/` before implementing any page.** Adapt visual patterns from the
  reference; do not copy code verbatim. The reference folder contains a complete v0.app project —
  only component and style files are relevant.
- **Do not use the shadcn `Card` component** for page cards. Use the custom
  `src/components/shared/card.tsx` which applies the design system tokens.
- **All charts use Recharts** (already installed). Do not install other charting libraries.
- **`@dnd-kit/core` and `@dnd-kit/sortable`**: install only at the start of the Dashboard slice.
- **Route consolidation**: `TECHNICAL_PLAN.md` defines `/settings/household` and
  `/settings/members` as separate routes. This UI Plan consolidates them into `/household`.
  Redirect old routes to `/household` until the new page is confirmed working, then remove them.
- **`/rates`** is a new top-level route not in `TECHNICAL_PLAN.md`. It requires no new schema —
  it uses existing `exchange_rates`, `price_fetch_log`, and `symbols` data with existing
  Server Actions.
- **`/rates/symbols`** is a new route not in `TECHNICAL_PLAN.md`. No new schema needed — it
  uses the existing `symbols` table and actions from `src/lib/actions/symbols.ts`.
- **Build shared components first** within each slice before building the page itself.
- **English only** for all UI text, labels, error messages, and placeholders.
- **44px minimum tap targets** on all interactive elements.