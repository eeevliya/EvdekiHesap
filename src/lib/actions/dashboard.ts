'use server'

import { createServerClient, createServiceRoleClient } from '@/lib/supabase/server'
import type { DisplayCurrency, SymbolType } from '@/lib/types/domain'
import { pctChange, cagr, daysBetween } from '@/lib/utils/calculations'

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
  /** Most recent fetched_at across all exchange rates used */
  ratesUpdatedAt: string | null
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
  /** Total gain/loss in display currency at that point (null when no G/L data exists) */
  gainLoss: number | null
  /** Per-symbol gain/loss: symbolCode → gain/loss amount (0 when null in DB) */
  gainLossBySymbol: Record<string, number>
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

export interface PeekAccountRow {
  id: string
  name: string
  institution: string | null
  ownerName: string
  totalValue: number
}

export interface PeekTransactionRow {
  id: string
  type: string
  date: string
  fromSymbolCode: string | null
  fromSymbolName: string | null
  fromAmount: number | null
  fromAccountName: string | null
  toSymbolCode: string | null
  toSymbolName: string | null
  toAmount: number | null
  toAccountName: string | null
  feeAmount: number | null
  feeSymbolCode: string | null
  feeSide: string | null
  exchangeRate: number | null
  notes: string | null
}

export interface PeekRateRow {
  symbolId: string
  symbolCode: string
  symbolName: string | null
  symbolType: SymbolType
  currentRate: number
  change24hPct: number | null
  change24hAbs: number | null
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
  peekAccounts: PeekAccountRow[]
  peekTransactions: PeekTransactionRow[]
  peekRates: PeekRateRow[]
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
 *
 * Net worth, asset breakdown, and performance table are sourced from live
 * asset amounts × latest exchange rates. The performance chart is the only
 * component that reads from snapshot history.
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

  // ── Snapshots (last 365 days + oldest ever) — for chart and time comparisons only ──
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

