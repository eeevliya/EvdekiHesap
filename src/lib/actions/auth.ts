'use server'

import { redirect } from 'next/navigation'
import { createServerClient, createServiceRoleClient } from '@/lib/supabase/server'
import type { DisplayCurrency } from '@/lib/types/domain'

// ─── Helper: accept an invite for a known user id ────────────────────────────
// Shared by signIn and signUp so invite acceptance is never skipped.
async function acceptInviteForUser(userId: string, code: string): Promise<string | null> {
  const serviceClient = createServiceRoleClient()

  const { data: invite } = await serviceClient
    .from('household_invites')
    .select('*')
    .eq('code', code)
    .single()

  if (!invite) return 'Invite not found or already used'

  if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
    return 'This invite link has expired'
  }

  if (invite.max_uses !== null && invite.use_count >= invite.max_uses) {
    return 'This invite link has reached its maximum number of uses'
  }

  // Check if already a member (idempotent — just redirect)
  const { data: existing } = await serviceClient
    .from('household_members')
    .select('id')
    .eq('household_id', invite.household_id)
    .eq('user_id', userId)
    .maybeSingle()

  if (existing) return null // already a member — treat as success

  const { error: memberError } = await serviceClient.from('household_members').insert({
    household_id: invite.household_id,
    user_id: userId,
    role: invite.role,
  })

  if (memberError) return memberError.message

  await serviceClient
    .from('household_invites')
    .update({ use_count: invite.use_count + 1 })
    .eq('id', invite.id)

  return null // success
}

// ─── signIn ──────────────────────────────────────────────────────────────────

export async function signIn(
  _prevState: { error: string } | null,
  formData: FormData
): Promise<{ error: string } | null> {
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const inviteCode = (formData.get('inviteCode') as string | null)?.trim() || null

  const supabase = await createServerClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    return { error: error.message }
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: 'Authentication failed' }

  if (inviteCode) {
    const inviteError = await acceptInviteForUser(user.id, inviteCode)
    if (inviteError) return { error: inviteError }
    redirect('/dashboard')
  }

  const { data: membership } = await supabase
    .from('household_members')
    .select('household_id')
    .eq('user_id', user.id)
    .order('joined_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (!membership) {
    redirect('/onboarding')
  }

  redirect('/dashboard')
}

// ─── signUp ──────────────────────────────────────────────────────────────────

export async function signUp(
  _prevState: { error: string } | null,
  formData: FormData
): Promise<{ error: string } | null> {
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const displayName = formData.get('displayName') as string
  const inviteCode = (formData.get('inviteCode') as string | null)?.trim() || null

  const supabase = await createServerClient()
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { display_name: displayName },
    },
  })

  if (error) {
    return { error: error.message }
  }

  if (inviteCode) {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (user) {
      const inviteError = await acceptInviteForUser(user.id, inviteCode)
      if (inviteError) return { error: inviteError }
    }

    redirect('/dashboard')
  }

  // No invite — send to onboarding to create or join a household
  redirect('/onboarding')
}

// ─── createHousehold ─────────────────────────────────────────────────────────

/**
 * Creates a household and adds the current user as manager.
 * Form action for use with useActionState.
 *
 * NOTE: TECHNICAL_PLAN §5 has `{ householdName, displayName }` — `displayName`
 * does not correspond to any `households` column and appears to be a typo for
 * `displayCurrency`. Implemented as `displayCurrency` per the schema and slice
 * 1b deliverables.
 */
export async function createHousehold(
  _prevState: { error: string } | null,
  formData: FormData
): Promise<{ error: string } | null> {
  const householdName = formData.get('householdName') as string
  const rawCurrency = formData.get('displayCurrency') as string

  if (!householdName?.trim()) return { error: 'Household name is required' }

  const validCurrencies: DisplayCurrency[] = ['TRY', 'USD', 'EUR']
  if (!validCurrencies.includes(rawCurrency as DisplayCurrency)) {
    return { error: 'Invalid display currency' }
  }

  const displayCurrency = rawCurrency as DisplayCurrency
  const supabase = await createServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: 'Not authenticated' }

  // Use service role for the two INSERT operations:
  // 1. households has no INSERT policy (new household has no members yet to check against)
  // 2. household_members INSERT policy requires the caller to already be a manager —
  //    impossible when bootstrapping the first membership row
  const serviceClient = createServiceRoleClient()

  const { data: household, error: householdError } = await serviceClient
    .from('households')
    .insert({ name: householdName.trim(), display_currency: displayCurrency })
    .select('id')
    .single()

  if (householdError || !household) {
    return { error: householdError?.message ?? 'Failed to create household' }
  }

  const { error: memberError } = await serviceClient.from('household_members').insert({
    household_id: household.id,
    user_id: user.id,
    role: 'manager',
  })

  if (memberError) {
    await serviceClient.from('households').delete().eq('id', household.id)
    return { error: memberError.message }
  }

  redirect('/dashboard')
}

// ─── signOut ─────────────────────────────────────────────────────────────────

export async function signOut(): Promise<void> {
  const supabase = await createServerClient()
  await supabase.auth.signOut()
  redirect('/login')
}
