'use client'

import { useState, useTransition } from 'react'
import {
  updateMemberRole,
  removeMember,
  createInvite,
  revokeInvite,
} from '@/lib/actions/households'
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

interface Invite {
  id: string
  code: string
  role: 'editor' | 'viewer'
  expiresAt: string | null
  maxUses: number | null
  useCount: number
  createdAt: string
}

interface Props {
  currentUserId: string
  isManager: boolean
  householdId: string
  members: Member[]
  invites: Invite[]
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
          <Select
            value={member.role}
            onValueChange={handleRoleChange}
            disabled={isPending}
          >
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
              <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" disabled={isPending}>
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

function InviteRow({ invite, origin }: { invite: Invite; origin: string }) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const inviteUrl = `${origin}/invite/${invite.code}`

  function handleCopy() {
    navigator.clipboard.writeText(inviteUrl).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  function handleRevoke() {
    setError(null)
    startTransition(async () => {
      const result = await revokeInvite(invite.id)
      if (!result.success) setError(result.error)
    })
  }

  const isExpired = invite.expiresAt ? new Date(invite.expiresAt) < new Date() : false
  const isMaxed = invite.maxUses !== null ? invite.useCount >= invite.maxUses : false

  return (
    <div className="py-3 space-y-1">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-0.5">
          <p className="text-sm font-medium capitalize">
            {invite.role} role
            {(isExpired || isMaxed) && (
              <span className="ml-2 text-xs text-muted-foreground font-normal">
                ({isExpired ? 'expired' : 'fully used'})
              </span>
            )}
          </p>
          <p className="text-xs text-muted-foreground truncate font-mono">{inviteUrl}</p>
          <p className="text-xs text-muted-foreground">
            Used {invite.useCount}
            {invite.maxUses !== null ? `/${invite.maxUses}` : ''} time
            {invite.useCount !== 1 ? 's' : ''}
            {invite.expiresAt && (
              <>
                {' · '}
                Expires {new Date(invite.expiresAt).toLocaleDateString()}
              </>
            )}
          </p>
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={handleCopy} disabled={isPending}>
            {copied ? 'Copied!' : 'Copy link'}
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                disabled={isPending}
              >
                Revoke
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Revoke invite link?</AlertDialogTitle>
                <AlertDialogDescription>
                  This invite link will no longer work. Anyone who hasn&apos;t accepted it yet
                  won&apos;t be able to join.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleRevoke}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Revoke
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </div>
  )
}

function CreateInviteForm({
  householdId,
}: {
  householdId: string
}) {
  const [role, setRole] = useState<'editor' | 'viewer'>('editor')
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [newLink, setNewLink] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  function handleCreate() {
    setError(null)
    setNewLink(null)
    startTransition(async () => {
      const result = await createInvite(householdId, { role })
      if (!result.success) {
        setError(result.error)
      } else {
        const origin = window.location.origin
        setNewLink(`${origin}/invite/${result.data.code}`)
      }
    })
  }

  function handleCopy() {
    if (!newLink) return
    navigator.clipboard.writeText(newLink).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="space-y-3">
      <div className="flex items-end gap-2">
        <div className="space-y-1 flex-1">
          <label className="text-sm font-medium">Role for new invite</label>
          <Select value={role} onValueChange={(v) => setRole(v as 'editor' | 'viewer')} disabled={isPending}>
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

      {newLink && (
        <div className="flex items-center gap-2 rounded-md border bg-muted/50 p-3">
          <p className="text-xs font-mono flex-1 truncate">{newLink}</p>
          <Button variant="outline" size="sm" onClick={handleCopy}>
            {copied ? 'Copied!' : 'Copy'}
          </Button>
        </div>
      )}
    </div>
  )
}

export function MembersManager({
  currentUserId,
  isManager,
  householdId,
  members,
  invites,
}: Props) {
  const origin = typeof window !== 'undefined' ? window.location.origin : ''

  return (
    <div className="space-y-6">
      {/* Members list */}
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

      {/* Invite links — Manager only */}
      {isManager && (
        <>
          <Separator />
          <div className="space-y-4">
            <h2 className="text-base font-semibold">Invite links</h2>

            <CreateInviteForm householdId={householdId} />

            {invites.length > 0 && (
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Active invite links</p>
                <div className="divide-y">
                  {invites.map((invite) => (
                    <InviteRow key={invite.id} invite={invite} origin={origin} />
                  ))}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
