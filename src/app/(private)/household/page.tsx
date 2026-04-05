import { redirect } from 'next/navigation'
import { createServerClient, createServiceRoleClient } from '@/lib/supabase/server'
import { AppShell } from '@/components/shared/app-shell'
import { HouseholdSettingsForm } from '@/app/(private)/settings/household/household-settings-form'
import { MembersManager } from '@/app/(private)/settings/members/members-manager'

export const dynamic = 'force-dynamic'

export default async function HouseholdPage() {
  const supabase = await createServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: membership } = await supabase
    .from('household_members')
    .select('id, household_id, role')
    .eq('user_id', user.id)
    .order('joined_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (!membership) redirect('/onboarding')

  const householdId = membership.household_id
  const myRole = membership.role as 'manager' | 'editor' | 'viewer'
  const isManager = myRole === 'manager'

  // Display name for AppShell
  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('id', user.id)
    .maybeSingle()
  const displayName = profile?.display_name ?? user.email?.split('@')[0] ?? 'User'

  // Household info for settings form
  const { data: household } = await supabase
    .from('households')
    .select('id, name, display_currency')
    .eq('id', householdId)
    .single()

  if (!household) redirect('/onboarding')

  // Members list (requires service role for profile joins)
  const serviceClient = createServiceRoleClient()
  const { data: membersRaw } = await serviceClient
    .from('household_members')
    .select('id, user_id, role, joined_at, profiles(display_name, email)')
    .eq('household_id', householdId)
    .order('joined_at', { ascending: true })

  const members = (membersRaw ?? []).map((m) => ({
    id: m.id,
    userId: m.user_id,
    role: m.role as 'manager' | 'editor' | 'viewer',
    joinedAt: m.joined_at,
    displayName:
      m.profiles && typeof m.profiles === 'object' && 'display_name' in m.profiles
        ? (m.profiles as unknown as { display_name: string; email: string }).display_name
        : m.user_id,
    email:
      m.profiles && typeof m.profiles === 'object' && 'email' in m.profiles
        ? (m.profiles as unknown as { display_name: string; email: string }).email
        : '',
  }))

  return (
    <AppShell title="Household" displayName={displayName}>
      <div className="max-w-2xl space-y-8">
        {/* Household Settings */}
        <section>
          <div className="mb-4">
            <h2 className="text-xl font-semibold" style={{ color: 'var(--color-fg-primary)' }}>
              Household Settings
            </h2>
            <p className="text-sm mt-1" style={{ color: 'var(--color-fg-secondary)' }}>
              Manage your household name and preferences.
            </p>
          </div>
          <HouseholdSettingsForm
            household={{
              id: household.id,
              name: household.name,
              displayCurrency: household.display_currency as 'TRY' | 'USD' | 'EUR',
            }}
            isManager={isManager}
          />
        </section>

        {/* Divider */}
        <div style={{ borderTop: '1px solid var(--color-border)' }} />

        {/* Members */}
        <section>
          <div className="mb-4">
            <h2 className="text-xl font-semibold" style={{ color: 'var(--color-fg-primary)' }}>
              Members
            </h2>
            <p className="text-sm mt-1" style={{ color: 'var(--color-fg-secondary)' }}>
              Manage household members and invite links.
            </p>
          </div>
          <MembersManager
            currentUserId={user.id}
            isManager={isManager}
            householdId={householdId}
            members={members}
          />
        </section>
      </div>
    </AppShell>
  )
}
