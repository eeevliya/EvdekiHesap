import Link from 'next/link'
import { ArrowLeftRight } from 'lucide-react'
import { Card, CardHeader, CardTitle } from '@/components/shared/card'
import { EmptyState } from '@/components/shared/empty-state'
import type { PeekTransactionRow } from '@/lib/actions/dashboard'

interface TransactionsPeekCardProps {
  transactions: PeekTransactionRow[]
}

const TYPE_COLORS: Record<string, string> = {
  deposit: 'var(--color-positive)',
  interest: 'var(--color-positive)',
  debit: 'var(--color-negative)',
  transfer: 'var(--color-fg-secondary)',
  trade: 'var(--color-accent)',
}

const TYPE_LABELS: Record<string, string> = {
  deposit: 'Deposit',
  interest: 'Interest',
  debit: 'Debit',
  transfer: 'Transfer',
  trade: 'Trade',
}

function formatAmount(amount: number | null): string {
  if (amount == null) return '—'
  return amount.toLocaleString('en-US', { maximumFractionDigits: 6 })
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function TxSummaryLine({ tx }: { tx: PeekTransactionRow }) {
  const color = TYPE_COLORS[tx.type] ?? 'var(--color-fg-primary)'
  const label = TYPE_LABELS[tx.type] ?? tx.type

  switch (tx.type) {
    case 'deposit':
    case 'interest':
      return (
        <div className="flex items-center justify-between gap-2 min-w-0">
          <span className="text-xs truncate" style={{ color: 'var(--color-fg-secondary)' }}>
            <span className="font-medium" style={{ color: 'var(--color-fg-primary)' }}>
              {tx.toSymbolCode ?? '—'}
            </span>
            {tx.toAccountName ? ` · ${tx.toAccountName}` : ''}
          </span>
          <span className="font-mono text-xs shrink-0" style={{ color }}>
            +{formatAmount(tx.toAmount)} {tx.toSymbolCode}
          </span>
        </div>
      )
    case 'debit':
      return (
        <div className="flex items-center justify-between gap-2 min-w-0">
          <span className="text-xs truncate" style={{ color: 'var(--color-fg-secondary)' }}>
            <span className="font-medium" style={{ color: 'var(--color-fg-primary)' }}>
              {tx.fromSymbolCode ?? '—'}
            </span>
            {tx.fromAccountName ? ` · ${tx.fromAccountName}` : ''}
          </span>
          <span className="font-mono text-xs shrink-0" style={{ color }}>
            −{formatAmount(tx.fromAmount)} {tx.fromSymbolCode}
          </span>
        </div>
      )
    case 'transfer':
      return (
        <div className="flex items-center justify-between gap-2 min-w-0">
          <span className="text-xs truncate" style={{ color: 'var(--color-fg-secondary)' }}>
            {tx.fromAccountName ?? '—'} → {tx.toAccountName ?? '—'}
          </span>
          <span className="font-mono text-xs shrink-0" style={{ color }}>
            {formatAmount(tx.fromAmount)} {tx.fromSymbolCode}
          </span>
        </div>
      )
    case 'trade': {
      const isBuy = !!tx.toSymbolCode && !!tx.fromSymbolCode
      return (
        <div className="flex items-center justify-between gap-2 min-w-0">
          <span className="text-xs truncate" style={{ color: 'var(--color-fg-secondary)' }}>
            {tx.fromSymbolCode ?? '—'} → {tx.toSymbolCode ?? '—'}
          </span>
          <span className="font-mono text-xs shrink-0" style={{ color }}>
            {formatAmount(tx.fromAmount)} → {formatAmount(tx.toAmount)}
          </span>
        </div>
      )
    }
    default:
      return null
  }
}

export function TransactionsPeekCard({ transactions }: TransactionsPeekCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Transactions</CardTitle>
        <Link
          href="/transactions"
          className="text-sm font-medium"
          style={{ color: 'var(--color-accent)' }}
        >
          View All →
        </Link>
      </CardHeader>

      {transactions.length === 0 ? (
        <EmptyState
          icon={ArrowLeftRight}
          message="No transactions yet"
          action={
            <Link
              href="/transactions/new"
              className="inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-medium min-h-[44px]"
              style={{ background: 'var(--color-accent)', color: 'var(--color-bg-sidebar)' }}
            >
              Add Transaction
            </Link>
          }
        />
      ) : (
        <div className="space-y-0">
          {transactions.map((tx, i) => (
            <div
              key={tx.id}
              className="py-2.5"
              style={i < transactions.length - 1 ? { borderBottom: '1px solid var(--color-border)' } : {}}
            >
              <div className="flex items-center justify-between gap-2 mb-0.5">
                <span
                  className="text-xs font-semibold"
                  style={{ color: TYPE_COLORS[tx.type] ?? 'var(--color-fg-primary)' }}
                >
                  {TYPE_LABELS[tx.type] ?? tx.type}
                </span>
                <span className="text-xs" style={{ color: 'var(--color-fg-disabled)' }}>
                  {formatDate(tx.date)}
                </span>
              </div>
              <TxSummaryLine tx={tx} />
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}
