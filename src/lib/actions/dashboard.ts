'use server'

import { createServerClient } from '@/lib/supabase/server'
import type { DisplayCurrency, SymbolType } from '@/lib/types/domain'
import { netWorthForCurrency, pctChange, cagr, daysBetween, gainLoss } from '@/lib/utils/calculations'

// ─── Output types ─────────────────────────────────────────────────────────────

export interface NetWorthSummary {
  current: number
  displayCurrency: DisplayCurrency
  /** All-time gain/loss amount */
  changeAllTime: number | null
  /** All-time gain/loss % */
  changeAllTimePct: number | null
  change24h: number | null
  change24hPct: number | null
  change7d: number | null
  change7dPct: number | null
  change30d: number | null
  change30dPct: number | null
  snapshotTakenAt: string | null
}

export interface AssetBreakdownSegment {
  symbolCode: string
  symbolName: string | null
  symbolType: SymbolType
  value: number
  pct: number
}

export interface ChartPoint {
  date: string
  /** Net worth in display currency at that point */
  netWorth: number
  /** Per-symbol breakdown: symbolCode → value */
  bySymbol: Record<string, number>
}

export interface AssetPerformanceRow {
  assetId: string
  accountId: string
  accountName: string
  symbolId: string
  symbolCode: string
  symbolName: string | null
  symbolType: SymbolType
  amount: number
  currentValue: number
  costBasis: number | null
  gainLossAmount: number | null
  gainLossPct: number | null
  cagrValue: number | null
  firstTransactionDate: string | null
}

