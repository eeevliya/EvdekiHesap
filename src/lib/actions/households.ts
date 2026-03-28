'use server'

import { randomBytes } from 'crypto'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import type { ActionResult, DisplayCurrency, HouseholdInvite, Role } from '@/lib/types/domain'

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function getSessionUser() {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return { supabase, user }
}

// ─── Household settings ───────────────────────────────────────────────────────

export async function updateHousehold(
  householdId: string,
  input: { name?: string; displayCurrency?: DisplayCurrency }
): Promise<ActionResult> {
  const { supabase, user } = await getSessionUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  const { data: membership } = await supabase
    .from('household_members')
    .select('role')
    .eq('household_id', householdId)
    .eq('user_id', user.id)
    .single()

  if (!membership || membership.role !== 'manager') {
    return { success: false, error: 'Only managers can update household settings' }
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (input.name !== undefined) updates.name = input.name.trim()
  if (input.displayCurrency !== undefined) updates.display_currency = input.displayCurrency

  const { error } = await supabase.from('households').update(updates).eq('id', householdId)

  if (error) return { success: false, error: error.message }

  revalidatePath('/settings/household')
  return { success: true, data: undefined }
}

export async function deleteHousehold(householdId: string): Promise<ActionResult> {
  const { supabase, user } = await getSessionUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  const { data: membership } = await supabase
    .from('household_members')
    .select('role')
    .eq('household_id', householdId)
    .eq('user_id', user.id)
    .single()

  if (!membership || membership.role !== 'manager') {
    return { success: false, error: 'Only managers can delete a household' }
  }

  const { error } = await supabase.from('households').delete().eq('id', householdId)

  if (error) return { success: false, error: error.message }

  redirect('/onboarding')
}

// ─── Invites ─────────────────────────────────────────────────────────────────

export async function createInvite(
  householdId: string,
  input: {
    role: 'editor' | 'viewer'
    expiresAt?: string
    maxUses?: number
  }
): Promise<ActionResult<HouseholdInvite>> {
  const { supabase, user } = await getSessionUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  const { data: membership } = await supabase
    .from('household_members')
    .select('role')
    .eq('household_id', householdId)
    .eq('user_id', user.id)
    .single()

  if (!membership || membership.role !== 'manager') {
    return { success: false, error: 'Only managers can create invite links' }
  }

  const code = randomBytes(16).toString('hex')

  const { data: invite, error } = await supabase
    .from('household_invites')
    .insert({
      household_id: householdId,
      code,
      role: input.role,
      created_by: user.id,
      expires_at: input.expiresAt ?? null,
      max_uses: input.maxUses ?? null,
    })
    .select()
    .single()

  if (error || !invite) return { success: false, error: error?.message ?? 'Failed to create invite' }

  revalidatePath('/settings/members')
  return {
    success: true,
    data: {
      id: invite.id,
      householdId: invite.household_id,
      code: invite.code,
      role: invite.role as 'editor' | 'viewer',
      createdBy: invite.created_by,
      expiresAt: invite.expires_at,
      maxUses: invite.max_uses,
      useCount: invite.use_count,
      createdAt: invite.created_at,
    },
  }
}

export async function revokeInvite(inviteId: string): Promise<ActionResult> {
  const { supabase, user } = await getSessionUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  // Look up the invite to get household_id for the role check
  const { data: invite } = await supabase
    .from('household_invites')
    .select('household_id')
    .eq('id', inviteId)
    .single()

  if (!invite) return { success: false, error: 'Invite not found' }

  const { data: membership } = await supabase
    .from('household_members')
    .select('role')
    .eq('household_id', invite.household_id)
    .eq('user_id', user.id)
    .single()

  if (!membership || membership.role !== 'manager') {
    return { success: false, error: 'Only managers can revoke invites' }
  }

  const { error } = await supabase.from('household_invites').delete().eq('id', inviteId)

  if (error) return { success: false, error: error.message }

  revalidatePath('/settings/members')
  return { success: true, data: undefined }
}

export async function acceptInvite(code: string): Promise<ActionResult<{ householdId: string }>> {
  const { supabase, user } = await getSessionUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  const { data: invite } = await supabase
    .from('household_invites')
    .select('*')
    .eq('code', code)
    .single()

  if (!invite) return { success: false, error: 'Invite not found or already used' }

  // Validate expiry
  if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
    return { success: false, error: 'This invite link has expired' }
  }

  // Validate max uses
  if (invite.max_uses !== null && invite.use_count >= invite.max_uses) {
    return { success: false, error: 'This invite link has reached its maximum number of uses' }
  }

  // Check if user is already a member
  const { data: existing } = await supabase
    .from('household_members')
    .select('id')
    .eq('household_id', invite.household_id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (existing) {
    // Already a member — redirect to dashboard
    redirect('/dashboard')
  }

  // Insert member
  const { error: memberError } = await supabase.from('household_members').insert({
    household_id: invite.household_id,
    user_id: user.id,
    role: invite.role,
  })

  if (memberError) return { success: false, error: memberError.message }

  // Increment use_count
  await supabase
    .from('household_invites')
    .update({ use_count: invite.use_count + 1 })
    .eq('id', invite.id)

  redirect('/dashboard')
}

// ─── Member management ────────────────────────────────────────────────────────

export async function updateMemberRole(memberId: string, role: Role): Promise<ActionResult> {
  const { supabase, user } = await getSessionUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  // Look up the target member to get household_id
  const { data: targetMember } = await supabase
    .from('household_members')
    .select('household_id, user_id')
    .eq('id', memberId)
    .single()

  if (!targetMember) return { success: false, error: 'Member not found' }

  // Prevent changing your own role
  if (targetMember.user_id === user.id) {
    return { success: false, error: 'You cannot change your own role' }
  }

  const { data: callerMembership } = await supabase
    .from('household_members')
    .select('role')
    .eq('household_id', targetMember.household_id)
    .eq('user_id', user.id)
    .single()

  if (!callerMembership || callerMembership.role !== 'manager') {
    return { success: false, error: 'Only managers can change member roles' }
  }

  const { error } = await supabase
    .from('household_members')
    .update({ role })
    .eq('id', memberId)

  if (error) return { success: false, error: error.message }

  revalidatePath('/settings/members')
  return { success: true, data: undefined }
}

export async function removeMember(memberId: string): Promise<ActionResult> {
  const { supabase, user } = await getSessionUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  const { data: targetMember } = await supabase
    .from('household_members')
    .select('household_id, user_id')
    .eq('id', memberId)
    .single()

  if (!targetMember) return { success: false, error: 'Member not found' }

  // Prevent removing yourself
  if (targetMember.user_id === user.id) {
    return { success: false, error: 'You cannot remove yourself from the household' }
  }

  const { data: callerMembership } = await supabase
    .from('household_members')
    .select('role')
    .eq('household_id', targetMember.household_id)
    .eq('user_id', user.id)
    .single()

  if (!callerMembership || callerMembership.role !== 'manager') {
    return { success: false, error: 'Only managers can remove members' }
  }

  const { error } = await supabase.from('household_members').delete().eq('id', memberId)

  if (error) return { success: false, error: error.message }

  revalidatePath('/settings/members')
  return { success: true, data: undefined }
}
