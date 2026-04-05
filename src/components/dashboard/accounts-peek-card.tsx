import Link from 'next/link'
import { Wallet } from 'lucide-react'
import { Card, CardHeader, CardTitle } from '@/components/shared/card'
import { EmptyState } from '@/components/shared/empty-state'
import { formatCurrency } from '@/lib/utils/format'
import type { PeekAccountRow } from '@/lib/actions/dashboard'
import type { DisplayCurrency } from '@/lib/types/domain'

interface AccountsPeekCardProps {
  accounts: PeekAccountRow[]
  displayCurrency: DisplayCurrency
}

export function AccountsPeekCard({ accounts, displayCurrency }: AccountsPeekCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Accounts</CardTitle>
        <Link
          href="/accounts"
          className="text-sm font-medium"
          style={{ color: 'var(--color-accent)' }}
        >
          View All →
        </Link>
      </CardHeader>

      {accounts.length === 0 ? (
        <EmptyState
          icon={Wallet}
          message="No accounts yet"
          action={
            <Link
              href="/accounts"
              className="inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-medium min-h-[44px]"
              style={{ background: 'var(--color-accent)', color: 'var(--color-bg-sidebar)' }}
            >
              Add Account
            </Link>
          }
        />
      ) : (
        <div className="space-y-1">
          {accounts.map((account) => (
            <Link
              key={account.id}
              href={`/accounts?account=${account.id}`}
              className="flex items-center justify-between px-2 py-2.5 rounded-xl transition-colors hover:bg-[var(--color-bg-base)] min-h-[44px]"
            >
              <div className="min-w-0 flex-1">
                <p
                  className="text-sm font-semibold truncate"
                  style={{ color: 'var(--color-fg-primary)' }}
                >
                  {account.name}
                </p>
                {account.institution && (
                  <p
                    className="text-xs truncate"
                    style={{ color: 'var(--color-fg-secondary)' }}
                  >
                    {account.institution}
                  </p>
                )}
              </div>
              <span
                className="font-mono text-sm ml-3 shrink-0"
                style={{ color: 'var(--color-accent)' }}
              >
                {formatCurrency(account.totalValue, displayCurrency)}
              </span>
            </Link>
          ))}
        </div>
      )}
    </Card>
  )
}
