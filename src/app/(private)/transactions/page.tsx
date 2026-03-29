import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createServerClient } from '@/lib/supabase/server'
import { TransactionList } from './transaction-list'
import type { Transaction, TransactionType, SymbolType } from '@/lib/types/domain'

export interface AssetRef {
  assetId: string
  symbolId: string
  symbolCode: string
  symbolName: string | null
  accountId: string
  accountName: string
}

export interface TransactionRow extends Omit<Transaction, 'toAsset' | 'fromAsset' | 'feeAsset'> {
  toAsset?: AssetRef
  fromAsset?: AssetRef
  feeAsset?: AssetRef
}

function toAssetRef(raw: Record<string, unknown> | null | undefined): AssetRef | undefined {
  if (!raw) return undefined
  const symbol = raw.symbols as Record<string, unknown> | null
  const account = raw.accounts as Record<string, unknown> | null
  return {
    assetId: raw.id as string,
    symbolId: raw.symbol_id as string,
    symbolCode: symbol?.code as string ?? '',
    symbolName: (symbol?.name as string | null) ?? null,
    accountId: raw.account_id as string,
    accountName: account?.name as string ?? '',
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
    .select('household_id, role')
    .eq('user_id', user.id)
    .order('joined_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (!membership) redirect('/onboarding')

  const householdId = membership.household_id
  const role = membership.role as 'manager' | 'editor' | 'viewer'

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
      ),
      fee_asset:assets!transactions_fee_asset_id_fkey(
        id, symbol_id, account_id,
        symbols(id, code, name, type),
        accounts(id, name)
      )
    `)
    .eq('household_id', householdId)
    .order('date', { ascending: false })
    .limit(500)

  // Fetch all accounts + assets for edit fee_asset picker
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
      symbolCode: sym?.code as string ?? '',
      symbolName: (sym?.name as string | null) ?? null,
      accountId: r.account_id as string,
      accountName: acc?.name as string ?? '',
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
      feeAssetId: (r.fee_asset_id as string | null) ?? null,
      toAmount: r.to_amount != null ? Number(r.to_amount) : null,
      fromAmount: r.from_amount != null ? Number(r.from_amount) : null,
      feeAmount: r.fee_amount != null ? Number(r.fee_amount) : null,
      exchangeRate: r.exchange_rate != null ? Number(r.exchange_rate) : null,
      notes: (r.notes as string | null) ?? null,
      createdBy: r.created_by as string,
      createdAt: r.created_at as string,
      updatedAt: r.updated_at as string,
      toAsset: toAssetRef(r.to_asset as Record<string, unknown> | null),
      fromAsset: toAssetRef(r.from_asset as Record<string, unknown> | null),
      feeAsset: toAssetRef(r.fee_asset as Record<string, unknown> | null),
    }
  })

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Transactions</h1>
          <p className="text-sm text-muted-foreground">
            All recorded deposits, debits, transfers, and trades.
          </p>
        </div>
        {role !== 'viewer' && (
          <Link
            href="/transactions/new"
            className="inline-flex items-center justify-center rounded-md text-sm font-medium h-9 px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Add transaction
          </Link>
        )}
      </div>

      <TransactionList
        transactions={transactions}
        assetOptions={assetOptions}
        role={role}
      />
    </div>
  )
}
