import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { SymbolsManager } from './symbols-manager'
import type { Symbol, SymbolType } from '@/lib/types/domain'

export default async function SymbolsSettingsPage() {
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

  // Fetch global symbols (household_id is null)
  const { data: globalRaw } = await supabase
    .from('symbols')
    .select('*')
    .is('household_id', null)
    .order('code')

  // Fetch household-custom symbols
  const { data: householdRaw } = await supabase
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

  const globalSymbols = (globalRaw ?? []).map((r) => mapSymbol(r as unknown as Record<string, unknown>))
  const householdSymbols = (householdRaw ?? []).map((r) => mapSymbol(r as unknown as Record<string, unknown>))

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Symbols</h1>
        <p className="text-sm text-muted-foreground">
          Manage the symbols tracked in your household portfolio.
        </p>
      </div>

      <SymbolsManager
        householdId={householdId}
        isManager={isManager}
        globalSymbols={globalSymbols}
        householdSymbols={householdSymbols}
      />
    </div>
  )
}
