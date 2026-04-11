import { redirect } from 'next/navigation'
import { createServerClient, createServiceRoleClient } from '@/lib/supabase/server'
import { AppShell } from '@/components/shared/app-shell'
import { AccountsPageClient } from '@/components/accounts/accounts-page-client'
import type { AssetSymbol, SymbolType, DisplayCurrency } from '@/lib/types/domain'
import type { AssetWithRate, AccountRow } from '@/components/accounts/account-dialogs'

export const dynamic = 'force-dynamic'

export default async function AccountsPage({
  searchParams,
}: {
  searchParams: Promise<{ account?: string }>
}) {
  const params = await searchParams
  const supabase = await createServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: membership } = await supabase
    .from('household_members')
    .select('household_id, role, households(display_currency), profiles(display_name)')
    .eq('user_id', user.id)
    .order('joined_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (!membership) redirect('/onboarding')

  const householdId = membership.household_id
  const role = membership.role as 'manager' | 'editor' | 'viewer'
  const household = membership.households as unknown as { display_currency: string } | null
  const displayCurrency = (household?.display_currency ?? 'TRY') as DisplayCurrency
  // Display name comes from the profiles join on the membership row — no extra round trip.
  const memberProfile = membership.profiles as unknown as { display_name: string } | null
  const displayName = memberProfile?.display_name ?? user.email?.split('@')[0] ?? 'User'

  const serviceClient = createServiceRoleClient()

  // Batch 1: fetch accounts, assets, and all symbols in parallel.
  // Symbols (global + household) are merged into one query — this also gives us
  // the USD/EUR symbol UUIDs we need for the rates query, eliminating a separate round trip.
  const [accountsResult, assetsResult, symbolsResult] = await Promise.all([
    serviceClient
      .from('accounts')
      .select('id, household_id, owner_id, name, institution, account_identifier, profiles(display_name)')
      .eq('household_id', householdId)
      .order('created_at', { ascending: true }),
    supabase
      .from('assets')
      .select('id, household_id, account_id, symbol_id, amount, created_at, updated_at, symbols(*)')
      .eq('household_id', householdId),
    supabase
      .from('symbols')
      .select('*')
      .or(`household_id.is.null,household_id.eq.${householdId}`)
      .order('code'),
  ])

  const accountsRaw = accountsResult.data
  const assetsRaw = assetsResult.data
  const allSymbolsRaw = symbolsResult.data ?? []

  function mapAssetSymbol(row: Record<string, unknown>): AssetSymbol {
    return {
      id: row.id as string,
      householdId: (row.household_id as string | null) ?? null,
      code: row.code as string,
      name: (row.name as string | null) ?? null,
      description: (row.description as string | null) ?? null,
      type: row.type as SymbolType,
      primaryConversionFiat: (row.primary_conversion_fiat as string | null) ?? null,
      isActive: row.is_active as boolean,
      fetchConfig: (row.fetch_config as Record<string, unknown> | null) ?? null,
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
    }
  }

  // Derive USD/EUR symbol UUIDs from the already-fetched symbols list.
  const usdSymbolId = allSymbolsRaw.find((s) => s.code === 'USD' && !s.household_id)?.id ?? null
  const eurSymbolId = allSymbolsRaw.find((s) => s.code === 'EUR' && !s.household_id)?.id ?? null

  const allAssetSymbols: AssetSymbol[] = allSymbolsRaw.map(
    (r) => mapAssetSymbol(r as unknown as Record<string, unknown>)
  )

  // Gather all symbol IDs from assets
  const assetList = (assetsRaw ?? []) as unknown as Array<{
    id: string
    household_id: string
    account_id: string
    symbol_id: string
    amount: number
    created_at: string
    updated_at: string
    symbols: Record<string, unknown>
  }>

  const assetSymbolIds = [...new Set(assetList.map((a) => a.symbol_id))]

  // Batch 2: fetch latest rate per symbol using the latest_exchange_rates view.
  // DISTINCT ON (symbol_id) is done at the DB level — no unbounded history transfer.
  const rateMap = new Map<string, { rate: number; fetchedAt: string }>()
  let usdRate: number | null = null
  let eurRate: number | null = null

  if (assetSymbolIds.length > 0) {
    const allSymbolIdsForRates = [
      ...new Set([
        ...assetSymbolIds,
        ...[usdSymbolId, eurSymbolId].filter(Boolean) as string[],
      ]),
    ]

    const { data: rates } = await supabase
      .from('latest_exchange_rates')
      .select('symbol_id, rate, fetched_at')
      .in('symbol_id', allSymbolIdsForRates)

    for (const r of (rates ?? []) as { symbol_id: string; rate: number; fetched_at: string }[]) {
      rateMap.set(r.symbol_id, { rate: Number(r.rate), fetchedAt: r.fetched_at })
      if (r.symbol_id === usdSymbolId) usdRate = Number(r.rate)
      if (r.symbol_id === eurSymbolId) eurRate = Number(r.rate)
    }
  }

  // Compute current value per asset
  function computeValue(symbolId: string, amount: number, primaryConversionFiat: string | null): {
    currentValue: number | null
  } {
    const rateEntry = rateMap.get(symbolId)
    if (!rateEntry) return { currentValue: null }
    const rate = rateEntry.rate
    let valueTry: number
    if (primaryConversionFiat === 'USD') {
      if (!usdRate) return { currentValue: null }
      valueTry = amount * rate * usdRate
    } else if (primaryConversionFiat === 'EUR') {
      if (!eurRate) return { currentValue: null }
      valueTry = amount * rate * eurRate
    } else {
      valueTry = amount * rate
    }
    let currentValue: number
    if (displayCurrency === 'USD') currentValue = usdRate ? valueTry / usdRate : 0
    else if (displayCurrency === 'EUR') currentValue = eurRate ? valueTry / eurRate : 0
    else currentValue = valueTry
    return { currentValue }
  }

  // Build asset map by account_id
  const assetsByAccount = new Map<string, AssetWithRate[]>()
  let latestGlobalFetchedAt: string | null = null

  for (const rawAsset of assetList) {
    const symbolRaw = rawAsset.symbols
    const sym = mapAssetSymbol(symbolRaw)
    const amount = Number(rawAsset.amount)
    const rateEntry = rateMap.get(rawAsset.symbol_id)
    const { currentValue } = computeValue(rawAsset.symbol_id, amount, sym.primaryConversionFiat)

    if (rateEntry?.fetchedAt) {
      if (!latestGlobalFetchedAt || rateEntry.fetchedAt > latestGlobalFetchedAt) {
        latestGlobalFetchedAt = rateEntry.fetchedAt
      }
    }

    const asset: AssetWithRate = {
      id: rawAsset.id,
      householdId: rawAsset.household_id,
      accountId: rawAsset.account_id,
      symbolId: rawAsset.symbol_id,
      amount,
      createdAt: rawAsset.created_at,
      updatedAt: rawAsset.updated_at,
      symbol: sym,
      currentValue,
      lastRate: rateEntry?.rate ?? null,
      rateFetchedAt: rateEntry?.fetchedAt ?? null,
    }
    const bucket = assetsByAccount.get(rawAsset.account_id) ?? []
    bucket.push(asset)
    assetsByAccount.set(rawAsset.account_id, bucket)
  }

  const accounts: AccountRow[] = (accountsRaw ?? []).map((raw) => {
    const r = raw as unknown as Record<string, unknown>
    const profileRaw = r.profiles as Record<string, unknown> | null
    const accountAssets = assetsByAccount.get(r.id as string) ?? []
    const totalValue = accountAssets.reduce((sum, a) => sum + (a.currentValue ?? 0), 0)

    // Find the most recent rate fetched_at for this account's assets
    let accountLatestFetchedAt: string | null = null
    for (const a of accountAssets) {
      if (a.rateFetchedAt && (!accountLatestFetchedAt || a.rateFetchedAt > accountLatestFetchedAt)) {
        accountLatestFetchedAt = a.rateFetchedAt
      }
    }

    return {
      id: r.id as string,
      householdId: r.household_id as string,
      ownerId: r.owner_id as string,
      name: r.name as string,
      institution: (r.institution as string | null) ?? null,
      accountIdentifier: (r.account_identifier as string | null) ?? null,
      ownerName: (profileRaw?.display_name as string | null) ?? (r.owner_id as string),
      assets: accountAssets,
      totalValue,
      latestRateFetchedAt: accountLatestFetchedAt,
    }
  })

  const selectedAccountId = params.account ?? null

  return (
    <AppShell title="Accounts" displayName={displayName}>
      <div
        className="rounded-2xl overflow-hidden -mx-4 md:-mx-6 -my-4 md:-my-6"
        style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}
      >
        <AccountsPageClient
          householdId={householdId}
          currentUserId={user.id}
          role={role}
          accounts={accounts}
          symbols={allAssetSymbols}
          selectedAccountId={selectedAccountId}
          displayCurrency={displayCurrency}
        />
      </div>
    </AppShell>
  )
}
