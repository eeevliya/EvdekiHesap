'use server'

import { createServerClient } from '@/lib/supabase/server'
import type { DisplayCurrency, SymbolType } from '@/lib/types/domain'

// ─── Output types ─────────────────────────────────────────────────────────────

export interface SymbolRateRow {
  symbolId: string
  code: string
  name: string | null
  type: SymbolType
  isActive: boolean
  currentRate: number | null
  fetchedAt: string | null
  change24hPct: number | null
}

export interface RatesPageData {
  symbols: SymbolRateRow[]
  displayCurrency: DisplayCurrency
  householdId: string
  lastUpdated: string | null
}

export interface HistoricalRatePoint {
  date: string  // YYYY-MM-DD
  open: number
  high: number
  low: number
  close: number
}

export interface SymbolAssetRow {
  accountId: string
  accountName: string
  assetId: string
  amount: number
  currentValue: number | null
  gainLossAmount: number | null
  gainLossPct: number | null
}

export interface SymbolDetailData {
  symbolId: string
  code: string
  name: string | null
  type: SymbolType
  currentRate: number | null
  fetchedAt: string | null
  change24h: number | null
  change7d: number | null
  change1m: number | null
  change1y: number | null
  history: HistoricalRatePoint[]  // daily OHLC, 1Y max
  assets: SymbolAssetRow[]
  displayCurrency: DisplayCurrency
  quoteCurrency: string  // currency the rate is denominated in
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pctChange(from: number | null, to: number | null): number | null {
  if (from == null || to == null || from === 0) return null
  return ((to - from) / from) * 100
}

// ─── getRatesPageData ─────────────────────────────────────────────────────────

export async function getRatesPageData(): Promise<RatesPageData | null> {
  const supabase = await createServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: membership } = await supabase
    .from('household_members')
    .select('household_id, households(display_currency)')
    .eq('user_id', user.id)
    .order('joined_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (!membership) return null

  const householdId = membership.household_id
  const household = membership.households as unknown as { display_currency: string } | null
  const displayCurrency = (household?.display_currency ?? 'TRY') as DisplayCurrency

  // All active symbols (global + household)
  const [{ data: globalSymbols }, { data: householdSymbols }] = await Promise.all([
    supabase.from('symbols').select('id, code, name, type, is_active').is('household_id', null).order('code'),
    supabase.from('symbols').select('id, code, name, type, is_active').eq('household_id', householdId).order('code'),
  ])

  const allSymbols = [
    ...(globalSymbols ?? []),
    ...(householdSymbols ?? []),
  ] as { id: string; code: string; name: string | null; type: string; is_active: boolean }[]

  const activeSymbolIds = allSymbols.filter((s) => s.is_active).map((s) => s.id)

  if (activeSymbolIds.length === 0) {
    return {
      symbols: allSymbols.map((s) => ({
        symbolId: s.id, code: s.code, name: s.name, type: s.type as SymbolType,
        isActive: s.is_active, currentRate: null, fetchedAt: null, change24hPct: null,
      })),
      displayCurrency,
      householdId,
      lastUpdated: null,
    }
  }

  // Latest rate + 24h-ago rate: query last 25h, ordered by fetched_at DESC
  const twentyFiveHoursAgo = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString()

  const { data: recentRates } = await supabase
    .from('exchange_rates')
    .select('symbol_id, rate, fetched_at')
    .in('symbol_id', activeSymbolIds)
    .gte('fetched_at', twentyFiveHoursAgo)
    .order('fetched_at', { ascending: false })

  type RateRow = { symbol_id: string; rate: number; fetched_at: string }
  const rows = (recentRates ?? []) as RateRow[]

  // Per symbol: first = latest, last = oldest-in-window (≈24h ago)
  const latestBySymbol = new Map<string, RateRow>()
  const oldestBySymbol = new Map<string, RateRow>()
  for (const r of rows) {
    if (!latestBySymbol.has(r.symbol_id)) latestBySymbol.set(r.symbol_id, r)
    oldestBySymbol.set(r.symbol_id, r)
  }

  const symbols: SymbolRateRow[] = allSymbols.map((sym) => {
    const latest = latestBySymbol.get(sym.id)
    const oldest = oldestBySymbol.get(sym.id)
    const currentRate = latest ? Number(latest.rate) : null
    const oldRate = oldest && oldest.fetched_at !== latest?.fetched_at ? Number(oldest.rate) : null
    return {
      symbolId: sym.id,
      code: sym.code,
      name: sym.name,
      type: sym.type as SymbolType,
      isActive: sym.is_active,
      currentRate,
      fetchedAt: latest?.fetched_at ?? null,
      change24hPct: pctChange(oldRate, currentRate),
    }
  })

  // Most recent fetched_at across all active symbols
  const lastUpdated = symbols.reduce<string | null>((max, s) => {
    if (!s.fetchedAt) return max
    if (!max || s.fetchedAt > max) return s.fetchedAt
    return max
  }, null)

  return { symbols, displayCurrency, householdId, lastUpdated }
}

// ─── getSymbolDetail ──────────────────────────────────────────────────────────

export async function getSymbolDetail(symbolId: string): Promise<SymbolDetailData | null> {
  const supabase = await createServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: membership } = await supabase
    .from('household_members')
    .select('household_id, households(display_currency)')
    .eq('user_id', user.id)
    .order('joined_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (!membership) return null

  const householdId = membership.household_id
  const household = membership.households as unknown as { display_currency: string } | null
  const displayCurrency = (household?.display_currency ?? 'TRY') as DisplayCurrency

  // Symbol info
  const { data: sym } = await supabase
    .from('symbols')
    .select('id, code, name, type')
    .eq('id', symbolId)
    .maybeSingle()

  if (!sym) return null

  // Fetch 1Y of exchange rate history
  const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString()

  const { data: historyRaw } = await supabase
    .from('exchange_rates')
    .select('rate, fetched_at')
    .eq('symbol_id', symbolId)
    .gte('fetched_at', oneYearAgo)
    .order('fetched_at', { ascending: true })

  type HistRow = { rate: number; fetched_at: string }
  const histRows = (historyRaw ?? []) as HistRow[]

  // Aggregate raw rows into daily OHLC candles
  const dayMap = new Map<string, { open: number; high: number; low: number; close: number }>()
  for (const r of histRows) {
    const date = r.fetched_at.slice(0, 10) // YYYY-MM-DD
    const rate = Number(r.rate)
    const existing = dayMap.get(date)
    if (!existing) {
      dayMap.set(date, { open: rate, high: rate, low: rate, close: rate })
    } else {
      existing.high = Math.max(existing.high, rate)
      existing.low = Math.min(existing.low, rate)
      existing.close = rate // rows are ascending by fetched_at, so last = close
    }
  }
  const history: HistoricalRatePoint[] = Array.from(dayMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, d]) => ({ date, open: d.open, high: d.high, low: d.low, close: d.close }))

  // Latest rate
  const latestRow = histRows.at(-1)
  const currentRate = latestRow ? Number(latestRow.rate) : null
  const fetchedAt = latestRow?.fetched_at ?? null

  // Change indicators: find closest row to each time threshold
  function rateAtOffset(msAgo: number): number | null {
    const target = Date.now() - msAgo
    const earliest = histRows[0]
    if (!earliest || new Date(earliest.fetched_at).getTime() > target) return null
    // Find last row before or at target
    let result: HistRow | null = null
    for (const r of histRows) {
      if (new Date(r.fetched_at).getTime() <= target) result = r
      else break
    }
    return result ? Number(result.rate) : null
  }

  const rate24h = rateAtOffset(24 * 60 * 60 * 1000)
  const rate7d = rateAtOffset(7 * 24 * 60 * 60 * 1000)
  const rate1m = rateAtOffset(30 * 24 * 60 * 60 * 1000)
  const rate1y = rateAtOffset(365 * 24 * 60 * 60 * 1000)

  // Fetch assets in this household that use this symbol
  const { data: assetsRaw } = await supabase
    .from('assets')
    .select('id, amount, account_id, accounts(id, name)')
    .eq('household_id', householdId)
    .eq('symbol_id', symbolId)

  // Compute current value per asset
  // Need USD/EUR rates for cross-currency conversion
  let usdRate: number | null = null
  let eurRate: number | null = null

  const { data: fxSymbols } = await supabase
    .from('symbols')
    .select('id, code')
    .in('code', ['USD', 'EUR'])
    .is('household_id', null)

  const usdSymbolId = (fxSymbols ?? []).find((s) => s.code === 'USD')?.id ?? null
  const eurSymbolId = (fxSymbols ?? []).find((s) => s.code === 'EUR')?.id ?? null

  if (usdSymbolId || eurSymbolId) {
    const fxIds = [usdSymbolId, eurSymbolId].filter(Boolean) as string[]
    const { data: fxRates } = await supabase
      .from('exchange_rates')
      .select('symbol_id, rate')
      .in('symbol_id', fxIds)
      .order('fetched_at', { ascending: false })

    const seenFx = new Set<string>()
    for (const r of (fxRates ?? []) as { symbol_id: string; rate: number }[]) {
      if (!seenFx.has(r.symbol_id)) {
        if (r.symbol_id === usdSymbolId) usdRate = Number(r.rate)
        if (r.symbol_id === eurSymbolId) eurRate = Number(r.rate)
        seenFx.add(r.symbol_id)
      }
    }
  }

  // Get G/L from latest snapshot
  const { data: latestSnapshot } = await supabase
    .from('snapshots')
    .select('id')
    .eq('household_id', householdId)
    .order('taken_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const glMap = new Map<string, number>()
  if (latestSnapshot) {
    const { data: snapAssets } = await supabase
      .from('snapshot_assets')
      .select('asset_id, gain_loss_try, gain_loss_usd, gain_loss_eur')
      .eq('snapshot_id', latestSnapshot.id)
      .eq('symbol_id', symbolId)

    type GlRow = { asset_id: string; gain_loss_try: number | null; gain_loss_usd: number | null; gain_loss_eur: number | null }
    for (const row of (snapAssets ?? []) as GlRow[]) {
      const gl = displayCurrency === 'USD' ? row.gain_loss_usd
               : displayCurrency === 'EUR' ? row.gain_loss_eur
               : row.gain_loss_try
      if (gl != null) glMap.set(row.asset_id, Number(gl))
    }
  }

  // Also need primary_conversion_fiat for this symbol
  const { data: symFull } = await supabase
    .from('symbols')
    .select('primary_conversion_fiat')
    .eq('id', symbolId)
    .maybeSingle()

  const pcf = symFull?.primary_conversion_fiat ?? null

  type AssetRow = {
    id: string; amount: number; account_id: string
    accounts: { id: string; name: string } | null
  }

  const assets: SymbolAssetRow[] = ((assetsRaw ?? []) as unknown as AssetRow[]).map((raw) => {
    const amount = Number(raw.amount)
    let currentValue: number | null = null
    if (currentRate != null) {
      let valueTry: number
      if (pcf === 'USD') {
        if (usdRate) valueTry = amount * currentRate * usdRate
        else valueTry = 0
      } else if (pcf === 'EUR') {
        if (eurRate) valueTry = amount * currentRate * eurRate
        else valueTry = 0
      } else {
        valueTry = amount * currentRate
      }
      if (displayCurrency === 'USD') currentValue = usdRate ? valueTry / usdRate : null
      else if (displayCurrency === 'EUR') currentValue = eurRate ? valueTry / eurRate : null
      else currentValue = valueTry
    }

    const gl = glMap.get(raw.id) ?? null
    const costBasis = gl != null && currentValue != null ? currentValue - gl : null
    const gainLossPct = gl != null && costBasis != null && costBasis !== 0
      ? (gl / costBasis) * 100
      : null

    return {
      accountId: raw.account_id,
      accountName: raw.accounts?.name ?? 'Unknown',
      assetId: raw.id,
      amount,
      currentValue,
      gainLossAmount: gl,
      gainLossPct,
    }
  })

  return {
    symbolId: sym.id,
    code: sym.code,
    name: sym.name,
    type: sym.type as SymbolType,
    currentRate,
    fetchedAt,
    change24h: pctChange(rate24h, currentRate),
    change7d: pctChange(rate7d, currentRate),
    change1m: pctChange(rate1m, currentRate),
    change1y: pctChange(rate1y, currentRate),
    history,
    assets,
    displayCurrency,
    quoteCurrency: pcf === 'USD' ? 'USD' : pcf === 'EUR' ? 'EUR' : 'TRY',
  }
}
