import { createServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import SnapshotHistory from '@/components/settings/snapshot-history'

export default async function SnapshotsPage() {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // Get the user's first household (MVP: single household)
  const { data: membership } = await supabase
    .from('household_members')
    .select('household_id, role')
    .eq('user_id', user.id)
    .order('joined_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (!membership) redirect('/onboarding')

  if (membership.role !== 'manager') {
    return (
      <div className="p-8 text-center">
        <p className="text-sm font-medium" style={{ color: 'var(--color-fg-primary)' }}>
          Permission denied
        </p>
        <p className="text-sm mt-1" style={{ color: 'var(--color-fg-secondary)' }}>
          Only managers can access this page.
        </p>
      </div>
    )
  }

  const householdId = membership.household_id

  // Household display currency
  const { data: household } = await supabase
    .from('households')
    .select('display_currency')
    .eq('id', householdId)
    .single()

  // Most recent 50 snapshots, newest first
  const { data: snapshots } = await supabase
    .from('snapshots')
    .select('id, taken_at, trigger, net_worth_try, net_worth_usd, net_worth_eur')
    .eq('household_id', householdId)
    .order('taken_at', { ascending: false })
    .limit(50)

  return (
    <SnapshotHistory
      householdId={householdId}
      displayCurrency={(household?.display_currency as string) ?? 'TRY'}
      snapshots={(snapshots ?? []).map((s) => ({
        id: s.id as string,
        takenAt: s.taken_at as string,
        trigger: s.trigger as 'scheduled' | 'manual',
        netWorthTry: s.net_worth_try != null ? Number(s.net_worth_try) : null,
        netWorthUsd: s.net_worth_usd != null ? Number(s.net_worth_usd) : null,
        netWorthEur: s.net_worth_eur != null ? Number(s.net_worth_eur) : null,
      }))}
    />
  )
}