  const { data: oldestSnapshot } = await supabase
    .from('snapshots')
    .select('taken_at, net_worth_try, net_worth_usd, net_worth_eur')
    .eq('household_id', householdId)
    .order('taken_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  // ── Live assets ───────────────────────────────────────────────────────────
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

  // ── Live exchange rates ───────────────────────────────────────────────────
  const symbolIds = [...new Set(assetRows.map((a) => a.symbol_id))]

  const rateMap = new Map<string, number>()
  let usdRate: number | null = null
  let eurRate: number | null = null
  let ratesUpdatedAt: string | null = null

  if (symbolIds.length > 0) {
    // Get USD/EUR symbol IDs
    const { data: fxSymbols } = await supabase
      .from('symbols')
      .select('id, code')
      .in('code', ['USD', 'EUR'])
      .is('household_id', null)

    const usdSymbolId = (fxSymbols ?? []).find((s) => s.code === 'USD')?.id ?? null
    const eurSymbolId = (fxSymbols ?? []).find((s) => s.code === 'EUR')?.id ?? null

    const allSymbolIds = [
      ...new Set([
        ...symbolIds,
        ...[usdSymbolId, eurSymbolId].filter(Boolean) as string[],
      ]),
    ]

    const { data: rates } = await supabase
      .from('exchange_rates')
      .select('symbol_id, rate, fetched_at')
      .in('symbol_id', allSymbolIds)
      .order('fetched_at', { ascending: false })

    const seen = new Set<string>()
    for (const r of (rates ?? []) as { symbol_id: string; rate: number; fetched_at: string }[]) {
      if (!seen.has(r.symbol_id)) {
        rateMap.set(r.symbol_id, Number(r.rate))
        if (r.symbol_id === usdSymbolId) usdRate = Number(r.rate)
        if (r.symbol_id === eurSymbolId) eurRate = Number(r.rate)
        // Track the most recent fetched_at across all rates used
        if (!ratesUpdatedAt || r.fetched_at > ratesUpdatedAt) {
          ratesUpdatedAt = r.fetched_at
        }
        seen.add(r.symbol_id)
      }
    }
  }

  // ── First transaction date per asset + latest snapshot G/L ───────────────
  const assetIds = assetRows.map((a) => a.id)
  const firstTransactionMap = new Map<string, string>()
  const glMap = new Map<string, number>()

  const latestSnapshotId = snapshotRows.at(-1)?.id ?? null

  const [firstTxnsResult, glResult] = await Promise.all([
    assetIds.length > 0
      ? supabase
          .from('transactions')
          .select('to_asset_id, date')
          .eq('household_id', householdId)
          .in('to_asset_id', assetIds)
          .order('date', { ascending: true })
      : Promise.resolve({ data: [] as { to_asset_id: string | null; date: string }[], error: null }),
    latestSnapshotId
      ? supabase
          .from('snapshot_assets')
          .select('asset_id, gain_loss_try, gain_loss_usd, gain_loss_eur')
          .eq('snapshot_id', latestSnapshotId)
      : Promise.resolve({ data: [] as { asset_id: string; gain_loss_try: number | null; gain_loss_usd: number | null; gain_loss_eur: number | null }[], error: null }),
  ])

  for (const t of (firstTxnsResult.data ?? []) as { to_asset_id: string | null; date: string }[]) {
    if (t.to_asset_id && !firstTransactionMap.has(t.to_asset_id)) {
      firstTransactionMap.set(t.to_asset_id, t.date)
    }
  }

  type GlRow = { asset_id: string; gain_loss_try: number | null; gain_loss_usd: number | null; gain_loss_eur: number | null }
  for (const row of (glResult.data ?? []) as GlRow[]) {
    const gl = displayCurrency === 'USD' ? row.gain_loss_usd
             : displayCurrency === 'EUR' ? row.gain_loss_eur
             : row.gain_loss_try
    if (gl != null) glMap.set(row.asset_id, Number(gl))
  }

  // ── Compute live values per asset → net worth, breakdown, performance ─────
  let currentNetWorth = 0
  const bySymbolLive = new Map<string, { code: string; name: string | null; type: string; value: number }>()
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

    currentNetWorth += currentValue

    // Accumulate breakdown by symbol code
    if (bySymbolLive.has(sym.code)) {
      bySymbolLive.get(sym.code)!.value += currentValue
    } else {
      bySymbolLive.set(sym.code, {
        code: sym.code,
        name: sym.name,
        type: sym.type,
        value: currentValue,
      })
    }

    const gainLossAmount = glMap.get(asset.id) ?? null
    const costBasis = gainLossAmount != null ? currentValue - gainLossAmount : null
    const gainLossPct = costBasis != null && costBasis !== 0
      ? (gainLossAmount! / costBasis) * 100
      : null
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
      gainLossAmount,
      gainLossPct,
      cagrValue,
      firstTransactionDate: firstDate,
    })
  }

  performance.sort((a, b) => b.currentValue - a.currentValue)

  // ── Asset breakdown from live values ──────────────────────────────────────
  const totalValue = currentNetWorth || 1
  const assetBreakdown: AssetBreakdownSegment[] = Array.from(bySymbolLive.values())
    .sort((a, b) => b.value - a.value)
    .map((item) => ({
      symbolCode: item.code,
      symbolName: item.name,
      symbolType: item.type as SymbolType,
      value: item.value,
      pct: (item.value / totalValue) * 100,
    }))

  // ── Time-based comparisons (snapshot history vs. live net worth) ──────────
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

  const val24h    = snap24h     ? (pickNetWorth(snap24h,        displayCurrency) ?? null) : null
  const val7d     = snap7d      ? (pickNetWorth(snap7d,         displayCurrency) ?? null) : null
  const val30d    = snap30d     ? (pickNetWorth(snap30d,        displayCurrency) ?? null) : null
  const valOldest = oldestSnapshot ? (pickNetWorth(oldestSnapshot, displayCurrency) ?? null) : null

  const netWorth: NetWorthSummary = {
    current: currentNetWorth,
    displayCurrency,
    changeAllTime:    valOldest != null ? currentNetWorth - valOldest : null,
    changeAllTimePct: pctChange(valOldest, currentNetWorth),
    change24h:    val24h != null ? currentNetWorth - val24h : null,
    change24hPct: pctChange(val24h,  currentNetWorth),
    change7d:     val7d  != null ? currentNetWorth - val7d  : null,
    change7dPct:  pctChange(val7d,   currentNetWorth),
    change30d:    val30d != null ? currentNetWorth - val30d : null,
    change30dPct: pctChange(val30d,  currentNetWorth),
    ratesUpdatedAt,
  }

  // ── Chart data from snapshot history ──────────────────────────────────────
  const chartSymbolSet = new Set<string>(assetBreakdown.map((s) => s.symbolCode))

  const sampledSnapshots = downsample(snapshotRows, 90)
  const chartData: ChartPoint[] = []

  if (sampledSnapshots.length > 0) {
    const sampledIds = sampledSnapshots.map((s) => s.id)
    const { data: allSnapshotAssets } = await supabase
      .from('snapshot_assets')
      .select('snapshot_id, value_try, value_usd, value_eur, gain_loss_try, gain_loss_usd, gain_loss_eur, symbol:symbols(code)')
      .in('snapshot_id', sampledIds)

    type SnapAssetMin = {
      snapshot_id: string
      value_try: number | null
      value_usd: number | null
      value_eur: number | null
      gain_loss_try: number | null
      gain_loss_usd: number | null
      gain_loss_eur: number | null
      symbol: { code: string } | null
    }

    function pickGainLoss(sa: SnapAssetMin, currency: typeof displayCurrency): number | null {
      const raw = currency === 'USD' ? sa.gain_loss_usd
                : currency === 'EUR' ? sa.gain_loss_eur
                : sa.gain_loss_try
      return raw != null ? Number(raw) : null
    }

    const snapshotAssetMap = new Map<string, Map<string, number>>()
    const snapshotGlMap = new Map<string, Map<string, number>>()
    for (const sa of ((allSnapshotAssets ?? []) as unknown as SnapAssetMin[])) {
      if (!snapshotAssetMap.has(sa.snapshot_id)) {
        snapshotAssetMap.set(sa.snapshot_id, new Map())
        snapshotGlMap.set(sa.snapshot_id, new Map())
      }
      const code = sa.symbol?.code ?? 'Unknown'
      const val = pickAssetValue(sa, displayCurrency) ?? 0
      const existing = snapshotAssetMap.get(sa.snapshot_id)!.get(code) ?? 0
      snapshotAssetMap.get(sa.snapshot_id)!.set(code, existing + val)
      const gl = pickGainLoss(sa, displayCurrency)
      if (gl != null) {
        const existingGl = snapshotGlMap.get(sa.snapshot_id)!.get(code) ?? 0
        snapshotGlMap.get(sa.snapshot_id)!.set(code, existingGl + gl)
      }
    }

    for (const s of sampledSnapshots) {
      const bySymbol: Record<string, number> = {}
      const gainLossBySymbol: Record<string, number> = {}
      const symbolMap = snapshotAssetMap.get(s.id)
      const glSymbolMap = snapshotGlMap.get(s.id)
      if (symbolMap) {
        for (const [code, val] of symbolMap) {
          bySymbol[code] = val
          chartSymbolSet.add(code)
        }
      }
      if (glSymbolMap) {
        for (const [code, gl] of glSymbolMap) {
          gainLossBySymbol[code] = gl
        }
      }
      const glValues = Object.values(gainLossBySymbol)
      const gainLoss = glValues.length > 0 ? glValues.reduce((sum, v) => sum + v, 0) : null
      chartData.push({
        date: s.taken_at.slice(0, 10),
        netWorth: pickNetWorth(s, displayCurrency) ?? 0,
        bySymbol,
        gainLoss,
        gainLossBySymbol,
      })
    }
  }

  // ── Peek: accounts with live total values ────────────────────────────────
  const accountValueMap = new Map<string, number>()
  for (const asset of assetRows) {
    const sym = asset.symbol
    if (!sym) continue
    const rate = rateMap.get(asset.symbol_id)
    if (rate == null) continue
    const amount = Number(asset.amount)
    const pcf = sym.primary_conversion_fiat
    let valueTry: number
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
    const existing = accountValueMap.get(asset.account_id) ?? 0
    accountValueMap.set(asset.account_id, existing + currentValue)
  }

  const { data: accountsRaw } = await createServiceRoleClient()
    .from('accounts')
    .select('id, name, institution, owner_id, profiles(display_name)')
    .eq('household_id', householdId)
    .order('created_at', { ascending: true })

  const peekAccounts: PeekAccountRow[] = (accountsRaw ?? []).map((raw) => {
    const r = raw as unknown as Record<string, unknown>
    const prof = r.profiles as Record<string, unknown> | null
    return {
      id: r.id as string,
      name: r.name as string,
      institution: (r.institution as string | null) ?? null,
      ownerName: (prof?.display_name as string | null) ?? (r.owner_id as string),
      totalValue: accountValueMap.get(r.id as string) ?? 0,
    }
  })

  // ── Peek: last 5 transactions ─────────────────────────────────────────────
  type TxRaw = {
    id: string
    type: string
    date: string
    to_amount: number | null
    from_amount: number | null
    fee_amount: number | null
    fee_side: string | null
    exchange_rate: number | null
    notes: string | null
    to_asset: {
      id: string; symbol_id: string; account_id: string
      symbols: { id: string; code: string; name: string | null } | null
      accounts: { id: string; name: string } | null
    } | null
    from_asset: {
      id: string; symbol_id: string; account_id: string
      symbols: { id: string; code: string; name: string | null } | null
      accounts: { id: string; name: string } | null
    } | null
  }

  const { data: txWithAmounts } = await supabase
    .from('transactions')
    .select(`
      id, type, date, to_amount, from_amount, fee_amount, fee_side, exchange_rate, notes,
      to_asset:assets!transactions_to_asset_id_fkey(
        id, symbol_id, account_id,
        symbols(id, code, name),
        accounts(id, name)
      ),
      from_asset:assets!transactions_from_asset_id_fkey(
        id, symbol_id, account_id,
        symbols(id, code, name),
        accounts(id, name)
      )
    `)
    .eq('household_id', householdId)
    .order('date', { ascending: false })
    .limit(5)

  const peekTransactions: PeekTransactionRow[] = ((txWithAmounts ?? []) as unknown as TxRaw[]).map((r) => {
    const toSym = r.to_asset?.symbols ?? null
    const fromSym = r.from_asset?.symbols ?? null
    const feeSymCode = r.fee_side === 'to' ? (toSym?.code ?? null) : (fromSym?.code ?? null)
    return {
      id: r.id,
      type: r.type,
      date: r.date,
      fromSymbolCode: fromSym?.code ?? null,
      fromSymbolName: fromSym?.name ?? null,
      fromAmount: r.from_amount != null ? Number(r.from_amount) : null,
      fromAccountName: r.from_asset?.accounts?.name ?? null,
      toSymbolCode: toSym?.code ?? null,
      toSymbolName: toSym?.name ?? null,
      toAmount: r.to_amount != null ? Number(r.to_amount) : null,
      toAccountName: r.to_asset?.accounts?.name ?? null,
      feeAmount: r.fee_amount != null ? Number(r.fee_amount) : null,
      feeSymbolCode: feeSymCode,
      feeSide: r.fee_side,
      exchangeRate: r.exchange_rate != null ? Number(r.exchange_rate) : null,
      notes: r.notes,
    }
  })

  // ── Peek: top 5 rates by absolute 24h change ──────────────────────────────
  const { data: allActiveSymbols } = await supabase
    .from('symbols')
    .select('id, code, name, type')
    .eq('is_active', true)
    .order('code')

  const twentyFiveHoursAgo = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString()
  const activeSymbolIds = (allActiveSymbols ?? []).map((s) => s.id)

  type RateHistRow = { symbol_id: string; rate: number; fetched_at: string }
  const peekRates: PeekRateRow[] = []

  if (activeSymbolIds.length > 0) {
    const { data: recentRates } = await supabase
      .from('exchange_rates')
      .select('symbol_id, rate, fetched_at')
      .in('symbol_id', activeSymbolIds)
      .gte('fetched_at', twentyFiveHoursAgo)
      .order('fetched_at', { ascending: false })

    // Per symbol: first row = latest, last row closest to 24h ago
    const latestBySymbol = new Map<string, RateHistRow>()
    const oldestBySymbol = new Map<string, RateHistRow>()
    for (const r of ((recentRates ?? []) as RateHistRow[])) {
      if (!latestBySymbol.has(r.symbol_id)) latestBySymbol.set(r.symbol_id, r)
      oldestBySymbol.set(r.symbol_id, r) // keep overwriting — last wins = oldest in window
    }

    const symMap = new Map((allActiveSymbols ?? []).map((s) => [s.id, s]))
    const rateRows: PeekRateRow[] = []
    for (const [symId, latest] of latestBySymbol) {
      const sym = symMap.get(symId)
      if (!sym) continue
      const oldest = oldestBySymbol.get(symId)
      const currentRate = Number(latest.rate)
      let change24hPct: number | null = null
      let change24hAbs: number | null = null
      if (oldest && oldest.fetched_at !== latest.fetched_at) {
        const oldRate = Number(oldest.rate)
        if (oldRate !== 0) {
          change24hPct = ((currentRate - oldRate) / oldRate) * 100
          change24hAbs = Math.abs(change24hPct)
        }
      }
      rateRows.push({
        symbolId: symId,
        symbolCode: sym.code,
        symbolName: sym.name ?? null,
        symbolType: sym.type as SymbolType,
        currentRate,
        change24hPct,
        change24hAbs,
      })
    }
    rateRows.sort((a, b) => (b.change24hAbs ?? 0) - (a.change24hAbs ?? 0))
    peekRates.push(...rateRows.slice(0, 5))
  }

  return {
    householdId,
    netWorth,
    assetBreakdown,
    chartData,
    chartSymbols: [...chartSymbolSet],
    performance,
    peekAccounts,
    peekTransactions,
    peekRates,
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
