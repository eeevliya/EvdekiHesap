'use server'

import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import type { DisplayCurrency } from '@/lib/types/domain'

export async function signIn(
  _prevState: { error: string } | null,
  formData: FormData
): Promise<{ error: string } | null> {
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  const supabase = await createServerClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    return { error: error.message }
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
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
  }

  redirect('/dashboard')
}

export async function signUp(
  _prevState: { error: string } | null,
  formData: FormData
): Promise<{ error: string } | null> {
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const displayName = formData.get('displayName') as string

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

  // After sign-up the user has no household yet — send to onboarding
  redirect('/onboarding')
}

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

  const { data: household, error: householdError } = await supabase
    .from('households')
    .insert({ name: householdName.trim(), display_currency: displayCurrency })
    .select('id')
    .single()

  if (householdError || !household) {
    return { error: householdError?.message ?? 'Failed to create household' }
  }

  const { error: memberError } = await supabase.from('household_members').insert({
    household_id: household.id,
    user_id: user.id,
    role: 'manager',
  })

  if (memberError) {
    await supabase.from('households').delete().eq('id', household.id)
    return { error: memberError.message }
  }

  redirect('/dashboard')
}

export async function signOut(): Promise<void> {
  const supabase = await createServerClient()
  await supabase.auth.signOut()
  redirect('/login')
}
