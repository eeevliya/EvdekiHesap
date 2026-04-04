'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  Wallet,
  ArrowLeftRight,
  TrendingUp,
  Home,
  Settings,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { SignOutButton } from './sign-out-button'

const navItems = [
  { icon: LayoutDashboard, label: 'Dashboard',     href: '/dashboard' },
  { icon: Wallet,          label: 'Accounts',      href: '/accounts' },
  { icon: ArrowLeftRight,  label: 'Transactions',  href: '/transactions' },
  { icon: TrendingUp,      label: 'Rates',         href: '/rates' },
  { icon: Home,            label: 'Household',     href: '/household' },
  { icon: Settings,        label: 'Settings',      href: '/settings' },
]

interface SidebarProps {
  displayName: string
}

export function Sidebar({ displayName }: SidebarProps) {
  const pathname = usePathname()

  return (
    <aside
      className="fixed left-0 top-0 z-40 hidden md:flex h-screen w-[220px] flex-col"
      style={{ background: 'var(--color-bg-sidebar)', borderRight: '1px solid var(--color-border)' }}
    >
      {/* Logo */}
      <div className="flex h-16 items-center gap-2 px-5" style={{ borderBottom: '1px solid var(--color-border)' }}>
        <div
          className="flex size-8 items-center justify-center rounded-lg"
          style={{ background: 'var(--color-accent)' }}
        >
          <TrendingUp className="size-4" style={{ color: 'var(--color-bg-sidebar)' }} />
        </div>
        <span className="text-lg font-semibold" style={{ color: 'var(--color-fg-primary)' }}>
          EvdekiHesap
        </span>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-1 px-3 py-4">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all min-h-[44px]',
                isActive
                  ? 'text-[--color-accent]'
                  : 'hover:text-[--color-fg-primary]'
              )}
              style={
                isActive
                  ? { background: 'var(--color-accent-subtle)', color: 'var(--color-accent)' }
                  : { color: 'var(--color-fg-secondary)' }
              }
            >
              <item.icon className="size-5 shrink-0" />
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* User display name */}
      <div className="p-3" style={{ borderTop: '1px solid var(--color-border)' }}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all min-h-[44px] hover:bg-[--color-bg-card]"
              style={{ color: 'var(--color-fg-secondary)' }}
            >
              <div
                className="flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold"
                style={{ background: 'var(--color-accent-subtle)', color: 'var(--color-accent)' }}
              >
                {displayName.charAt(0).toUpperCase()}
              </div>
              <span className="truncate">{displayName}</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" side="top" className="w-48">
            <DropdownMenuItem asChild>
              <Link href="/settings">Settings</Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <SignOutButton className="flex w-full items-center gap-2 text-sm" />
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  )
}
