import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { MembersManager } from './members-manager'

export default async function MembersSettingsPage() {
  const supabase = await createServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: myMembership } = await supabase
    .from('household_members')
    .select('id, household_id, role')
    .eq('user_id', user.id)
    .order('joined_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (!myMembership) redirect('/onboarding')

  const householdId = myMembership.household_id
  const myRole = myMembership.role as 'manager' | 'editor' | 'viewer'

  const { data: membersRaw } = await supabase
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
    <div className="max-w-2xl mx-auto p-4 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Members</h1>
        <p className="text-sm text-muted-foreground">Manage household members and invite links.</p>
      </div>

      <MembersManager
        currentUserId={user.id}
        isManager={myRole === 'manager'}
        householdId={householdId}
        members={members}
      />
    </div>
  )
}
