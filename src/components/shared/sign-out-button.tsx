'use client'

import { signOut } from '@/lib/actions/auth'
import { LogOut } from 'lucide-react'

interface SignOutButtonProps {
  className?: string
  showIcon?: boolean
}

export function SignOutButton({ className, showIcon = true }: SignOutButtonProps) {
  return (
    <form action={signOut}>
      <button
        type="submit"
        className={className}
        style={{ color: 'var(--color-negative)' }}
      >
        {showIcon && <LogOut className="size-4" />}
        Sign out
      </button>
    </form>
  )
}
