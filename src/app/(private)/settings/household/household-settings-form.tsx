'use client'

import { useState, useTransition } from 'react'
import { updateHousehold, deleteHousehold } from '@/lib/actions/households'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Separator } from '@/components/ui/separator'
import type { DisplayCurrency } from '@/lib/types/domain'

interface Props {
  household: {
    id: string
    name: string
    displayCurrency: DisplayCurrency
  }
  isManager: boolean
}

export function HouseholdSettingsForm({ household, isManager }: Props) {
  const [name, setName] = useState(household.name)
  const [displayCurrency, setDisplayCurrency] = useState<DisplayCurrency>(
    household.displayCurrency
  )
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [isDeleting, startDeleteTransition] = useTransition()

  function handleSave() {
    setError(null)
    setSuccess(false)
    startTransition(async () => {
      const result = await updateHousehold(household.id, { name, displayCurrency })
      if (!result.success) {
        setError(result.error)
      } else {
        setSuccess(true)
      }
    })
  }

  function handleDelete() {
    startDeleteTransition(async () => {
      const result = await deleteHousehold(household.id)
      if (!result?.success) {
        setError(result?.error ?? 'Failed to delete household')
      }
      // deleteHousehold redirects on success
    })
  }

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">Household name</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={!isManager || isPending}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="displayCurrency">Display currency</Label>
          <Select
            value={displayCurrency}
            onValueChange={(v) => setDisplayCurrency(v as DisplayCurrency)}
            disabled={!isManager || isPending}
          >
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

        {error && <p className="text-sm text-destructive">{error}</p>}
        {success && <p className="text-sm text-green-600">Settings saved.</p>}

        {isManager && (
          <Button onClick={handleSave} disabled={isPending}>
            {isPending ? 'Saving…' : 'Save changes'}
          </Button>
        )}

        {!isManager && (
          <p className="text-sm text-muted-foreground">
            Only managers can edit household settings.
          </p>
        )}
      </div>

      {isManager && (
        <>
          <Separator />
          <div className="space-y-2">
            <h2 className="text-base font-semibold text-destructive">Danger zone</h2>
            <p className="text-sm text-muted-foreground">
              Deleting the household permanently removes all accounts, assets, and transaction
              history. This cannot be undone.
            </p>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" disabled={isDeleting}>
                  {isDeleting ? 'Deleting…' : 'Delete household'}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete household?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete <strong>{household.name}</strong> and all its
                    data. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDelete}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </>
      )}
    </div>
  )
}
