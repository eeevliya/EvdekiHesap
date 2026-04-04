# Product Requirements Document (PRD)

## EvdekiHesap — Multi-Currency Investment Performance Tracker

| Field | Value |
|---|---|
| **Version** | 2.2 |
| **Date** | 2026-04-04 |
| **Status** | Draft for Review |
| **Author** | Product Manager |
| **Stakeholder** | Project Owner |

---

## Executive Summary

### Problem Statement

Private investors managing portfolios across multiple currencies and asset types (Turkish mutual funds, stocks, cryptocurrencies, fiat) lack tools to accurately track **real investment performance** accounting for exchange rate fluctuations over time.

Existing solutions either:

- Focus on budgeting rather than investment tracking (Mint, YNAB)
- Ignore currency effects on returns (most broker platforms)
- Cost prohibitively for multi-currency support (Bloomberg Terminal)
- Don't support Turkish-specific investment products (Tefas funds, BIST stocks)

### Solution

A **mobile-first web application** that tracks household investment portfolios across multiple currencies, calculating real performance metrics (annualized returns, currency-adjusted gains/losses) with support for Turkish, European, and global investment products.

### Success Criteria (MVP)

1. User can track net worth in TRY, USD, or EUR with daily snapshots
2. User can see annualized returns per asset accounting for currency fluctuations
3. User can enter transactions via symbol-type-specific forms (Tefas, crypto, stocks)
4. App auto-fetches prices from free public APIs with reliable fallbacks
5. Users can create households to which the portfolio belongs
6. Users can invite other users to join their household via an invite link
   - The user that created the household is automatically a Manager
   - Other roles are Editor and Viewer
7. Android APK installable on mobile devices
8. Zero hosting costs (Vercel + Supabase free tiers)

---

## History & Goals

The app's main purpose is to replace a JavaScript-supplemented Google Sheets spreadsheet the product owner uses to track their finances. The sheet tracks unit prices for several assets via publicly available APIs and saves daily snapshots of historical asset values via scripts.

### Pain Points & Limitations

- Not easily viewable or editable on mobile phone
- The spreadsheet was initially built to track stock prices in Turkish Liras and was later expanded to other asset types. Stability and consistency weakened with each added feature. The owner also requires tracking in other currencies and other asset types after relocating to Europe.

---

## User Personas

Portfolios are managed in households. Users have roles in the household. Roles correspond with personas. Personas are not 1-to-1 with roles — a persona may cover more than one role, and a role can be involved with multiple personas. Each household has a portfolio.

The planned users of the app are non-financial-background private investors with investments in assets such as Turkish mutual funds (Tefas), BIST stocks, cryptocurrencies, physical gold, and fiat savings.

### Roles

#### Manager

The primary manager of the household. Can edit members, edit household preferences, delete the household, manage symbols, and edit history.

#### Editor

Can view the state and history of the household portfolio. Can create, read, update, and delete accounts and transactions.

#### Viewer

Can view the dashboard and history but cannot make any edits.

### Personas

#### Portfolio Manager

- **Roles**: Manager, Editor
- **Definition**: A user that uses the app to manage transactions and track their investments.

#### Household Manager

- **Roles**: Manager
- **Definition**: The primary manager of the household. Handles administrative duties that fall outside the definition of Portfolio Manager.

#### Household Member

- **Roles**: Viewer, Editor, Manager
- **Definition**: A user that is a member of the household and observes the investments' state and performance.

#### System Admin

- **Roles**: Not connected to households or household roles
- **Definition**: The overarching system administrator with access to the admin panel.

---

## Core User Stories

### Household Management

**As a Household Manager, I want to manage the members and preferences of my household.**

1. Create a new household with initial preferences
2. Invite other people to my household with an invite link or code
3. Manage user roles in my household
4. Remove users that are not Managers from the household
5. Manage the preferences of the household
6. Edit the symbols used by the household
7. Edit account ownership

### Portfolio Visibility

