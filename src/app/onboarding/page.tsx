'use client'

import { useState, useActionState } from 'react'
import { useRouter } from 'next/navigation'
import { createHousehold } from '@/lib/actions/auth'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

type View = 'choose' | 'create' | 'join'

function ChooseView({ onChoose }: { onChoose: (v: 'create' | 'join') => void }) {
  return (
    <div className="space-y-3">
      <Button className="w-full" onClick={() => onChoose('create')}>
        Create a household
      </Button>
      <Button variant="outline" className="w-full" onClick={() => onChoose('join')}>
        I have an invite link
      </Button>
    </div>
  )
}

function CreateView({ onBack }: { onBack: () => void }) {
  const [state, action, isPending] = useActionState(createHousehold, null)

  return (
    <form action={action} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="householdName">Household name</Label>
        <Input
          id="householdName"
          name="householdName"
          placeholder="e.g. Smith Family"
          required
          disabled={isPending}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="displayCurrency">Display currency</Label>
        <Select name="displayCurrency" defaultValue="TRY" disabled={isPending}>
          <SelectTrigger id="displayCurrency">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="TRY">TRY — Turkish Lira</SelectItem>
            <SelectItem value="USD">USD — US Dollar</SelectItem>
            <SelectItem value="EUR">EUR — Euro</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {state?.error && (
        <p className="text-sm text-destructive">{state.error}</p>
      )}

      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? 'Creating…' : 'Create household'}
      </Button>

      <Button type="button" variant="ghost" className="w-full" onClick={onBack} disabled={isPending}>
        Back
      </Button>
    </form>
  )
}

function JoinView({ onBack }: { onBack: () => void }) {
  const [value, setValue] = useState('')
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const input = value.trim()
    if (!input) {
      setError('Please enter an invite link or code')
      return
    }

    // Accept either a full URL (extract last path segment) or a bare code
    let code: string
    try {
      const url = new URL(input)
      const segments = url.pathname.split('/').filter(Boolean)
      code = segments[segments.length - 1]
    } catch {
      // Not a URL — treat as a bare code
      code = input
    }

    if (!code) {
      setError('Could not extract invite code from the link')
      return
    }

    router.push(`/invite/${code}`)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="inviteLink">Invite link or code</Label>
        <Input
          id="inviteLink"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Paste your invite link here"
          autoFocus
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button type="submit" className="w-full">
        Go to invite
      </Button>

      <Button type="button" variant="ghost" className="w-full" onClick={onBack}>
        Back
      </Button>
    </form>
  )
}

export default function OnboardingPage() {
  const [view, setView] = useState<View>('choose')

  const titles: Record<View, string> = {
    choose: 'Get started',
    create: 'Create your household',
    join: 'Join a household',
  }

  const descriptions: Record<View, string> = {
    choose: 'Welcome to EvdekiHesap. What would you like to do?',
    create: 'Set up a new household to start tracking your portfolio.',
    join: 'Enter the invite link you received from a household manager.',
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl">{titles[view]}</CardTitle>
          <CardDescription>{descriptions[view]}</CardDescription>
        </CardHeader>
        <CardContent>
          {view === 'choose' && <ChooseView onChoose={setView} />}
          {view === 'create' && <CreateView onBack={() => setView('choose')} />}
          {view === 'join' && <JoinView onBack={() => setView('choose')} />}
        </CardContent>
      </Card>
    </div>
  )
}
