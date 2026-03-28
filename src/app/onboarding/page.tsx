'use client'

import { useActionState } from 'react'
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

export default function OnboardingPage() {
  const [state, action, isPending] = useActionState(createHousehold, null)

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl">Create your household</CardTitle>
          <CardDescription>
            Welcome to EvdekiHesap. Set up your household to start tracking your portfolio.
          </CardDescription>
        </CardHeader>
        <CardContent>
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
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
