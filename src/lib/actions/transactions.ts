'use server'

import { revalidatePath } from 'next/cache'
import { createServerClient } from '@/lib/supabase/server'
import type { Transaction, TransactionType, FeeSide, EntryMode, ActionResult } from '@/lib/types/domain'

async function getSessionUser() {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return { supabase, user }
}

function mapTransaction(row: Record<string, unknown>): Transaction {
  return {
    id: row.id as string,
    householdId: row.household_id as string,
    type: row.type as TransactionType,
    date: row.date as string,
    toAssetId: (row.to_asset_id as string | null) ?? null,
    fromAssetId: (row.from_asset_id as string | null) ?? null,
    feeSide: (row.fee_side as FeeSide | null) ?? null,
    toAmount: row.to_amount != null ? Number(row.to_amount) : null,
    fromAmount: row.from_amount != null ? Number(row.from_amount) : null,
    feeAmount: row.fee_amount != null ? Number(row.fee_amount) : null,
    exchangeRate: row.exchange_rate != null ? Number(row.exchange_rate) : null,
    entryMode: (row.entry_mode as EntryMode | null) ?? null,
    notes: (row.notes as string | null) ?? null,
    createdBy: row.created_by as string,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  }
}

export async function createTransaction(
  householdId: string,
  input: {
    type: TransactionType
    date: string
    toAssetId?: string
    fromAssetId?: string
    feeSide?: FeeSide
    toAmount?: number
    fromAmount?: number
    feeAmount?: number
    exchangeRate?: number
    entryMode?: EntryMode
    notes?: string
  }
): Promise<ActionResult<Transaction>> {
  const { supabase, user } = await getSessionUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  const { data: membership } = await supabase
    .from('household_members')
    .select('role')
    .eq('household_id', householdId)
    .eq('user_id', user.id)
    .single()

  if (!membership || !['editor', 'manager'].includes(membership.role)) {
    return { success: false, error: 'Viewers cannot create transactions' }
  }

  // Trade fiat-leg validation: at least one leg must be fiat_currency or stablecoin
  if (input.type === 'trade' && input.toAssetId && input.fromAssetId) {
    const { data: legs } = await supabase
      .from('assets')
      .select('id, symbols(type)')
      .in('id', [input.toAssetId, input.fromAssetId])
      .eq('household_id', householdId)

    const symbolTypes = (legs ?? []).map(
      (a) => ((a.symbols as { type: string }[] | null)?.[0]?.type ?? '')
    )
    const hasFiatLeg = symbolTypes.some(
      (t) => t === 'fiat_currency' || t === 'stablecoin'
    )
    if (!hasFiatLeg) {
      return { success: false, error: 'A trade must have at least one fiat or stablecoin leg' }
    }
  }

  const { data: newId, error: rpcError } = await supabase.rpc('apply_transaction', {
    p_household_id: householdId,
    p_type: input.type,
    p_date: input.date,
    p_to_asset_id: input.toAssetId ?? null,
    p_from_asset_id: input.fromAssetId ?? null,
    p_fee_side: input.feeSide ?? null,
    p_to_amount: input.toAmount ?? null,
    p_from_amount: input.fromAmount ?? null,
    p_fee_amount: input.feeAmount ?? null,
    p_exchange_rate: input.exchangeRate ?? null,
    p_entry_mode: input.entryMode ?? null,
    p_notes: input.notes ?? null,
    p_created_by: user.id,
  })

  if (rpcError || !newId) {
    return { success: false, error: rpcError?.message ?? 'Failed to create transaction' }
  }

  const { data: row, error: fetchError } = await supabase
    .from('transactions')
    .select('*')
    .eq('id', newId)
    .single()

  if (fetchError || !row) {
    return { success: false, error: fetchError?.message ?? 'Transaction created but could not be fetched' }
  }

  revalidatePath('/transactions')
  revalidatePath('/accounts')
  return { success: true, data: mapTransaction(row as unknown as Record<string, unknown>) }
}

export async function updateTransaction(
  transactionId: string,
  input: Partial<{
    date: string
    toAmount: number
    fromAmount: number
    feeAmount: number
    exchangeRate: number
    notes: string
  }>
): Promise<ActionResult<Transaction>> {
  const { supabase, user } = await getSessionUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  const { data: txRow } = await supabase
    .from('transactions')
    .select('household_id, date, to_amount, from_amount, fee_amount, fee_side, exchange_rate, notes')
    .eq('id', transactionId)
    .single()

  if (!txRow) return { success: false, error: 'Transaction not found' }

  const { data: membership } = await supabase
    .from('household_members')
    .select('role')
    .eq('household_id', txRow.household_id)
    .eq('user_id', user.id)
    .single()

  if (!membership || !['editor', 'manager'].includes(membership.role)) {
    return { success: false, error: 'Viewers cannot update transactions' }
  }

  const r = txRow as unknown as Record<string, unknown>
  const { error: rpcError } = await supabase.rpc('update_transaction', {
    p_transaction_id: transactionId,
    p_date: input.date ?? (r.date as string),
    p_to_amount: input.toAmount !== undefined ? input.toAmount : (r.to_amount != null ? Number(r.to_amount) : null),
    p_from_amount: input.fromAmount !== undefined ? input.fromAmount : (r.from_amount != null ? Number(r.from_amount) : null),
    p_fee_amount: input.feeAmount !== undefined ? input.feeAmount : (r.fee_amount != null ? Number(r.fee_amount) : null),
    p_exchange_rate: input.exchangeRate !== undefined ? input.exchangeRate : (r.exchange_rate != null ? Number(r.exchange_rate) : null),
    p_notes: input.notes !== undefined ? input.notes : ((r.notes as string | null) ?? null),
  })

  if (rpcError) return { success: false, error: rpcError.message }

  const { data: updated, error: fetchError } = await supabase
    .from('transactions')
    .select('*')
    .eq('id', transactionId)
    .single()

  if (fetchError || !updated) {
    return { success: false, error: fetchError?.message ?? 'Transaction updated but could not be fetched' }
  }

  revalidatePath('/transactions')
  revalidatePath('/accounts')
  return { success: true, data: mapTransaction(updated as unknown as Record<string, unknown>) }
}

export async function deleteTransaction(transactionId: string): Promise<ActionResult> {
  const { supabase, user } = await getSessionUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  const { data: txRow } = await supabase
    .from('transactions')
    .select('household_id')
    .eq('id', transactionId)
    .single()

  if (!txRow) return { success: false, error: 'Transaction not found' }

  const { data: membership } = await supabase
    .from('household_members')
    .select('role')
    .eq('household_id', (txRow as unknown as Record<string, unknown>).household_id as string)
    .eq('user_id', user.id)
    .single()

  if (!membership || !['editor', 'manager'].includes(membership.role)) {
    return { success: false, error: 'Viewers cannot delete transactions' }
  }

  const { error: rpcError } = await supabase.rpc('reverse_and_delete_transaction', {
    p_transaction_id: transactionId,
  })

  if (rpcError) return { success: false, error: rpcError.message }

  revalidatePath('/transactions')
  revalidatePath('/accounts')
  return { success: true, data: undefined }
}