**As a Household Member, I want to see my total net worth and recent performance so I can make informed financial decisions.**

1. View a dashboard showing net worth in the household's preferred currency (TRY/USD/EUR) with 24h/7d/30d/all-time change
2. See a net worth chart over time (day/week/month/year views)
3. View asset breakdown by type (Tefas funds, crypto, stocks, fiat) and currency exposure (TRY-indexed, USD-indexed, EUR-indexed)
4. See individual asset performance with annualized returns (CAGR) and currency-adjusted Gain/Loss
5. View accounts, assets, and transaction history of the household with filters (date range, type, account, symbol)

### Transaction, Account & Asset Management

**As a Portfolio Manager, I want to record financial transactions easily so my portfolio data stays current.**

1. Create, read, update, and delete Accounts with metadata (institution, type, owner). Accounts can be bank accounts, cryptocurrency wallets, apps, physical storage, etc.
   - The created account's owner is automatically the creating user. This can only be changed by a Manager.
   - Editors can only edit or remove accounts that belong to themselves.
2. Create, read, update, and delete Assets within user-owned accounts.
   - Each asset belongs to an account.
   - Each asset has a specific symbol.
3. Create, read, update, and delete Transactions within user-owned accounts.
   - More details about transactions are provided in the Glossary.

### Automated Price Updates

**As a Portfolio Manager, I want prices to update automatically so I don't have to manually track exchange rates.**

1. The system auto-fetches prices for Tefas funds, crypto, stocks, and fiat on a scheduled basis during market hours.
   - Different symbol types have different fetching logic. The specific APIs and routines for each type will be decided collaboratively at the start of the relevant implementation session — Claude Code should surface options and ask before implementing.
2. The system stores portfolio snapshots every 6 hours for historical charting.
3. A manual "Refresh Now" button fetches the latest prices and overwrites the most recent snapshot rather than appending a new row.
4. The user can view price fetch status (last updated, errors, data sources).

---

## Non-Functional Requirements

### Performance

- Dashboard loads in under 2 seconds on 4G mobile
- Price fetches complete in under 500ms (cached) or under 3 seconds (API call)
- Portfolio snapshots process in under 10 seconds per household
- Supports up to 100 assets per household without performance degradation

### Scalability

- The database schema supports multiple households. The initial use case is a single household, but the architecture must support future expansion.
- The symbol table supports global symbols and household-custom symbols.

### Security

- All tables include a `household_id` reference. Row-Level Security (RLS) enforces that users can only access data belonging to households they are members of.
- Role-based permissions (what Editors vs Viewers can and cannot do) are enforced in server-side logic.
- RLS is the safety net against cross-household data leaks.
- Every private page must verify authentication server-side.

### Reliability

- Price fetch failures fall back to the last known value
- Transaction errors roll back atomically
- Snapshot job failures are logged and retried on the next scheduled run
- 99% uptime target (aligned with hosting platform SLAs)

### Usability

- Mobile-first responsive design (works on 375px and wider screens)
- Touch-friendly tap targets (minimum 44px)
- Accessible (WCAG AA compliance for color contrast and keyboard navigation)
- Loading states for all async operations
- Actionable error messages (e.g., "Price fetch failed. Using price from 2 hours ago.")

### Maintainability

- TypeScript strict mode to catch errors at compile time
- Database migrations versioned and reversible
- Code commented for future developers

---

## Out of Scope (Phase 2+)

The following are explicitly excluded from the MVP:

- Bank account integration (e.g., Plaid, Tink APIs)
- Automated transaction imports (CSV uploads, bank statement parsing)
- Recurring transaction templates (monthly salary, rent)
- Transaction categories or tags beyond type
- Budget tracking and alerts
- Tax calculation and reporting
- Bill reminders and notifications
- Social features (sharing portfolios, leaderboards)
- iOS support (Android only for MVP)
- Multi-language support (English only for MVP)
- Advanced performance algorithms (Sharpe ratio, alpha/beta)
- Currency rebalancing recommendations
- Forecasting and projections
- Custom symbol script execution (see Future Features)

