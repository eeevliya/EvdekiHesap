'use client'

import { useState, useTransition } from 'react'
import { updateMemberRole, removeMember, createInvite } from '@/lib/actions/households'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
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
import type { Role } from '@/lib/types/domain'

interface Member {
  id: string
  userId: string
  role: 'manager' | 'editor' | 'viewer'
  joinedAt: string
  displayName: string
  email: string
}

interface Props {
  currentUserId: string
  isManager: boolean
  householdId: string
  members: Member[]
}

function roleBadgeVariant(role: string): 'default' | 'secondary' | 'outline' {
  if (role === 'manager') return 'default'
  if (role === 'editor') return 'secondary'
  return 'outline'
}

function MemberRow({
  member,
  isSelf,
  isManager,
}: {
  member: Member
  isSelf: boolean
  isManager: boolean
}) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleRoleChange(newRole: string) {
    setError(null)
    startTransition(async () => {
      const result = await updateMemberRole(member.id, newRole as Role)
      if (!result.success) setError(result.error)
    })
  }

  function handleRemove() {
    setError(null)
    startTransition(async () => {
      const result = await removeMember(member.id)
      if (!result.success) setError(result.error)
    })
  }

  return (
    <div className="flex items-center justify-between gap-3 py-3">
      <div className="min-w-0 flex-1">
        <p className="font-medium truncate">
          {member.displayName}
          {isSelf && <span className="text-muted-foreground font-normal"> (you)</span>}
        </p>
        <p className="text-sm text-muted-foreground truncate">{member.email}</p>
        {error && <p className="text-xs text-destructive mt-1">{error}</p>}
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {isManager && !isSelf ? (
          <Select value={member.role} onValueChange={handleRoleChange} disabled={isPending}>
            <SelectTrigger className="w-28 h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="manager">Manager</SelectItem>
              <SelectItem value="editor">Editor</SelectItem>
              <SelectItem value="viewer">Viewer</SelectItem>
            </SelectContent>
          </Select>
        ) : (
          <Badge variant={roleBadgeVariant(member.role)} className="capitalize">
            {member.role}
          </Badge>
        )}

        {isManager && !isSelf && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                disabled={isPending}
              >
                Remove
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Remove member?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will remove <strong>{member.displayName}</strong> from the household. They
                  will lose access to all household data.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleRemove}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Remove
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>
    </div>
  )
}

function CreateInviteSection({ householdId }: { householdId: string }) {
  const [role, setRole] = useState<'editor' | 'viewer'>('editor')
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [confirmation, setConfirmation] = useState<string | null>(null)

  function handleCreate() {
    setError(null)
    setConfirmation(null)
    startTransition(async () => {
      const result = await createInvite(householdId, { role })
      if (!result.success) {
        setError(result.error)
        return
      }
      const origin = window.location.origin
      const link = `${origin}/invite/${result.data.code}`
      try {
        await navigator.clipboard.writeText(link)
        setConfirmation('Link copied to clipboard — expires in 1 hour')
      } catch {
        // Clipboard API may be unavailable (e.g. non-HTTPS in dev)
        setConfirmation(`Link created (copy manually): ${link}`)
      }
    })
  }

  return (
    <div className="space-y-3">
      <div className="flex items-end gap-2">
        <div className="space-y-1 flex-1">
          <label className="text-sm font-medium">Role for new invite</label>
          <Select
            value={role}
            onValueChange={(v) => setRole(v as 'editor' | 'viewer')}
            disabled={isPending}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="editor">Editor</SelectItem>
              <SelectItem value="viewer">Viewer</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button onClick={handleCreate} disabled={isPending}>
          {isPending ? 'Creating…' : 'Create invite link'}
        </Button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {confirmation && <p className="text-sm text-green-600">{confirmation}</p>}
    </div>
  )
}

export function MembersManager({ currentUserId, isManager, householdId, members }: Props) {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-base font-semibold">Members</h2>
        <div className="divide-y">
          {members.map((member) => (
            <MemberRow
              key={member.id}
              member={member}
              isSelf={member.userId === currentUserId}
              isManager={isManager}
            />
          ))}
        </div>
      </div>

      {isManager && (
        <>
          <Separator />
          <div className="space-y-4">
            <h2 className="text-base font-semibold">Invite someone</h2>
            <CreateInviteSection householdId={householdId} />
          </div>
        </>
      )}
    </div>
  )
}
