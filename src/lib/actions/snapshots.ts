'use server'

import { revalidatePath } from 'next/cache'
import { createServerClient, createServiceRoleClient } from '@/lib/supabase/server'
import type { Snapshot, SnapshotTrigger, ActionResult } from '@/lib/types/domain'

// ─── Internal types ───────────────────────────────────────────────────────────

interface AssetRow {
  id: string
  amount: number
  symbol_id: string
  symbol: {
    id: string
    code: string
    type: string
    primary_conversion_fiat: string | null
  }
}

interface RateRow {
  symbol_id: string
  rate: number
  fetched_at: string
}

interface SnapshotAssetInput {
  assetId: string
  symbolId: string
  amount: number
  valueTry: number
  valueUsd: number | null
  valueEur: number | null
}

// ─── Core snapshot logic ──────────────────────────────────────────────────────

/**
 * Create a snapshot for a single household.
 *
 * Uses the service-role client to write to snapshots and snapshot_assets.
 * Called by triggerManualSnapshot (Server Action) and the cron Route Handler.
 *
 * Net worth calculation:
 *   1. For each asset, find the latest exchange_rate row for that symbol.
 *   2. Convert asset value to TRY:
 *        - primary_conversion_fiat = null (fiat_currency, stock, tefas_fund) or 'TRY'
 *            → value_in_try = amount × rate  (rate is already TRY-denominated)
 *        - primary_conversion_fiat = 'USD'
 *            → value_in_try = amount × rate × usd_try
 *        - primary_conversion_fiat = 'EUR'
 *            → value_in_try = amount × rate × eur_try
 *   3. Sum → net_worth_try; derive net_worth_usd and net_worth_eur via FX rates.
 *   4. value_in_display_currency = value_in_try / display_fiat_try_rate.
 *
 * Assets with no exchange rate are skipped (not included in net worth).
 */
export async function createSnapshot(
  householdId: string,
  trigger: SnapshotTrigger
): Promise<Snapshot> {
  const supabase = createServiceRoleClient()

  // ── Load household ──────────────────────────────────────────────────────
  const { data: household, error: hErr } = await supabase
    .from('households')
    .select('id')
    .eq('id', householdId)
    .single()

  if (hErr || !household) {
    throw new Error(`Household not found: ${hErr?.message ?? 'no data'}`)
  }

  // ── Load all assets with their symbols ─────────────────────────────────
  const { data: assets, error: aErr } = await supabase
    .from('assets')
    .select(`
      id,
      amount,
      symbol_id,
      symbol:symbols (
        id,
        code,
        type,
        primary_conversion_fiat
      )
    `)
    .eq('household_id', householdId)

  if (aErr) throw new Error(`Failed to load assets: ${aErr.message}`)

  const assetRows = (assets ?? []) as unknown as AssetRow[]

  // ── Collect symbol IDs needed for rate lookups ──────────────────────────
  const assetSymbolIds = [...new Set(assetRows.map((a) => a.symbol_id))]

  // Always include USD and EUR for cross-rate conversion (global symbols)
  const { data: fxSymbols } = await supabase
    .from('symbols')
    .select('id, code')
    .in('code', ['USD', 'EUR'])
    .is('household_id', null)

  const usdSymbolId = fxSymbols?.find((s) => s.code === 'USD')?.id ?? null
  const eurSymbolId = fxSymbols?.find((s) => s.code === 'EUR')?.id ?? null

  const allSymbolIds = [
    ...new Set(
      [...assetSymbolIds, usdSymbolId, eurSymbolId].filter(Boolean) as string[]
    ),
  ]

  // ── Fetch latest exchange rate per symbol ───────────────────────────────
  const { data: rates, error: rErr } = await supabase
    .from('exchange_rates')
    .select('symbol_id, rate, fetched_at')
    .in('symbol_id', allSymbolIds)
    .order('fetched_at', { ascending: false })

  if (rErr) throw new Error(`Failed to load exchange rates: ${rErr.message}`)

  // Deduplicate: keep only the most recent rate per symbol
  const rateBySymbol = new Map<string, number>()
  for (const row of (rates ?? []) as RateRow[]) {
    if (!rateBySymbol.has(row.symbol_id)) {
      rateBySymbol.set(row.symbol_id, Number(row.rate))
    }
  }

  // ── Cross rates (TRY per 1 USD or EUR) ─────────────────────────────────
  const usdTry = usdSymbolId ? (rateBySymbol.get(usdSymbolId) ?? null) : null
  const eurTry = eurSymbolId ? (rateBySymbol.get(eurSymbolId) ?? null) : null

  // ── Calculate per-asset values ──────────────────────────────────────────
  let netWorthTry = 0
  const snapshotAssets: SnapshotAssetInput[] = []

  for (const asset of assetRows) {
    const sym = asset.symbol
    const rate = rateBySymbol.get(asset.symbol_id)

    if (rate == null) continue // no rate available — skip this asset

    const amount = Number(asset.amount)
    let valueInTry: number

    const pcf = sym.primary_conversion_fiat

    if (pcf === 'USD') {
      if (usdTry == null) continue // cannot convert without USD/TRY rate
      valueInTry = amount * rate * usdTry
    } else if (pcf === 'EUR') {
      if (eurTry == null) continue
      valueInTry = amount * rate * eurTry
    } else {
      // null (fiat_currency, stock, tefas_fund) or 'TRY' — rate is already TRY-denominated
      valueInTry = amount * rate
    }

    const valueUsd = usdTry && usdTry > 0 ? valueInTry / usdTry : null
    const valueEur = eurTry && eurTry > 0 ? valueInTry / eurTry : null

    netWorthTry += valueInTry
    snapshotAssets.push({
      assetId: asset.id,
      symbolId: asset.symbol_id,
      amount,
      valueTry: valueInTry,
      valueUsd,
      valueEur,
    })
  }

  const netWorthUsd = usdTry && usdTry > 0 ? netWorthTry / usdTry : null
  const netWorthEur = eurTry && eurTry > 0 ? netWorthTry / eurTry : null

  // ── Insert snapshot row ──────────────────────────────────────────────────
  const { data: snapshot, error: sErr } = await supabase
    .from('snapshots')
    .insert({
      household_id: householdId,
      net_worth_try: netWorthTry,
      net_worth_usd: netWorthUsd,
      net_worth_eur: netWorthEur,
      trigger,
    })
    .select()
    .single()

  if (sErr || !snapshot) {
    throw new Error(`Failed to insert snapshot: ${sErr?.message ?? 'no data'}`)
  }

  // ── Insert snapshot_assets rows ─────────────────────────────────────────
  if (snapshotAssets.length > 0) {
    const { error: saErr } = await supabase.from('snapshot_assets').insert(
      snapshotAssets.map((sa) => ({
        snapshot_id: snapshot.id,
        household_id: householdId,
        asset_id: sa.assetId,
        symbol_id: sa.symbolId,
        amount: sa.amount,
        value_try: sa.valueTry,
        value_usd: sa.valueUsd,
        value_eur: sa.valueEur,
      }))
    )
    if (saErr) throw new Error(`Failed to insert snapshot_assets: ${saErr.message}`)
  }

  return {
    id: snapshot.id as string,
    householdId: snapshot.household_id as string,
    takenAt: snapshot.taken_at as string,
    netWorthTry: snapshot.net_worth_try != null ? Number(snapshot.net_worth_try) : null,
    netWorthUsd: snapshot.net_worth_usd != null ? Number(snapshot.net_worth_usd) : null,
    netWorthEur: snapshot.net_worth_eur != null ? Number(snapshot.net_worth_eur) : null,
    trigger: snapshot.trigger as SnapshotTrigger,
    createdAt: snapshot.created_at as string,
    updatedAt: snapshot.updated_at as string,
  }
}

