'use server'

import { revalidatePath } from 'next/cache'
import { createServerClient } from '@/lib/supabase/server'
import type { Account, ActionResult } from '@/lib/types/domain'

async function getSessionUser() {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return { supabase, user }
}

function mapAccount(row: Record<string, unknown>): Account {
  return {
    id: row.id as string,
    householdId: row.household_id as string,
    ownerId: row.owner_id as string,
    name: row.name as string,
    institution: (row.institution as string | null) ?? null,
    accountIdentifier: (row.account_identifier as string | null) ?? null,
    defaultSymbolId: (row.default_symbol_id as string | null) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  }
}

export async function createAccount(
  householdId: string,
  input: {
    name: string
    institution?: string
    accountIdentifier?: string
    defaultSymbolId?: string
  }
): Promise<ActionResult<Account>> {
  const { supabase, user } = await getSessionUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  const { data: membership } = await supabase
    .from('household_members')
    .select('role')
    .eq('household_id', householdId)
    .eq('user_id', user.id)
    .single()

  if (!membership || !['editor', 'manager'].includes(membership.role)) {
    return { success: false, error: 'Viewers cannot create accounts' }
  }

  const { data, error } = await supabase
    .from('accounts')
    .insert({
      household_id: householdId,
      owner_id: user.id,
      name: input.name.trim(),
      institution: input.institution?.trim() ?? null,
      account_identifier: input.accountIdentifier?.trim() ?? null,
      default_symbol_id: input.defaultSymbolId ?? null,
    })
    .select()
    .single()

  if (error || !data) return { success: false, error: error?.message ?? 'Failed to create account' }

  revalidatePath('/accounts')
  return { success: true, data: mapAccount(data as unknown as Record<string, unknown>) }
}

export async function updateAccount(
  accountId: string,
  input: {
    name?: string
    institution?: string
    accountIdentifier?: string
    defaultSymbolId?: string
    ownerId?: string
  }
): Promise<ActionResult<Account>> {
  const { supabase, user } = await getSessionUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  const { data: account } = await supabase
    .from('accounts')
    .select('household_id, owner_id')
    .eq('id', accountId)
    .single()

  if (!account) return { success: false, error: 'Account not found' }

  const { data: membership } = await supabase
    .from('household_members')
    .select('role')
    .eq('household_id', account.household_id)
    .eq('user_id', user.id)
    .single()

  if (!membership) return { success: false, error: 'Not a household member' }

  const isManager = membership.role === 'manager'
  const isEditor = membership.role === 'editor'
  const isOwner = account.owner_id === user.id

  if (!isManager && !(isEditor && isOwner)) {
    return { success: false, error: 'You can only edit your own accounts' }
  }

  // Only managers can reassign ownership
  if (input.ownerId !== undefined && !isManager) {
    return { success: false, error: 'Only managers can reassign account ownership' }
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (input.name !== undefined) updates.name = input.name.trim()
  if (input.institution !== undefined) updates.institution = input.institution.trim() || null
  if (input.accountIdentifier !== undefined) updates.account_identifier = input.accountIdentifier.trim() || null
  if (input.defaultSymbolId !== undefined) updates.default_symbol_id = input.defaultSymbolId || null
  if (input.ownerId !== undefined) updates.owner_id = input.ownerId

  const { data, error } = await supabase
    .from('accounts')
    .update(updates)
    .eq('id', accountId)
    .select()
    .single()

  if (error || !data) return { success: false, error: error?.message ?? 'Failed to update account' }

  revalidatePath('/accounts')
  return { success: true, data: mapAccount(data as unknown as Record<string, unknown>) }
}

export async function deleteAccount(accountId: string): Promise<ActionResult> {
  const { supabase, user } = await getSessionUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  const { data: account } = await supabase
    .from('accounts')
    .select('household_id, owner_id')
    .eq('id', accountId)
    .single()

  if (!account) return { success: false, error: 'Account not found' }

  const { data: membership } = await supabase
    .from('household_members')
    .select('role')
    .eq('household_id', account.household_id)
    .eq('user_id', user.id)
    .single()

  if (!membership) return { success: false, error: 'Not a household member' }

  const isManager = membership.role === 'manager'
  const isEditor = membership.role === 'editor'
  const isOwner = account.owner_id === user.id

  if (!isManager && !(isEditor && isOwner)) {
    return { success: false, error: 'You can only delete your own accounts' }
  }

  const { error } = await supabase.from('accounts').delete().eq('id', accountId)

  if (error) return { success: false, error: error.message }

  revalidatePath('/accounts')
  return { success: true, data: undefined }
}
