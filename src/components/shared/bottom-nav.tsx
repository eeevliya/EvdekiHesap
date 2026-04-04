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
} from 'lucide-react'

const navItems = [
  { icon: LayoutDashboard, label: 'Dashboard',    href: '/dashboard' },
  { icon: Wallet,          label: 'Accounts',     href: '/accounts' },
  { icon: ArrowLeftRight,  label: 'Transactions', href: '/transactions' },
  { icon: TrendingUp,      label: 'Rates',        href: '/rates' },
  { icon: Home,            label: 'Household',    href: '/household' },
]

export function BottomNav() {
  const pathname = usePathname()

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 flex md:hidden h-16 items-center justify-around pb-safe"
      style={{
        background: 'var(--color-bg-sidebar)',
        borderTop: '1px solid var(--color-border)',
        boxShadow: '0 -8px 30px oklch(0 0 0 / 0.50)',
      }}
    >
      {navItems.map((item) => {
        const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex flex-col items-center gap-1 px-3 py-2 text-xs font-medium transition-colors min-w-[44px] min-h-[44px] justify-center',
            )}
            style={{ color: isActive ? 'var(--color-accent)' : 'var(--color-fg-secondary)' }}
          >
            <item.icon className="size-5" />
            <span>{item.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
