import Link from 'next/link'
import { createServerClient, createServiceRoleClient } from '@/lib/supabase/server'
import { AcceptInviteButton } from './accept-invite-button'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface Props {
  params: Promise<{ code: string }>
}

export default async function InvitePage({ params }: Props) {
  const { code } = await params

  // Use service role to fetch invite details without requiring auth.
  // The invite URL is a secret — only people with the link see this page.
  const serviceClient = createServiceRoleClient()
  const { data: invite } = await serviceClient
    .from('household_invites')
    .select('code, role, expires_at, max_uses, use_count, households(name)')
    .eq('code', code)
    .maybeSingle()

  // Session check for conditional UI
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const isExpired = invite?.expires_at ? new Date(invite.expires_at) < new Date() : false
  const isMaxed =
    invite?.max_uses !== null && invite?.max_uses !== undefined
      ? invite.use_count >= invite.max_uses
      : false
  const isValid = !!invite && !isExpired && !isMaxed

  const householdName =
    invite?.households && typeof invite.households === 'object' && 'name' in invite.households
      ? (invite.households as { name: string }).name
      : null

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl">Household invite</CardTitle>
          <CardDescription>
            {householdName
              ? `You've been invited to join ${householdName}`
              : 'Join a household on EvdekiHesap'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!invite && (
            <p className="text-sm text-destructive">
              This invite link is invalid or does not exist.
            </p>
          )}

          {invite && isExpired && (
            <p className="text-sm text-destructive">This invite link has expired.</p>
          )}

          {invite && isMaxed && (
            <p className="text-sm text-destructive">
              This invite link has reached its maximum number of uses.
            </p>
          )}

          {isValid && (
            <>
              <div className="rounded-md border bg-muted/50 p-3 space-y-1 text-sm">
                {householdName && (
                  <p>
                    <span className="text-muted-foreground">Household:</span>{' '}
                    <span className="font-medium">{householdName}</span>
                  </p>
                )}
                <p>
                  <span className="text-muted-foreground">Role:</span>{' '}
                  <span className="font-medium capitalize">{invite.role}</span>
                </p>
              </div>

              {!user ? (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    You need an account to accept this invite.
                  </p>
                  <Button asChild className="w-full">
                    <Link href={`/register?invite=${code}`}>Register and accept</Link>
                  </Button>
                  <Button variant="outline" asChild className="w-full">
                    <Link href={`/login?invite=${code}`}>Sign in and accept</Link>
                  </Button>
                </div>
              ) : (
                <AcceptInviteButton code={code} />
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
