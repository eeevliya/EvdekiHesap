'use server'

import { revalidatePath } from 'next/cache'
import { createServerClient } from '@/lib/supabase/server'
import type { Asset, ActionResult } from '@/lib/types/domain'

async function getSessionUser() {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return { supabase, user }
}

function mapAsset(row: Record<string, unknown>): Asset {
  return {
    id: row.id as string,
    householdId: row.household_id as string,
    accountId: row.account_id as string,
    symbolId: row.symbol_id as string,
    amount: Number(row.amount),
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  }
}

export async function createAsset(
  householdId: string,
  input: {
    accountId: string
    symbolId: string
    amount?: number
  }
): Promise<ActionResult<Asset>> {
  const { supabase, user } = await getSessionUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  const { data: membership } = await supabase
    .from('household_members')
    .select('role')
    .eq('household_id', householdId)
    .eq('user_id', user.id)
    .single()

  if (!membership || !['editor', 'manager'].includes(membership.role)) {
    return { success: false, error: 'Viewers cannot add assets' }
  }

  // Verify the account belongs to this household
  const { data: account } = await supabase
    .from('accounts')
    .select('id')
    .eq('id', input.accountId)
    .eq('household_id', householdId)
    .single()

  if (!account) return { success: false, error: 'Account not found in this household' }

  const { data, error } = await supabase
    .from('assets')
    .insert({
      household_id: householdId,
      account_id: input.accountId,
      symbol_id: input.symbolId,
      amount: input.amount ?? 0,
    })
    .select()
    .single()

  if (error || !data) return { success: false, error: error?.message ?? 'Failed to create asset' }

  revalidatePath('/accounts')
  return { success: true, data: mapAsset(data as unknown as Record<string, unknown>) }
}

export async function updateAssetAmount(
  assetId: string,
  amount: number
): Promise<ActionResult<Asset>> {
  const { supabase, user } = await getSessionUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  if (amount < 0) return { success: false, error: 'Amount cannot be negative' }

  const { data: asset } = await supabase
    .from('assets')
    .select('household_id')
    .eq('id', assetId)
    .single()

  if (!asset) return { success: false, error: 'Asset not found' }

  const { data: membership } = await supabase
    .from('household_members')
    .select('role')
    .eq('household_id', asset.household_id)
    .eq('user_id', user.id)
    .single()

  if (!membership || !['editor', 'manager'].includes(membership.role)) {
    return { success: false, error: 'Viewers cannot update assets' }
  }

  const { data, error } = await supabase
    .from('assets')
    .update({ amount, updated_at: new Date().toISOString() })
    .eq('id', assetId)
    .select()
    .single()

  if (error || !data) return { success: false, error: error?.message ?? 'Failed to update asset' }

  revalidatePath('/accounts')
  return { success: true, data: mapAsset(data as unknown as Record<string, unknown>) }
}

export async function deleteAsset(assetId: string): Promise<ActionResult> {
  const { supabase, user } = await getSessionUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  const { data: asset } = await supabase
    .from('assets')
    .select('household_id')
    .eq('id', assetId)
    .single()

  if (!asset) return { success: false, error: 'Asset not found' }

  const { data: membership } = await supabase
    .from('household_members')
    .select('role')
    .eq('household_id', asset.household_id)
    .eq('user_id', user.id)
    .single()

  if (!membership || !['editor', 'manager'].includes(membership.role)) {
    return { success: false, error: 'Viewers cannot delete assets' }
  }

  const { error } = await supabase.from('assets').delete().eq('id', assetId)

  if (error) return { success: false, error: error.message }

  revalidatePath('/accounts')
  return { success: true, data: undefined }
}
