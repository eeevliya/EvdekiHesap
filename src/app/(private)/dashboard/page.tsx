import { AppShell } from '@/components/shared/app-shell'
import { DashboardClient } from '@/components/dashboard/dashboard-client'
import { getDashboardData } from '@/lib/actions/dashboard'
import { createServerClient } from '@/lib/supabase/server'
import { Skeleton } from '@/components/shared/skeleton'

export const dynamic = 'force-dynamic'

async function getDisplayName(): Promise<string> {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return 'User'

  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('id', user.id)
    .maybeSingle()

  return profile?.display_name ?? user.email?.split('@')[0] ?? 'User'
}

export default async function DashboardPage() {
  const [data, displayName] = await Promise.all([
    getDashboardData(),
    getDisplayName(),
  ])

  return (
    <AppShell title="Dashboard" displayName={displayName}>
      {!data ? (
        <div className="space-y-4">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-80 w-full" />
        </div>
      ) : (
        <DashboardClient data={data} />
      )}
    </AppShell>
  )
}