// ─── Server Actions ───────────────────────────────────────────────────────────

export interface SnapshotAssetDetail {
  id: string
  assetId: string
  symbolId: string
  symbolCode: string
  symbolName: string | null
  symbolType: string
  accountId: string
  accountName: string
  amount: number
  valueTry: number | null
  valueUsd: number | null
  valueEur: number | null
}

/**
 * Fetch asset-level detail for a single snapshot.
 * Callable by any authenticated member of the household that owns the snapshot.
 */
export async function getSnapshotAssets(
  snapshotId: string
): Promise<ActionResult<SnapshotAssetDetail[]>> {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { success: false, error: 'Not authenticated' }

  // Confirm snapshot exists and belongs to a household the user is a member of
  const { data: snapshot } = await supabase
    .from('snapshots')
    .select('household_id')
    .eq('id', snapshotId)
    .single()

  if (!snapshot) return { success: false, error: 'Snapshot not found' }

  const { data: membership } = await supabase
    .from('household_members')
    .select('id')
    .eq('household_id', snapshot.household_id)
    .eq('user_id', user.id)
    .single()

  if (!membership) return { success: false, error: 'Not a member of this household' }

  const { data: rows, error } = await supabase
    .from('snapshot_assets')
    .select(`
      id,
      asset_id,
      symbol_id,
      amount,
      value_try,
      value_usd,
      value_eur,
      symbol:symbols ( code, name, type ),
      asset:assets ( account_id, account:accounts ( id, name ) )
    `)
    .eq('snapshot_id', snapshotId)
    .order('value_try', { ascending: false })

  if (error) return { success: false, error: error.message }

  type RawRow = {
    id: string
    asset_id: string
    symbol_id: string
    amount: number
    value_try: number | null
    value_usd: number | null
    value_eur: number | null
    symbol: { code: string; name: string | null; type: string } | null
    asset: { account_id: string; account: { id: string; name: string } | null } | null
  }

  const details: SnapshotAssetDetail[] = ((rows ?? []) as unknown as RawRow[]).map((r) => ({
    id: r.id,
    assetId: r.asset_id,
    symbolId: r.symbol_id,
    symbolCode: r.symbol?.code ?? '—',
    symbolName: r.symbol?.name ?? null,
    symbolType: r.symbol?.type ?? '',
    accountId: r.asset?.account?.id ?? r.asset?.account_id ?? '',
    accountName: r.asset?.account?.name ?? 'Unknown account',
    amount: Number(r.amount),
    valueTry: r.value_try != null ? Number(r.value_try) : null,
    valueUsd: r.value_usd != null ? Number(r.value_usd) : null,
    valueEur: r.value_eur != null ? Number(r.value_eur) : null,
  }))

  return { success: true, data: details }
}



/**
 * Manual "Take Snapshot Now" trigger.
 * Any authenticated member of the household can call this.
 */
export async function triggerManualSnapshot(
  householdId: string
): Promise<ActionResult<Snapshot>> {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { success: false, error: 'Not authenticated' }

  // Verify the user is a member of this household
  const { data: membership } = await supabase
    .from('household_members')
    .select('id')
    .eq('household_id', householdId)
    .eq('user_id', user.id)
    .single()

  if (!membership) return { success: false, error: 'Not a member of this household' }

  try {
    const snapshot = await createSnapshot(householdId, 'manual')
    revalidatePath('/settings/snapshots')
    return { success: true, data: snapshot }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { success: false, error: message }
  }
}