---

## Success Metrics

### MVP Launch Criteria (All Must Be Met)

1. Provides all features previously satisfied by the Google Sheets implementation for one household
2. Portfolio snapshots running automatically every 6 hours
3. Price fetches succeeding over 95% of the time with fallbacks
4. Dashboard loads in under 2 seconds on 4G mobile
5. Android APK installs and runs on 2 physical devices
6. Zero hosting costs (within Vercel and Supabase free tiers)
7. All transaction types working (Deposit, Debit, Transfer, Interest, Trade)
8. Historical data preserved — user can view net worth from at least 1 month ago

---

## Development Philosophy

### Vibe Coding Principles

This project follows vibe coding practices. The goal is to move fast with modern tooling, minimal over-engineering, and maximum leverage of existing libraries.

- Minimal custom code — prefer existing libraries and platform features
- Mobile-first (375px minimum width, 44px tap targets)
- Security-first: RLS on every table, server-side auth verification for all private pages
- Clean, readable, simple code — no premature optimization

### Vertical Slicing

The project is delivered in vertical slices. Each slice is a complete, independently deliverable unit of functionality that can be tested by the PM without requiring subsequent slices.

- Each slice is sized to be completable in a single Claude Code session on a Pro subscription. This includes implementation, testing, and bug fixing.
- For slices that are inherently larger, multiple sessions may be planned and documented explicitly.
- The only interaction between slices is through a **predetermined contract** (shared types, API interfaces, and database schema agreements) defined at the technical planning stage.
- The contract between slices is defined once, at the technical planning stage, before any implementation begins.

### Session Structure

- Each session has clearly defined deliverable goals stated at the outset.
- The result of each session must be a PM-testable output.
- At the end of each session, the agent must provide clear instructions on how the PM can test and verify the deliverable.
- The agent must not begin implementation of a new slice until the PM has confirmed the previous slice is working.

### Technical Planning

- The technical plan is generated by Claude Code based on this PRD and the accompanying `claude.md`.
- The plan must be produced as a separate artifact and reviewed and approved by the PM before any implementation begins.
- The plan must define the slice contract (shared types, API shapes, DB schema) upfront.
- For any feature requiring external API integration (e.g., price fetching per symbol type), the agent must surface available options and discuss them with the PM before implementing — the specific APIs are not predetermined in this PRD.

---

## Future Features

The following are not planned for the MVP but should be considered in architectural decisions so they do not require major rework to add later.

- **Custom symbol scripts**: Managers will be able to provide a JavaScript script to fetch exchange rates for custom symbol types. This will be sandboxed and restricted to only affect exchange rates for symbols belonging to the household. The infrastructure for pluggable fetching logic per symbol type should be present in the MVP even though the custom script execution capability is not.
- **Snapshot editing**: Household Managers will be able to edit historical snapshots. Snapshots should be treated as mutable records in the schema even though the MVP UI exposes them as read-only.
- **Migration to React Native**: The architecture should not preclude a future migration of the frontend to React Native.

---

## Appendices

### Glossary

The entities below are **functional and domain-level descriptions**. They are not database table definitions. Field names are not column names. Some fields are derived computations, some are foreign key references, and some may not exist as stored columns at all. The technical plan is responsible for translating these functional entities into the appropriate technical representations.

---

#### Symbol

A tradable entity (currency, stock, fund, commodity, crypto). A symbol represents a type of asset. It can be a global symbol (available to all households) or a household-custom symbol visible and usable only within that household.

Global symbols (e.g., TRY, EUR, USD, XAU) cannot be created or modified by households.

**Fields:**

