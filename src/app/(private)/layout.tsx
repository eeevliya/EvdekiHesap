import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'

/**
 * Private layout — server-side session guard.
 *
 * 1. No session → redirect to /login
 * 2. Authenticated but no household → redirect to /onboarding
 * 3. Authenticated with a household → render children
 */
export default async function PrivateLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
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

  return <>{children}</>
}