export interface DashboardData {
  householdId: string
  netWorth: NetWorthSummary
  assetBreakdown: AssetBreakdownSegment[]
  /** Full chart data (1Y range) — client filters down for 1D/1W/1M */
  chartData: ChartPoint[]
  /** All unique symbol codes present in chart data — for legend/coloring */
  chartSymbols: string[]
  performance: AssetPerformanceRow[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pickNetWorth(
  row: { net_worth_try: number | null; net_worth_usd: number | null; net_worth_eur: number | null },
  currency: DisplayCurrency
): number | null {
  if (currency === 'USD') return row.net_worth_usd
  if (currency === 'EUR') return row.net_worth_eur
  return row.net_worth_try
}

function pickAssetValue(
  row: { value_try: number | null; value_usd: number | null; value_eur: number | null },
  currency: DisplayCurrency
): number | null {
  if (currency === 'USD') return row.value_usd
  if (currency === 'EUR') return row.value_eur
  return row.value_try
}

// ─── Main loader ──────────────────────────────────────────────────────────────

/**
 * Load all data needed to render the dashboard.
 * Called from the dashboard Server Component — not a Server Action form target.
 */
export async function getDashboardData(): Promise<DashboardData | null> {
  const supabase = await createServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  // ── Household + display currency ──────────────────────────────────────────
  const { data: membership } = await supabase
    .from('household_members')
    .select('household_id, households(id, display_currency)')
    .eq('user_id', user.id)
    .order('joined_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (!membership) return null

  const householdId = membership.household_id
  const household = membership.households as unknown as { id: string; display_currency: string } | null
  const displayCurrency = (household?.display_currency ?? 'TRY') as DisplayCurrency

  // ── Snapshots (last 365 days) ────────────────────────────────────────────
  const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString()

  const { data: snapshots } = await supabase
    .from('snapshots')
    .select('id, taken_at, net_worth_try, net_worth_usd, net_worth_eur')
    .eq('household_id', householdId)
    .gte('taken_at', oneYearAgo)
    .order('taken_at', { ascending: true })

  const snapshotRows = (snapshots ?? []) as {
    id: string
    taken_at: string
    net_worth_try: number | null
    net_worth_usd: number | null
    net_worth_eur: number | null
  }[]

  // Also get the oldest snapshot ever for all-time cost basis
  const { data: oldestSnapshot } = await supabase
    .from('snapshots')
    .select('taken_at, net_worth_try, net_worth_usd, net_worth_eur')
    .eq('household_id', householdId)
    .order('taken_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  // ── Latest snapshot — current net worth ──────────────────────────────────
  const latestSnapshot = snapshotRows.length > 0
    ? snapshotRows[snapshotRows.length - 1]
    : null

  const currentNetWorth = latestSnapshot ? (pickNetWorth(latestSnapshot, displayCurrency) ?? 0) : 0
  const takenAt = latestSnapshot?.taken_at ?? null

  // ── Time-based comparisons ───────────────────────────────────────────────
  const now = Date.now()

  function findSnapshotNearTime(targetMs: number) {
    if (snapshotRows.length === 0) return null
    let closest = snapshotRows[0]
    let minDiff = Math.abs(new Date(closest.taken_at).getTime() - targetMs)
    for (const s of snapshotRows) {
      const diff = Math.abs(new Date(s.taken_at).getTime() - targetMs)
      if (diff < minDiff) { minDiff = diff; closest = s }
    }
    return closest
  }

  const snap24h = findSnapshotNearTime(now - 24 * 60 * 60 * 1000)
  const snap7d  = findSnapshotNearTime(now - 7  * 24 * 60 * 60 * 1000)
  const snap30d = findSnapshotNearTime(now - 30 * 24 * 60 * 60 * 1000)

  const val24h = snap24h ? (pickNetWorth(snap24h, displayCurrency) ?? null) : null
  const val7d  = snap7d  ? (pickNetWorth(snap7d,  displayCurrency) ?? null) : null
  const val30d = snap30d ? (pickNetWorth(snap30d, displayCurrency) ?? null) : null
  const valOldest = oldestSnapshot ? (pickNetWorth(oldestSnapshot, displayCurrency) ?? null) : null

  const change24h    = val24h    != null ? currentNetWorth - val24h    : null
  const change7d     = val7d     != null ? currentNetWorth - val7d     : null
  const change30d    = val30d    != null ? currentNetWorth - val30d    : null
  const changeAllTime = valOldest != null ? currentNetWorth - valOldest : null

  const netWorth: NetWorthSummary = {
    current: currentNetWorth,
    displayCurrency,
    changeAllTime,
    changeAllTimePct:  pctChange(valOldest, currentNetWorth),
    change24h,
    change24hPct:  pctChange(val24h,    currentNetWorth),
    change7d,
    change7dPct:   pctChange(val7d,     currentNetWorth),
    change30d,
    change30dPct:  pctChange(val30d,    currentNetWorth),
    snapshotTakenAt: takenAt,
  }

  // ── Asset breakdown from latest snapshot ─────────────────────────────────
  let assetBreakdown: AssetBreakdownSegment[] = []

  if (latestSnapshot) {
    const { data: snapshotAssets } = await supabase
      .from('snapshot_assets')
      .select(`
        symbol_id,
        amount,
        value_try,
        value_usd,
        value_eur,
        symbol:symbols (code, name, type)
      `)
      .eq('snapshot_id', latestSnapshot.id)

    type SnapAssetRaw = {
      symbol_id: string
      amount: number
      value_try: number | null
      value_usd: number | null
      value_eur: number | null
      symbol: { code: string; name: string | null; type: string } | null
    }

    const snapAssets = (snapshotAssets ?? []) as unknown as SnapAssetRaw[]
    const totalValue = currentNetWorth || 1

    // Aggregate by symbol
    const bySymbol = new Map<string, { code: string; name: string | null; type: string; value: number }>()
    for (const sa of snapAssets) {
      const val = pickAssetValue(sa, displayCurrency) ?? 0
      const code = sa.symbol?.code ?? sa.symbol_id
      if (bySymbol.has(code)) {
        bySymbol.get(code)!.value += val
      } else {
        bySymbol.set(code, {
          code,
          name: sa.symbol?.name ?? null,
          type: sa.symbol?.type ?? 'custom',
          value: val,
        })
      }
    }

    assetBreakdown = Array.from(bySymbol.values())
      .sort((a, b) => b.value - a.value)
      .map((item) => ({
        symbolCode: item.code,
        symbolName: item.name,
        symbolType: item.type as SymbolType,
        value: item.value,
        pct: (item.value / totalValue) * 100,
      }))
  }

  // ── Chart data ───────────────────────────────────────────────────────────
  // Build chart points from snapshots.
  // For each snapshot: get net worth + per-symbol values.
  // To keep it feasible, we use snapshot_assets for the latest and
  // the net worth figures (pre-computed) for historical snapshots.
  // The chart shows net worth over time (stacked bar = by symbol from latest breakdown).

  const chartSymbolSet = new Set<string>(assetBreakdown.map((s) => s.symbolCode))

  const chartData: ChartPoint[] = snapshotRows.map((s) => ({
    date: s.taken_at.slice(0, 10), // YYYY-MM-DD
    netWorth: pickNetWorth(s, displayCurrency) ?? 0,
    bySymbol: {},
  }))

  // For the stacked bar chart, we load per-symbol values for all snapshots.
  // This is expensive for 365 days but necessary for the visual.
  // We'll load it for the snapshots in the range, limited to 90 data points.
  const sampledSnapshots = downsample(snapshotRows, 90)

  if (sampledSnapshots.length > 0) {
    const sampledIds = sampledSnapshots.map((s) => s.id)
    const { data: allSnapshotAssets } = await supabase
      .from('snapshot_assets')
      .select('snapshot_id, value_try, value_usd, value_eur, symbol:symbols(code)')
      .in('snapshot_id', sampledIds)

    type SnapAssetMin = {
      snapshot_id: string
      value_try: number | null
      value_usd: number | null
      value_eur: number | null
      symbol: { code: string } | null
    }

    const snapshotAssetMap = new Map<string, Map<string, number>>()
    for (const sa of ((allSnapshotAssets ?? []) as unknown as SnapAssetMin[])) {
      if (!snapshotAssetMap.has(sa.snapshot_id)) {
        snapshotAssetMap.set(sa.snapshot_id, new Map())
      }
      const code = sa.symbol?.code ?? 'Unknown'
      const val = pickAssetValue(sa, displayCurrency) ?? 0
      const existing = snapshotAssetMap.get(sa.snapshot_id)!.get(code) ?? 0
      snapshotAssetMap.get(sa.snapshot_id)!.set(code, existing + val)
    }

    // Rebuild chart data using sampled snapshots
    const chartPoints: ChartPoint[] = sampledSnapshots.map((s) => {
      const bySymbol: Record<string, number> = {}
      const symbolMap = snapshotAssetMap.get(s.id)
      if (symbolMap) {
        for (const [code, val] of symbolMap) {
          bySymbol[code] = val
          chartSymbolSet.add(code)
        }
      }
      return {
        date: s.taken_at.slice(0, 10),
        netWorth: pickNetWorth(s, displayCurrency) ?? 0,
        bySymbol,
      }
    })

    // Replace chartData with the richer sampled version
    chartData.length = 0
    chartData.push(...chartPoints)
  }

  // ── Asset performance table ───────────────────────────────────────────────
  // Load current assets with exchange rates and compute performance metrics.
  const { data: assets } = await supabase
    .from('assets')
    .select(`
      id,
      amount,
      account_id,
      symbol_id,
      account:accounts(id, name),
      symbol:symbols(id, code, name, type, primary_conversion_fiat)
    `)
    .eq('household_id', householdId)
    .gt('amount', 0)

  type AssetRaw = {
    id: string
    amount: number
    account_id: string
    symbol_id: string
    account: { id: string; name: string } | null
    symbol: {
      id: string
      code: string
      name: string | null
      type: string
      primary_conversion_fiat: string | null
    } | null
  }

  const assetRows = (assets ?? []) as unknown as AssetRaw[]

  // Fetch latest exchange rates for all symbols
  const symbolIds = [...new Set(assetRows.map((a) => a.symbol_id))]

  let rateMap = new Map<string, number>()
  let usdRate: number | null = null
  let eurRate: number | null = null

  if (symbolIds.length > 0) {
    const { data: rates } = await supabase
      .from('exchange_rates')
      .select('symbol_id, rate, fetched_at')
      .in('symbol_id', symbolIds)
      .order('fetched_at', { ascending: false })

    // Deduplicate — keep latest per symbol
    const seen = new Set<string>()
    for (const r of (rates ?? []) as { symbol_id: string; rate: number }[]) {
      if (!seen.has(r.symbol_id)) {
        rateMap.set(r.symbol_id, Number(r.rate))
        seen.add(r.symbol_id)
      }
    }

    // Get USD/EUR rates for cross-currency conversion
    const { data: fxSymbols } = await supabase
      .from('symbols')
      .select('id, code')
      .in('code', ['USD', 'EUR'])
      .is('household_id', null)

    const usdSymbolId = (fxSymbols ?? []).find((s) => s.code === 'USD')?.id ?? null
    const eurSymbolId = (fxSymbols ?? []).find((s) => s.code === 'EUR')?.id ?? null

    const allSymbolIds = [
      ...symbolIds,
      ...[usdSymbolId, eurSymbolId].filter(Boolean) as string[],
    ]

    const { data: fxRates } = await supabase
      .from('exchange_rates')
      .select('symbol_id, rate, fetched_at')
      .in('symbol_id', allSymbolIds)
      .order('fetched_at', { ascending: false })

    const fxSeen = new Set<string>()
    for (const r of (fxRates ?? []) as { symbol_id: string; rate: number }[]) {
      if (!fxSeen.has(r.symbol_id)) {
        if (r.symbol_id === usdSymbolId) usdRate = Number(r.rate)
        if (r.symbol_id === eurSymbolId) eurRate = Number(r.rate)
        if (!rateMap.has(r.symbol_id)) rateMap.set(r.symbol_id, Number(r.rate))
        fxSeen.add(r.symbol_id)
      }
    }
  }

  // Load earliest transaction date per asset for CAGR computation
  const assetIds = assetRows.map((a) => a.id)
  const firstTransactionMap = new Map<string, string>()

  if (assetIds.length > 0) {
    const { data: firstTxns } = await supabase
      .from('transactions')
      .select('to_asset_id, date')
      .eq('household_id', householdId)
      .in('to_asset_id', assetIds)
      .order('date', { ascending: true })

    for (const t of (firstTxns ?? []) as { to_asset_id: string | null; date: string }[]) {
      if (t.to_asset_id && !firstTransactionMap.has(t.to_asset_id)) {
        firstTransactionMap.set(t.to_asset_id, t.date)
      }
    }
  }

  // Compute cost basis from deposit/interest transactions per asset
  const costBasisMap = new Map<string, number>()
  if (assetIds.length > 0) {
    const { data: depTxns } = await supabase
      .from('transactions')
      .select('to_asset_id, to_amount, exchange_rate, type')
      .eq('household_id', householdId)
      .in('type', ['deposit', 'interest', 'trade'])
      .in('to_asset_id', assetIds)

    for (const t of (depTxns ?? []) as {
      to_asset_id: string | null
      to_amount: number | null
      exchange_rate: number | null
      type: string
    }[]) {
      if (!t.to_asset_id || t.to_amount == null) continue
      // For interest, cost basis contribution = 0 (free money)
      if (t.type === 'interest') continue
      // For deposit/trade: cost_basis_in_try ≈ to_amount × exchange_rate
      const rate = t.exchange_rate ?? 0
      const contribution = Number(t.to_amount) * Number(rate)
      costBasisMap.set(t.to_asset_id, (costBasisMap.get(t.to_asset_id) ?? 0) + contribution)
    }
  }

  // Convert cost basis to display currency
  function costBasisToDisplay(costBasisTry: number | null): number | null {
    if (costBasisTry == null) return null
    if (displayCurrency === 'USD') return usdRate ? costBasisTry / usdRate : null
    if (displayCurrency === 'EUR') return eurRate ? costBasisTry / eurRate : null
    return costBasisTry
  }

  // Build performance rows
  const performance: AssetPerformanceRow[] = []

  for (const asset of assetRows) {
    const sym = asset.symbol
    if (!sym) continue

    const rate = rateMap.get(asset.symbol_id)
    if (rate == null) continue

    const amount = Number(asset.amount)
    let valueTry: number

    const pcf = sym.primary_conversion_fiat
    if (pcf === 'USD') {
      if (!usdRate) continue
      valueTry = amount * rate * usdRate
    } else if (pcf === 'EUR') {
      if (!eurRate) continue
      valueTry = amount * rate * eurRate
    } else {
      valueTry = amount * rate
    }

    let currentValue: number
    if (displayCurrency === 'USD') currentValue = usdRate ? valueTry / usdRate : 0
    else if (displayCurrency === 'EUR') currentValue = eurRate ? valueTry / eurRate : 0
    else currentValue = valueTry

    const costBasisTry = costBasisMap.has(asset.id) ? costBasisMap.get(asset.id)! : null
    const costBasis = costBasisToDisplay(costBasisTry)

    const gl = gainLoss(currentValue, costBasis)
    const firstDate = firstTransactionMap.get(asset.id) ?? null
    const days = firstDate ? daysBetween(firstDate, new Date().toISOString()) : null
    const cagrValue = costBasis != null && days != null
      ? cagr(currentValue, costBasis, days)
      : null

    performance.push({
      assetId: asset.id,
      accountId: asset.account?.id ?? asset.account_id,
      accountName: asset.account?.name ?? 'Unknown account',
      symbolId: asset.symbol_id,
      symbolCode: sym.code,
      symbolName: sym.name,
      symbolType: sym.type as SymbolType,
      amount,
      currentValue,
      costBasis,
      gainLossAmount: gl?.amount ?? null,
      gainLossPct: gl?.pct ?? null,
      cagrValue,
      firstTransactionDate: firstDate,
    })
  }

  // Sort by current value descending
  performance.sort((a, b) => b.currentValue - a.currentValue)

  return {
    householdId,
    netWorth,
    assetBreakdown,
    chartData,
    chartSymbols: [...chartSymbolSet],
    performance,
  }
}

// ─── Utility ──────────────────────────────────────────────────────────────────

/** Evenly sample at most `max` items from an array, always keeping first and last. */
function downsample<T>(arr: T[], max: number): T[] {
  if (arr.length <= max) return arr
  const result: T[] = [arr[0]]
  const step = (arr.length - 1) / (max - 1)
  for (let i = 1; i < max - 1; i++) {
    result.push(arr[Math.round(i * step)])
  }
  result.push(arr[arr.length - 1])
  return result
}