- **Symbol**: Identifier, e.g., TRY, EUR, XAU, TI1, or Turkish gold variants (gram gold, quarter/half/full gold)
- **Household**: The symbol's owning household. Null for global symbols.
- **Name**: Optional display name
- **Description**: Optional
- **Primary Conversion Fiat**: The fiat currency against which this symbol is primarily evaluated. Null for fiat currencies themselves. Examples: USD for XAU, TRY for Tefas funds.
- **Current Exchange Rate**: The current rate against the household's selected display currency. This is a time-varying, household-context-dependent value — not a static field on the symbol itself. The technical plan must address how this is stored and resolved.
- **Type**: One of: Fiat Currency, Stock (any market), Tefas Fund, Physical Commodity, Cryptocurrency, Custom

---

#### Account

A container for assets, such as a bank account, brokerage, cryptocurrency wallet, or physical storage.

**Fields:**

- **Household**: The household this account belongs to
- **Owner**: A Portfolio Manager within the household
- **Institution**: Optional free-text field
- **Account ID**: Optional identifier (IBAN, wallet address, etc.)
- **Name**: Free text, unique within the household
- **Default Symbol**: Optional. The default symbol for this account. Some accounts support multiple symbols (e.g., crypto wallets), so this field is not mandatory.

---

#### Asset

A holding of a specific symbol within an account (e.g., "10 shares of THYAO in Brokerage Account A").

**Fields:**

- **Account**: The account in which the asset resides
- **Symbol**: The symbol being held
- **Amount**: The quantity held
- **Current Value**: The current value of the asset in the household's preferred display currency (derived field: Amount × current exchange rate)

---

#### Transaction

A movement affecting the value of one or more assets. Transactions are the primary daily data entry operation.

**Fields:**

- **Date & Time**: Defaults to the current time
- **ID**: A randomly generated hash uniquely identifying the transaction across the entire database
- **To Asset**: The asset receiving the movement. Required for some transaction types, null for others.
- **From Asset**: The asset originating the movement. Required for some transaction types, null for others.
- **Fee Asset**: Optional. The asset from which the transaction fee is deducted. Required if fee amount is non-zero.
- **Fee Amount**: The amount of the fee paid, in the Fee Asset's symbol.
- **To Amount**: The increase in the To Asset's quantity.
- **From Amount**: The decrease in the From Asset's quantity.
- **Exchange Rate**: The rate used for this transaction — either calculated or user-provided depending on the entry mode.
- **Type**: One of the following:
  - **Deposit**: Increase in an asset from an external source. From fields are null.
  - **Debit**: Decrease in an asset to an external destination (e.g., cash withdrawal). To fields are null.
  - **Transfer**: Movement between two assets sharing the same symbol. To and From symbols must match.
  - **Interest**: External financial income. From fields are null.
  - **Trade**: Exchange of one symbol for another. All fields except fees are mandatory.
- **Cost Basis**: The cost of the transaction expressed in the household's preferred currency at the time of the transaction. Null for transactions with no From fields. Derived: From Amount × Exchange Rate at transaction date.
- **Current Value**: The current value of the transacted amount in the household's preferred currency. Derived: To Amount × Current Exchange Rate.
- **Gain/Loss**: The difference between Current Value and Cost Basis. Derived field.
- **CAGR (Compound Annual Growth Rate)**: Not a stored field. A calculation available on demand. Returns the equivalent annualized return for a specified time period. Implementation note: compute the equivalent daily rate first, then compound by 365 / 30 / 7 to produce the requested interval.

---

#### Snapshot

An automatically recorded point-in-time record of a household's portfolio state. Users may also manually trigger a snapshot.

A snapshot captures, at minimum:

- The balance of every asset in the household at the time of the snapshot
- The exchange rate of every relevant symbol at the time of the snapshot
- The computed net worth in the household's preferred currency

This allows retroactive queries such as "what was my net worth in EUR two months ago" to be answered from snapshot data alone without re-processing transactions.

Snapshots are presented as read-only in the MVP. However, the schema must treat them as mutable records in anticipation of a future feature allowing Managers to edit historical snapshots.