// src/lib/types/domain.ts
// Stable contract — do not modify without PM approval.

export type Role = 'manager' | 'editor' | 'viewer'

export type SymbolType =
  | 'fiat_currency'
  | 'stock'
  | 'tefas_fund'
  | 'physical_commodity'
  | 'cryptocurrency'
  | 'stablecoin'
  | 'custom'

export type TransactionType =
  | 'deposit'
  | 'debit'
  | 'transfer'
  | 'interest'
  | 'trade'

export type DisplayCurrency = 'TRY' | 'USD' | 'EUR'

export type PriceFetchStatus = 'success' | 'error' | 'skipped'

export type SnapshotTrigger = 'scheduled' | 'manual'

export type FeeSide = 'to' | 'from'

export type EntryMode = 'both_amounts' | 'to_amount_and_rate' | 'from_amount_and_rate'

// ─── Entities ────────────────────────────────────────────────────────────────

export interface Profile {
  id: string
  displayName: string
  email: string
  createdAt: string
  updatedAt: string
}

export interface Household {
  id: string
  name: string
  displayCurrency: DisplayCurrency
  createdAt: string
  updatedAt: string
}

export interface HouseholdMember {
  id: string
  householdId: string
  userId: string
  role: Role
  joinedAt: string
  // Joined fields (populated when queried with profile)
  profile?: Pick<Profile, 'id' | 'displayName' | 'email'>
}

export interface HouseholdInvite {
  id: string
  householdId: string
  code: string
  role: Exclude<Role, 'manager'>
  createdBy: string
  expiresAt: string | null
  maxUses: number | null
  useCount: number
  createdAt: string
}

export interface AssetSymbol {
  id: string
  householdId: string | null // null = global symbol
  code: string
  name: string | null
  description: string | null
  type: SymbolType
  primaryConversionFiat: string | null
  isActive: boolean
  fetchConfig: Record<string, unknown> | null
  createdAt: string
  updatedAt: string
}

export interface ExchangeRate {
  id: string
  symbolId: string
  householdId: string | null
  rate: number
  fetchedAt: string
  source: string | null
}

export interface PriceFetchLog {
  id: string
  householdId: string | null
  symbolId: string | null
  status: PriceFetchStatus
  message: string | null
  fetchedAt: string
}

export interface Account {
  id: string
  householdId: string
  ownerId: string
  name: string
  institution: string | null
  accountIdentifier: string | null
  defaultSymbolId: string | null
  createdAt: string
  updatedAt: string
  // Joined fields
  ownerProfile?: Pick<Profile, 'id' | 'displayName'>
  defaultSymbol?: Pick<AssetSymbol, 'id' | 'code' | 'name'>
}

export interface Asset {
  id: string
  householdId: string
  accountId: string
  symbolId: string
  amount: number
  createdAt: string
  updatedAt: string
  // Joined fields
  symbol?: AssetSymbol
  currentRate?: ExchangeRate
}

export interface Transaction {
  id: string
  householdId: string
  type: TransactionType
  date: string
  toAssetId: string | null
  fromAssetId: string | null
  feeSide: FeeSide | null      // replaces feeAssetId; fee asset derived from feeSide + to/from asset
  toAmount: number | null
  fromAmount: number | null
  feeAmount: number | null
  exchangeRate: number | null
  entryMode: EntryMode | null  // null treated as 'both_amounts'
  notes: string | null
  createdBy: string
  createdAt: string
  updatedAt: string
  // Joined fields (populated on list/detail queries)
  toAsset?: Asset & { symbol: AssetSymbol }
  fromAsset?: Asset & { symbol: AssetSymbol }
}

export interface Snapshot {
  id: string
  householdId: string
  takenAt: string
  netWorthTry: number | null
  netWorthUsd: number | null
  netWorthEur: number | null
  trigger: SnapshotTrigger
  createdAt: string
  updatedAt: string
}

export interface SnapshotAsset {
  id: string
  snapshotId: string
  householdId: string
  assetId: string
  symbolId: string
  amount: number
  exchangeRate: number
  valueInDisplayCurrency: number
  createdAt: string
  updatedAt: string
}

// ─── Computed / View types ────────────────────────────────────────────────────

/** Asset enriched with computed performance metrics */
export interface AssetWithPerformance extends Asset {
  symbol: AssetSymbol
  currentValueInDisplayCurrency: number
  costBasisInDisplayCurrency: number | null
  gainLoss: number | null
  gainLossPct: number | null
  cagr: number | null
}

/** Dashboard summary */
export interface PortfolioSummary {
  netWorth: number
  displayCurrency: DisplayCurrency
  change24h: number | null
  change7d: number | null
  change30d: number | null
  changeAllTime: number | null
  byType: Record<SymbolType, number>
  byCurrencyExposure: { try: number; usd: number; eur: number; other: number }
}

// ─── Server Action result wrapper ────────────────────────────────────────────

export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string }
