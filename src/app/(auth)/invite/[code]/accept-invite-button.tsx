'use client'

import { useState, useTransition } from 'react'
import { acceptInvite } from '@/lib/actions/households'
import { Button } from '@/components/ui/button'

export function AcceptInviteButton({ code }: { code: string }) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleAccept() {
    setError(null)
    startTransition(async () => {
      const result = await acceptInvite(code)
      // acceptInvite redirects on success; result only returned on error
      if (result && !result.success) {
        setError(result.error)
      }
    })
  }

  return (
    <div className="space-y-2">
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button className="w-full" onClick={handleAccept} disabled={isPending}>
        {isPending ? 'Accepting…' : 'Accept invite'}
      </Button>
    </div>
  )
}
