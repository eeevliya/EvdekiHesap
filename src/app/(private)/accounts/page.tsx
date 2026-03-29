import { redirect } from 'next/navigation'
import { createServerClient, createServiceRoleClient } from '@/lib/supabase/server'
import { AccountsManager } from './accounts-manager'
import type { Account, Asset, Symbol, SymbolType } from '@/lib/types/domain'

interface AccountRow extends Account {
  ownerName: string
  assets: (Asset & { symbol: Symbol })[]
}

export default async function AccountsPage() {
  const supabase = await createServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: membership } = await supabase
    .from('household_members')
    .select('household_id, role')
    .eq('user_id', user.id)
    .order('joined_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (!membership) redirect('/onboarding')

  const householdId = membership.household_id
  const role = membership.role as 'manager' | 'editor' | 'viewer'

  // Use service role to join profiles (RLS restricts profile reads to own row)
  const serviceClient = createServiceRoleClient()

  // Fetch accounts with owner profile
  const { data: accountsRaw } = await serviceClient
    .from('accounts')
    .select('*, profiles(display_name)')
    .eq('household_id', householdId)
    .order('created_at', { ascending: true })

  // Fetch assets with their symbols for this household
  const { data: assetsRaw } = await supabase
    .from('assets')
    .select('*, symbols(*)')
    .eq('household_id', householdId)

  // Fetch all symbols available (global + household)
  const { data: globalSymbolsRaw } = await supabase
    .from('symbols')
    .select('*')
    .is('household_id', null)
    .order('code')

  const { data: householdSymbolsRaw } = await supabase
    .from('symbols')
    .select('*')
    .eq('household_id', householdId)
    .order('code')

  function mapSymbol(row: Record<string, unknown>): Symbol {
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

  const allSymbols: Symbol[] = [
    ...(globalSymbolsRaw ?? []).map((r) => mapSymbol(r as unknown as Record<string, unknown>)),
    ...(householdSymbolsRaw ?? []).map((r) => mapSymbol(r as unknown as Record<string, unknown>)),
  ]

  // Build asset map by account_id
  const assetsByAccount = new Map<string, (Asset & { symbol: Symbol })[]>()
  for (const rawAsset of assetsRaw ?? []) {
    const r = rawAsset as unknown as Record<string, unknown>
    const symbolRaw = r.symbols as Record<string, unknown>
    const asset: Asset & { symbol: Symbol } = {
      id: r.id as string,
      householdId: r.household_id as string,
      accountId: r.account_id as string,
      symbolId: r.symbol_id as string,
      amount: Number(r.amount),
      createdAt: r.created_at as string,
      updatedAt: r.updated_at as string,
      symbol: mapSymbol(symbolRaw),
    }
    const bucket = assetsByAccount.get(asset.accountId) ?? []
    bucket.push(asset)
    assetsByAccount.set(asset.accountId, bucket)
  }

  const accounts: AccountRow[] = (accountsRaw ?? []).map((raw) => {
    const r = raw as unknown as Record<string, unknown>
    const profileRaw = r.profiles as Record<string, unknown> | null
    return {
      id: r.id as string,
      householdId: r.household_id as string,
      ownerId: r.owner_id as string,
      name: r.name as string,
      institution: (r.institution as string | null) ?? null,
      accountIdentifier: (r.account_identifier as string | null) ?? null,
      defaultSymbolId: (r.default_symbol_id as string | null) ?? null,
      createdAt: r.created_at as string,
      updatedAt: r.updated_at as string,
      ownerName: profileRaw?.display_name as string ?? (r.owner_id as string),
      assets: assetsByAccount.get(r.id as string) ?? [],
    }
  })

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Accounts</h1>
        <p className="text-sm text-muted-foreground">
          Manage your portfolio accounts and their assets.
        </p>
      </div>

      <AccountsManager
        householdId={householdId}
        currentUserId={user.id}
        role={role}
        accounts={accounts}
        symbols={allSymbols}
      />
    </div>
  )
}
