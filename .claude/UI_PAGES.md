# UI_PAGES.md — EvdekiHesap Page Specifications

> **Status**: Draft — pending merge into UI_PLAN.md after implementation
> **Date**: 2026-04-05
>
> This document specifies desktop and mobile layouts for all private pages.
> It supplements UI_PLAN.md and takes precedence over it where they conflict on layout.
> Design system tokens, typography, spacing, and component rules defined in UI_PLAN.md apply
> to everything in this document without exception.
>
> Do not modify without explicit PM approval.

---

## 1. Shared Layout Rules

### 1.1 Desktop (≥ 768px)

Every private page uses the fixed left sidebar (220px) defined in UI_PLAN.md §4.3.
No page uses a narrow centered content column. Content always fills the remaining width
(`calc(100vw - 220px)`) with `px-6 py-6` internal padding.

### 1.2 Mobile (< 768px)

Every private page uses the fixed bottom navigation bar defined in UI_PLAN.md §4.1.
The bottom nav contains five items: Dashboard, Accounts, Transactions, Rates, Household.
Settings is excluded from the bottom nav and is reachable via the kebab menu in the top header.

---

## 2. Dashboard (`/dashboard`)

### 2.1 Desktop

Cards render in the existing responsive masonry grid (three columns > 1024px, two columns
768px–1024px). Refer to UI_PLAN.md §3.1 for breakpoint behaviour — no changes to grid logic.

**Card order** (replaces the order in UI_PLAN.md §5.1):
1. Net Worth Card
2. Performance Card (Gain/Loss + Net Worth tabs)
3. Asset Breakdown Card
4. History Chart Card
5. Accounts Peek Card *(new)*
6. Transactions Peek Card *(new)*
7. Rates Peek Card *(new)*

Cards 1–4 are unchanged from UI_PLAN.md §5.1. Cards 5–7 are specified below.

---

#### Accounts Peek Card

- Card title: "Accounts" — with a "View All →" button (top right) routing to `/accounts`
- Content: list of account rows, one per account
  - Each row: account name (bold) left | total value in household display currency right
    (`font-mono`, accent color)
  - Clicking a row routes to `/accounts` with that account pre-selected in the detail panel
- Shows all accounts — no row cap
- Empty state: "No accounts yet" with a "Add Account" CTA button

#### Transactions Peek Card

- Card title: "Recent Transactions" — with a "View All →" button (top right) routing to
  `/transactions`
- Content: last 5 transactions, rendered using the same card format as mobile transaction
  cards (§4.2) — single-symbol format or trade format depending on transaction type
- No expand interaction — cards are display-only in this context
- Empty state: "No transactions yet" with an "Add Transaction" CTA button

#### Rates Peek Card

- Card title: "Rates" — with a "View All →" button (top right) routing to `/rates`
- Content: the 5 symbols with the largest absolute 24h change % (positive or negative),
  sorted by absolute change descending
- Each row: Symbol Code (bold) + Name (muted) left | Current Rate (`font-mono`) center |
  24h Change% right (color-coded green/red)
- The list fades out at the bottom: apply a gradient overlay from transparent to
  `--color-bg-card` over the last ~40px of the card content area, so the bottom row
  dissolves into the card background
- Empty state: "No rate data available"

---

### 2.2 Mobile

Cards stack in a single column, full width, `gap-4`. Order matches desktop (cards 1–7).
Asset performance table remains a table. Peek cards (5–7) render in the same format as
desktop but full width. No changes to existing card implementations.

---

## 3. Accounts (`/accounts`)

### 3.1 Desktop (≥ 768px) — Two-Column Split

The page is divided into two columns with no gap card between them — they sit side by side
within the page content area.

**Left column — 40% width:**
- Scrollable list of account cards
- Each card shows: account name (bold), institution (muted, below name), owner display name
  (muted, below institution), asset count badge (top right), total value in household display
  currency (bottom right, `font-mono`, accent color)
- Clicking a card selects it: card gets `border-[--color-accent]` border, detail panel loads
  on the right
- First account in the list is selected by default on page load
- Add Account button in the page header (top right)
- Edit and Delete icon buttons on each card, visibility rules per UI_PLAN.md §5.2

**Right column — 60% width:**
- Sticky header showing: account name (heading), institution + owner (muted, below), total
  value (large, accent, top right), last rate update timestamp (muted, top right below value)
- Asset table below header:
  - Columns: Symbol Code | Symbol Name | Amount | Current Value | Last Rate | Rate Age
  - Rate Age: relative time since `fetched_at` (e.g. "3 min ago")
  - Monetary values right-aligned, `font-mono`
  - Add Asset button below table (Editor/Manager only)
  - Each asset row: Edit (amount) + Delete icon buttons (Editor/Manager, own accounts only)
- If no account is selected (empty state): centered empty state component with message
  "Select an account to view assets"

### 3.2 Mobile (< 768px) — Expandable Accordion

Single column list of account cards. Each card is an expandable accordion.

**Collapsed:** Account name | Institution | Owner | Asset count badge | Total value

**Expanded:** Asset table with columns: Symbol Code | Amount | Current Value | Rate Age.
Add Asset button at bottom of expanded section. Edit/Delete per role rules.

Mobile polish (spacing, truncation, alignment within cards) is deferred to a separate pass
and is not in scope for initial implementation.

---

## 4. Transactions (`/transactions`)

### 4.1 Desktop (≥ 768px) — Filter Panel Left, Table Right

