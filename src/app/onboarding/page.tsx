import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

/**
 * Onboarding page — shown after registration when the user has no household.
 * Lives outside the (private) route group so the private layout's
 * household-redirect logic does not apply here.
 *
 * The household creation form is implemented in Slice 1b.
 */
export default async function OnboardingPage() {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // If the user already has a household, skip onboarding
  const { data: membership } = await supabase
    .from('household_members')
    .select('household_id')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle()

  if (membership) {
    redirect('/dashboard')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl">Create your household</CardTitle>
          <CardDescription>
            Welcome to EvdekiHesap. Set up your household to get started.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Household creation form — coming in Slice 1b.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
