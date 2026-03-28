import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { HouseholdSettingsForm } from './household-settings-form'

export default async function HouseholdSettingsPage() {
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

  const { data: household } = await supabase
    .from('households')
    .select('id, name, display_currency')
    .eq('id', membership.household_id)
    .single()

  if (!household) redirect('/onboarding')

  return (
    <div className="max-w-lg mx-auto p-4 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Household settings</h1>
        <p className="text-sm text-muted-foreground">Manage your household name and preferences.</p>
      </div>

      <HouseholdSettingsForm
        household={{
          id: household.id,
          name: household.name,
          displayCurrency: household.display_currency as 'TRY' | 'USD' | 'EUR',
        }}
        isManager={membership.role === 'manager'}
      />
    </div>
  )
}
