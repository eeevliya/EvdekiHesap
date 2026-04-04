'use client'

import { useState, useTransition } from 'react'
import { RefreshCw, TrendingUp, TrendingDown } from 'lucide-react'
import { Card, CardHeader, CardTitle } from '@/components/shared/card'
import { Button } from '@/components/ui/button'
import { triggerManualSnapshot } from '@/lib/actions/snapshots'
import { RelativeTime } from '@/components/shared/relative-time'
import { formatCurrency, formatPct } from '@/lib/utils/format'
import { cn } from '@/lib/utils'
import type { NetWorthSummary } from '@/lib/actions/dashboard'

interface NetWorthCardProps {
  data: NetWorthSummary
  householdId: string
}

interface ChangeBadgeProps {
  label: string
  pct: number | null
}

function ChangeBadge({ label, pct }: ChangeBadgeProps) {
  const isNull = pct == null
  const isPos  = !isNull && pct >= 0
  const color  = isNull
    ? 'var(--color-fg-disabled)'
    : isPos
    ? 'var(--color-positive)'
    : 'var(--color-negative)'

  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className="text-xs" style={{ color: 'var(--color-fg-secondary)' }}>{label}</span>
      <span className="text-sm font-semibold font-mono" style={{ color }}>
        {isNull ? '—' : formatPct(pct, { showSign: true })}
      </span>
    </div>
  )
}

export function NetWorthCard({ data, householdId }: NetWorthCardProps) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const isPositiveAllTime = (data.changeAllTime ?? 0) >= 0

  function handleRefresh() {
    setError(null)
    startTransition(async () => {
      const result = await triggerManualSnapshot(householdId)
      if (!result.success) setError(result.error)
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Net Worth</CardTitle>
        <Button
          size="sm"
          variant="ghost"
          onClick={handleRefresh}
          disabled={isPending}
          className="min-h-[44px] min-w-[44px]"
          style={{ color: 'var(--color-accent)' }}
        >
          <RefreshCw className={cn('size-4', isPending && 'animate-spin')} />
          <span className="ml-1.5 hidden sm:inline">Refresh Now</span>
        </Button>
      </CardHeader>

      {/* Current net worth */}
      <div className="mb-4">
        <p
          className="text-3xl font-bold tracking-tight font-mono"
          style={{ color: 'var(--color-fg-primary)' }}
        >
          {formatCurrency(data.current, data.displayCurrency)}
        </p>

        {/* All-time gain/loss */}
        <div className="flex items-center gap-2 mt-1">
          {data.changeAllTime != null ? (
            <>
              <span style={{ color: isPositiveAllTime ? 'var(--color-positive)' : 'var(--color-negative)' }}>
                {isPositiveAllTime ? (
                  <TrendingUp className="size-4 inline mr-1" />
                ) : (
                  <TrendingDown className="size-4 inline mr-1" />
                )}
                <span className="font-mono text-sm font-medium">
                  {isPositiveAllTime ? '+' : ''}
                  {formatCurrency(data.changeAllTime, data.displayCurrency)}
                </span>
              </span>
              {data.changeAllTimePct != null && (
                <span className="text-xs font-mono" style={{ color: 'var(--color-fg-secondary)' }}>
                  ({formatPct(data.changeAllTimePct, { showSign: true })})
                </span>
              )}
              <span className="text-xs" style={{ color: 'var(--color-fg-disabled)' }}>all time</span>
            </>
          ) : (
            <span className="text-sm" style={{ color: 'var(--color-fg-disabled)' }}>No history yet</span>
          )}
        </div>
      </div>

      {/* 24h / 7d / 30d badges */}
      <div
        className="grid grid-cols-3 gap-4 pt-4"
        style={{ borderTop: '1px solid var(--color-border)' }}
      >
        <ChangeBadge label="24h"  pct={data.change24hPct}  />
        <ChangeBadge label="7d"   pct={data.change7dPct}   />
        <ChangeBadge label="30d"  pct={data.change30dPct}  />
      </div>

      {/* Footer */}
      <div className="mt-3 flex items-center justify-between">
        {data.ratesUpdatedAt && (
          <div className="flex items-center gap-1">
            <span className="text-xs" style={{ color: 'var(--color-fg-disabled)' }}>Rates updated</span>
            <RelativeTime isoString={data.ratesUpdatedAt} />
          </div>
        )}
        {error && (
          <p className="text-xs" style={{ color: 'var(--color-negative)' }}>{error}</p>
        )}
      </div>
    </Card>
  )
}
