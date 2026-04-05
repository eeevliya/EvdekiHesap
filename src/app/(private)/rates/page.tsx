import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { AppShell } from '@/components/shared/app-shell'
import { RatesPageClient } from '@/components/rates/rates-page-client'
import { getRatesPageData, getSymbolDetail } from '@/lib/actions/rates'

export const dynamic = 'force-dynamic'

export default async function RatesPage({
  searchParams,
}: {
  searchParams: Promise<{ symbol?: string }>
}) {
  const params = await searchParams
  const supabase = await createServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // Display name for AppShell
  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('id', user.id)
    .maybeSingle()
  const displayName = profile?.display_name ?? user.email?.split('@')[0] ?? 'User'

  // Role — needed for "Manage Symbols" visibility
  const { data: membership } = await supabase
    .from('household_members')
    .select('role')
    .eq('user_id', user.id)
    .order('joined_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (!membership) redirect('/onboarding')

  const role = membership.role as 'manager' | 'editor' | 'viewer'
  const isManager = role === 'manager'

  const data = await getRatesPageData()
  if (!data) redirect('/login')

  const selectedSymbolId = params.symbol ?? null

  return (
    <AppShell title="Rates" displayName={displayName}>
      <RatesPageClient
        data={data}
        initialSelectedId={selectedSymbolId}
        isManager={isManager}
      />
    </AppShell>
  )
}
