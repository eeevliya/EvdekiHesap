import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { TransactionForm } from './transaction-form'
import type { SymbolType } from '@/lib/types/domain'
import type { AssetRef } from '../page'

export default async function NewTransactionPage() {
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
  if (membership.role === 'viewer') redirect('/transactions')

  const householdId = membership.household_id

  const { data: assetsRaw } = await supabase
    .from('assets')
    .select('id, symbol_id, account_id, symbols(id, code, name, type), accounts(id, name)')
    .eq('household_id', householdId)
    .order('account_id')

  const assetOptions: AssetRef[] = (assetsRaw ?? []).map((raw) => {
    const r = raw as unknown as Record<string, unknown>
    const sym = r.symbols as Record<string, unknown>
    const acc = r.accounts as Record<string, unknown>
    return {
      assetId: r.id as string,
      symbolId: r.symbol_id as string,
      symbolCode: sym?.code as string ?? '',
      symbolName: (sym?.name as string | null) ?? null,
      accountId: r.account_id as string,
      accountName: acc?.name as string ?? '',
    }
  })

  return (
    <div className="max-w-lg mx-auto p-4 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">New Transaction</h1>
        <p className="text-sm text-muted-foreground">
          Record a deposit, debit, transfer, interest, or trade.
        </p>
      </div>

      <TransactionForm
        householdId={householdId}
        assetOptions={assetOptions}
      />
    </div>
  )
}
