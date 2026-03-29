import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { TransactionForm } from './transaction-form'
import type { TransactionType, FeeSide, EntryMode } from '@/lib/types/domain'
import type { AssetRef } from '../page'
import type { InitialValues } from './transaction-form'

export default async function NewTransactionPage({
  searchParams,
}: {
  searchParams: Promise<{ copy?: string }>
}) {
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
      symbolCode: (sym?.code as string) ?? '',
      symbolName: (sym?.name as string | null) ?? null,
      accountId: r.account_id as string,
      accountName: (acc?.name as string) ?? '',
    }
  })

  // Duplicate: pre-fill form from source transaction
  const params = await searchParams
  let initialValues: InitialValues | undefined
  if (params.copy) {
    const { data: src } = await supabase
      .from('transactions')
      .select('*')
      .eq('id', params.copy)
      .eq('household_id', householdId)
      .maybeSingle()

    if (src) {
      const r = src as unknown as Record<string, unknown>
      initialValues = {
        type: r.type as TransactionType,
        date: (r.date as string).slice(0, 16),
        toAssetId: (r.to_asset_id as string | null) ?? '',
        fromAssetId: (r.from_asset_id as string | null) ?? '',
        toAmount: r.to_amount != null ? String(Number(r.to_amount)) : '',
        fromAmount: r.from_amount != null ? String(Number(r.from_amount)) : '',
        feeAmount: r.fee_amount != null ? String(Number(r.fee_amount)) : '',
        feeSide: (r.fee_side as FeeSide | null) ?? null,
        exchangeRate: r.exchange_rate != null ? String(Number(r.exchange_rate)) : '',
        entryMode: (r.entry_mode as EntryMode | null) ?? null,
        notes: (r.notes as string | null) ?? '',
      }
    }
  }

  return (
    <div className="max-w-lg mx-auto p-4 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">
          {initialValues ? 'Duplicate Transaction' : 'New Transaction'}
        </h1>
        <p className="text-sm text-muted-foreground">
          {initialValues
            ? 'Pre-filled from source transaction. Review and save.'
            : 'Record a deposit, debit, transfer, interest, or trade.'}
        </p>
      </div>

      <TransactionForm
        householdId={householdId}
        assetOptions={assetOptions}
        initialValues={initialValues}
      />
    </div>
  )
}
