import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { AppShell } from '@/components/shared/app-shell'
import { AssetSymbolsManager } from '@/app/(private)/settings/symbols/symbols-manager'
import type { AssetSymbol, AssetSymbolType } from '@/lib/types/domain'

export const dynamic = 'force-dynamic'

export default async function RatesAssetSymbolsPage() {
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
  const isManager = membership.role === 'manager'

  if (!isManager) redirect('/rates')

  // Display name for AppShell
  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('id', user.id)
    .maybeSingle()
  const displayName = profile?.display_name ?? user.email?.split('@')[0] ?? 'User'

  const { data: globalRaw } = await supabase
    .from('symbols')
    .select('*')
    .is('household_id', null)
    .order('code')

  const { data: householdRaw } = await supabase
    .from('symbols')
    .select('*')
    .eq('household_id', householdId)
    .order('code')

  function mapAssetSymbol(row: Record<string, unknown>): AssetSymbol {
    return {
      id: row.id as string,
      householdId: (row.household_id as string | null) ?? null,
      code: row.code as string,
      name: (row.name as string | null) ?? null,
      description: (row.description as string | null) ?? null,
      type: row.type as AssetSymbolType,
      primaryConversionFiat: (row.primary_conversion_fiat as string | null) ?? null,
      isActive: row.is_active as boolean,
      fetchConfig: (row.fetch_config as Record<string, unknown> | null) ?? null,
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
    }
  }

  const globalAssetSymbols = (globalRaw ?? []).map((r) => mapAssetSymbol(r as unknown as Record<string, unknown>))
  const householdAssetSymbols = (householdRaw ?? []).map((r) => mapAssetSymbol(r as unknown as Record<string, unknown>))
  const fiatAssetSymbols = [...globalAssetSymbols, ...householdAssetSymbols].filter(
    (s) => s.type === 'fiat_currency' && s.isActive
  )

  return (
    <AppShell title="Manage AssetSymbols" displayName={displayName}>
      <div className="max-w-2xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--color-fg-primary)' }}>
            AssetSymbols
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-fg-secondary)' }}>
            Manage the symbols tracked in your household portfolio.
          </p>
        </div>

        <AssetSymbolsManager
          householdId={householdId}
          isManager={isManager}
          globalAssetSymbols={globalAssetSymbols}
          householdAssetSymbols={householdAssetSymbols}
          fiatAssetSymbols={fiatAssetSymbols}
        />
      </div>
    </AppShell>
  )
}