**Left panel — 25% width:**
- Sticky, full page height, `bg-[--color-bg-card]`, `rounded-2xl`, `p-5`
- Panel title: "Filters" (heading)
- Fields (top to bottom):
  1. Date range picker (from / to date inputs)
  2. Transaction type multi-select (Deposit, Debit, Transfer, Interest, Trade)
  3. From account multi-select
  4. To account multi-select
  5. Symbol multi-select
  6. Volume range picker — min/max numeric inputs in household display currency, labelled
     "Min volume" / "Max volume". Volume = total transaction value (to_amount × rate or
     from_amount × rate, whichever is available)
- Clear All button at bottom of panel, full width, secondary style

**Right panel — 75% width:**
- Page header: "Transactions" title left, Add Transaction button right
- Transaction table:
  - Columns: Date | Type | From | To | Amount | Fee | Notes | Actions
  - Type column: color-coded pill badge — Deposit/Interest: positive tint, Debit: negative
    tint, Transfer: neutral tint, Trade: accent tint
  - From / To cells: `[Symbol Code] @ [Account Name]` or "—" if null
  - Amount cell:
    - Trade: `[from_amount] [from_symbol] → [to_amount] [to_symbol]`
    - All other types: single amount + symbol code
  - Fee cell: fee amount + symbol code, or "—" if none
  - Actions: Edit | Delete — Editor/Manager only
  - Default sort: date descending
  - Column header click toggles asc/desc sort

### 4.2 Mobile (< 768px) — Card List

- Page header: "Transactions" title left. Two always-visible sticky buttons top right:
  "Filter" and "Sort". These remain fixed even when scrolling. Filter opens a bottom drawer
  with the same fields as the desktop filter panel. Sort opens a bottom sheet with sort
  options (date, amount, type).
- Transactions rendered as cards, one per row.

**Single-symbol transaction card (Deposit, Debit, Transfer, Interest):**
```
[Transaction Name]  ([Type Badge])                    [Date]
[Symbol Full Name] ([Account Name] - [Symbol Code])   [Amount, color-coded]
```
Amount color: positive tint for Deposit/Interest, negative tint for Debit, neutral for Transfer.

**Trade transaction card:**
```
Trade  ([Type Badge])                                  [Date]
[To Symbol Full Name] ([Account] - [Symbol Code])      [G/L amount + % in household currency, color-coded]
[from_amount] [from_symbol] → [to_amount] [to_symbol]
```

**Expanded state (tap to expand, all types):**
- Fee: fee amount + symbol, or "None"
- Notes: note text, or "—"
- Actions: Edit | Delete buttons (Editor/Manager only)

---

## 5. Rates (`/rates`)

### 5.1 Desktop (≥ 768px) — Symbol List Left, Detail Right

**Page header:**
- Title "Rates" left
- "Convert" button right — opens a modal (see §5.3)
- "Manage Symbols" button right of Convert — navigates to `/rates/symbols` (Manager only;
  hidden for Editor and Viewer)

**Left panel — 35% width:**
- Scrollable list of symbol rows (not cards — table-style rows with `border-b` dividers)
- Columns: Symbol Code (bold) + Name (muted, below code) | Current Rate | 24h Change% | Last Updated
- 24h Change%: color-coded — positive green, negative red, zero neutral
- Clicking a row selects it and loads the detail panel. Selected row gets accent left border.
- First active symbol selected by default on page load
- Rows grouped by SymbolType with collapsible group headers (same as current UI_PLAN.md §5.4)

**Right panel — 65% width:**
- Top section:
  - Symbol code (display heading) + full name (muted)
  - Current rate large (`font-mono`, accent color)
  - Change indicators in a horizontal row: 24h | 1W | 1M | 1Y — each shows % change,
    color-coded. A button is only shown if historical data exists for that timespan.
- Historical rate chart (Recharts LineChart):
  - X-axis: time. Range buttons shown only for timespans where data exists.
  - `ResponsiveContainer` full panel width
  - Single line in `--color-chart-1`
- Assets section (below chart):
  - Heading: "Your assets in [Symbol Code]"
  - Table columns: Account | Amount | Current Value | G/L (amount + % in one column,
    color-coded, `font-mono`)
  - If no assets use this symbol: empty state "No assets using this symbol"
- If no symbol is selected: centered empty state "Select a symbol to view details"

### 5.2 Mobile (< 768px) — Expandable Card List

- Page header: "Rates" title left. "Convert" button right (same modal as desktop).
- Symbol list rendered as cards, one per symbol.

**Collapsed card:**
- Symbol code (bold) + name (muted) left
- Current rate right (`font-mono`)
- 24h Change% below rate, color-coded

**Expanded card (tap to expand):**
- Change indicators: 24h | 1W | 1M | 1Y — each shows % change, color-coded
- No chart on mobile
- No assets table on mobile

### 5.3 Convert Modal

Triggered by "Convert" button on both desktop and mobile.
- From symbol picker (searchable dropdown of active symbols)
- Amount input (`font-mono`)
- Swap button (↔) between pickers
- To symbol picker
- Result field (read-only, `font-mono`, accent color)
- Calculation is purely client-side using rates already loaded on the page — no API call
- Close button

---

## 6. Household (`/household`) and Settings (`/settings`)

No layout changes from UI_PLAN.md §5.5 and §5.6. Both pages use the full-width content area
(sidebar on desktop, bottom nav on mobile) instead of a narrow centered column.
Content within these pages retains its current structure.

---

## 7. Navigation Completeness

All private pages must render inside `AppShell` which provides:
- Desktop: fixed left sidebar with nav items and user avatar
- Mobile: fixed bottom navigation bar + sticky top header

No private page should render without the shell. This is enforced by
`src/app/(private)/layout.tsx` wrapping all private routes in `AppShell`.
