'use server'

import { revalidatePath } from 'next/cache'
import { createServerClient } from '@/lib/supabase/server'
import type { ActionResult, AssetSymbol, AssetSymbolType } from '@/lib/types/domain'

async function getSessionUser() {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return { supabase, user }
}

export async function createAssetSymbol(
  householdId: string,
  input: {
    code: string
    name?: string
    description?: string
    type: AssetSymbolType
    primaryConversionFiat?: string
    fetchConfig?: Record<string, unknown>
  }
): Promise<ActionResult<AssetSymbol>> {
  const { supabase, user } = await getSessionUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  const { data: membership } = await supabase
    .from('household_members')
    .select('role')
    .eq('household_id', householdId)
    .eq('user_id', user.id)
    .single()

  if (!membership || membership.role !== 'manager') {
    return { success: false, error: 'Only managers can create custom symbols' }
  }

  const { data, error } = await supabase
    .from('symbols')
    .insert({
      household_id: householdId,
      code: input.code.trim().toUpperCase(),
      name: input.name?.trim() ?? null,
      description: input.description?.trim() ?? null,
      type: input.type,
      primary_conversion_fiat: input.primaryConversionFiat?.trim() ?? null,
      fetch_config: input.fetchConfig ?? null,
      is_active: true,
    })
    .select()
    .single()

  if (error || !data) return { success: false, error: error?.message ?? 'Failed to create symbol' }

  revalidatePath('/settings/symbols')
  return {
    success: true,
    data: {
      id: data.id,
      householdId: data.household_id,
      code: data.code,
      name: data.name,
      description: data.description,
      type: data.type as AssetSymbolType,
      primaryConversionFiat: data.primary_conversion_fiat,
      isActive: data.is_active,
      fetchConfig: data.fetch_config as Record<string, unknown> | null,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    },
  }
}

export async function updateAssetSymbol(
  symbolId: string,
  input: Partial<Pick<AssetSymbol, 'name' | 'description' | 'isActive' | 'fetchConfig'>>
): Promise<ActionResult<AssetSymbol>> {
  const { supabase, user } = await getSessionUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  // Fetch symbol to get household_id for the role check
  const { data: symbol } = await supabase
    .from('symbols')
    .select('household_id')
    .eq('id', symbolId)
    .single()

  if (!symbol) return { success: false, error: 'AssetSymbol not found' }
  if (!symbol.household_id) return { success: false, error: 'Global symbols cannot be modified' }

  const { data: membership } = await supabase
    .from('household_members')
    .select('role')
    .eq('household_id', symbol.household_id)
    .eq('user_id', user.id)
    .single()

  if (!membership || membership.role !== 'manager') {
    return { success: false, error: 'Only managers can update symbols' }
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (input.name !== undefined) updates.name = input.name?.trim() ?? null
  if (input.description !== undefined) updates.description = input.description?.trim() ?? null
  if (input.isActive !== undefined) updates.is_active = input.isActive
  if (input.fetchConfig !== undefined) updates.fetch_config = input.fetchConfig

  const { data, error } = await supabase
    .from('symbols')
    .update(updates)
    .eq('id', symbolId)
    .select()
    .single()

  if (error || !data) return { success: false, error: error?.message ?? 'Failed to update symbol' }

  revalidatePath('/settings/symbols')
  return {
    success: true,
    data: {
      id: data.id,
      householdId: data.household_id,
      code: data.code,
      name: data.name,
      description: data.description,
      type: data.type as AssetSymbolType,
      primaryConversionFiat: data.primary_conversion_fiat,
      isActive: data.is_active,
      fetchConfig: data.fetch_config as Record<string, unknown> | null,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    },
  }
}

export async function deleteAssetSymbol(symbolId: string): Promise<ActionResult> {
  const { supabase, user } = await getSessionUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  const { data: symbol } = await supabase
    .from('symbols')
    .select('household_id')
    .eq('id', symbolId)
    .single()

  if (!symbol) return { success: false, error: 'AssetSymbol not found' }
  if (!symbol.household_id) return { success: false, error: 'Global symbols cannot be deleted' }

  const { data: membership } = await supabase
    .from('household_members')
    .select('role')
    .eq('household_id', symbol.household_id)
    .eq('user_id', user.id)
    .single()

  if (!membership || membership.role !== 'manager') {
    return { success: false, error: 'Only managers can delete symbols' }
  }

  const { error } = await supabase.from('symbols').delete().eq('id', symbolId)

  if (error) return { success: false, error: error.message }

  revalidatePath('/settings/symbols')
  return { success: true, data: undefined }
}
