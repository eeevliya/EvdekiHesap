'use client'

import { MoreVertical, Settings } from 'lucide-react'
import Link from 'next/link'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { SignOutButton } from './sign-out-button'

interface TopHeaderProps {
  title: string
}

export function TopHeader({ title }: TopHeaderProps) {
  return (
    <header
      className="sticky top-0 z-30 flex md:hidden h-14 items-center justify-between px-4"
      style={{
        background: 'var(--color-bg-base)',
        borderBottom: '1px solid var(--color-border)',
      }}
    >
      <h1 className="text-lg font-semibold" style={{ color: 'var(--color-fg-primary)' }}>
        {title}
      </h1>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="size-11"
            style={{ color: 'var(--color-fg-secondary)' }}
          >
            <MoreVertical className="size-5" />
            <span className="sr-only">Menu</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem asChild>
            <Link href="/settings" className="flex items-center gap-2">
              <Settings className="size-4" />
              Settings
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <SignOutButton className="flex w-full items-center gap-2 text-sm" />
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  )
}
