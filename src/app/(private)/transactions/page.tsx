import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { AppShell } from '@/components/shared/app-shell'
import { TransactionsPageClient } from '@/components/transactions/transactions-page-client'
import type { TransactionType, FeeSide, EntryMode, DisplayCurrency } from '@/lib/types/domain'

export const dynamic = 'force-dynamic'

export interface AssetRef {
  assetId: string
  symbolId: string
  symbolCode: string
  symbolName: string | null
  accountId: string
  accountName: string
}

export interface TransactionRow {
  id: string
  householdId: string
  type: TransactionType
  date: string
  toAssetId: string | null
  fromAssetId: string | null
  feeSide: FeeSide | null
  toAmount: number | null
  fromAmount: number | null
  feeAmount: number | null
  exchangeRate: number | null
  entryMode: EntryMode | null
  notes: string | null
  createdBy: string
  createdAt: string
  updatedAt: string
  toAsset?: AssetRef
  fromAsset?: AssetRef
}

function toAssetRef(raw: Record<string, unknown> | null | undefined): AssetRef | undefined {
  if (!raw) return undefined
  const symbol = raw.symbols as Record<string, unknown> | null
  const account = raw.accounts as Record<string, unknown> | null
  return {
    assetId: raw.id as string,
    symbolId: raw.symbol_id as string,
    symbolCode: (symbol?.code as string) ?? '',
    symbolName: (symbol?.name as string | null) ?? null,
    accountId: raw.account_id as string,
    accountName: (account?.name as string) ?? '',
  }
}

export default async function TransactionsPage() {
  const supabase = await createServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: membership } = await supabase
    .from('household_members')
    .select('household_id, role, households(display_currency)')
    .eq('user_id', user.id)
    .order('joined_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (!membership) redirect('/onboarding')

  const householdId = membership.household_id
  const role = membership.role as 'manager' | 'editor' | 'viewer'
  const household = membership.households as unknown as { display_currency: string } | null
  const displayCurrency = (household?.display_currency ?? 'TRY') as DisplayCurrency

  // Display name for AppShell
  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('id', user.id)
    .maybeSingle()
  const displayName = profile?.display_name ?? user.email?.split('@')[0] ?? 'User'

  const { data: txRaw } = await supabase
    .from('transactions')
    .select(`
      *,
      to_asset:assets!transactions_to_asset_id_fkey(
        id, symbol_id, account_id,
        symbols(id, code, name, type),
        accounts(id, name)
      ),
      from_asset:assets!transactions_from_asset_id_fkey(
        id, symbol_id, account_id,
        symbols(id, code, name, type),
        accounts(id, name)
      )
    `)
    .eq('household_id', householdId)
    .order('date', { ascending: false })
    .limit(500)

  // Assets for the edit form
  const { data: assetsRaw } = await supabase
    .from('assets')
    .select('id, symbol_id, account_id, symbols(id, code, name, type), accounts(id, name)')
    .eq('household_id', householdId)

  const assetOptions: AssetRef[] = (assetsRaw ?? []).map((raw) => {
    const r = raw as unknown as Record<string, unknown>
    const sym = r.symbols as Record<string, unknown>
    const acc = r.accounts as Record<string, unknown>
    return {
      assetId: r.id as string,
      symbolId: r.symbol_id as string,
      symbolCode: (sym?.code as string) ?? '',
      symbolName: (sym?.name as string | null) ?? null,
      accountId: r.account_id as string,
      accountName: (acc?.name as string) ?? '',
    }
  })

  const transactions: TransactionRow[] = (txRaw ?? []).map((raw) => {
    const r = raw as unknown as Record<string, unknown>
    return {
      id: r.id as string,
      householdId: r.household_id as string,
      type: r.type as TransactionType,
      date: r.date as string,
      toAssetId: (r.to_asset_id as string | null) ?? null,
      fromAssetId: (r.from_asset_id as string | null) ?? null,
      feeSide: (r.fee_side as FeeSide | null) ?? null,
      toAmount: r.to_amount != null ? Number(r.to_amount) : null,
      fromAmount: r.from_amount != null ? Number(r.from_amount) : null,
      feeAmount: r.fee_amount != null ? Number(r.fee_amount) : null,
      exchangeRate: r.exchange_rate != null ? Number(r.exchange_rate) : null,
      entryMode: (r.entry_mode as EntryMode | null) ?? null,
      notes: (r.notes as string | null) ?? null,
      createdBy: r.created_by as string,
      createdAt: r.created_at as string,
      updatedAt: r.updated_at as string,
      toAsset: toAssetRef(r.to_asset as Record<string, unknown> | null),
      fromAsset: toAssetRef(r.from_asset as Record<string, unknown> | null),
    }
  })

  // Fetch current rates for trade G/L computation
  const allSymbolIds = [...new Set(assetOptions.map((a) => a.symbolId))]
  const rateMap: Record<string, number> = {}
  let usdRate: number | null = null
  let eurRate: number | null = null

  if (allSymbolIds.length > 0) {
    const { data: fxSymbols } = await supabase
      .from('symbols')
      .select('id, code')
      .in('code', ['USD', 'EUR'])
      .is('household_id', null)

    const usdSymbolId = (fxSymbols ?? []).find((s) => s.code === 'USD')?.id ?? null
    const eurSymbolId = (fxSymbols ?? []).find((s) => s.code === 'EUR')?.id ?? null

    const queryIds = [...new Set([...allSymbolIds, usdSymbolId, eurSymbolId].filter(Boolean) as string[])]

    const { data: rates } = await supabase
      .from('exchange_rates')
      .select('symbol_id, rate, fetched_at')
      .in('symbol_id', queryIds)
      .order('fetched_at', { ascending: false })

    const seen = new Set<string>()
    for (const r of (rates ?? []) as { symbol_id: string; rate: number }[]) {
      if (!seen.has(r.symbol_id)) {
        rateMap[r.symbol_id] = Number(r.rate)
        if (r.symbol_id === usdSymbolId) usdRate = Number(r.rate)
        if (r.symbol_id === eurSymbolId) eurRate = Number(r.rate)
        seen.add(r.symbol_id)
      }
    }
  }

  return (
    <AppShell title="Transactions" displayName={displayName}>
      <TransactionsPageClient
        transactions={transactions}
        assetOptions={assetOptions}
        role={role}
        displayCurrency={displayCurrency}
        rateMap={rateMap}
        usdRate={usdRate}
        eurRate={eurRate}
      />
    </AppShell>
  )
}
