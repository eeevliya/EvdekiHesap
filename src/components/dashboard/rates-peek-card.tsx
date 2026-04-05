import Link from 'next/link'
import { TrendingUp } from 'lucide-react'
import { Card, CardHeader, CardTitle } from '@/components/shared/card'
import { EmptyState } from '@/components/shared/empty-state'
import { formatPct } from '@/lib/utils/format'
import type { PeekRateRow } from '@/lib/actions/dashboard'

interface RatesPeekCardProps {
  rates: PeekRateRow[]
}

function formatRate(rate: number): string {
  if (rate >= 1000) return rate.toLocaleString('en-US', { maximumFractionDigits: 2 })
  if (rate >= 1) return rate.toLocaleString('en-US', { maximumFractionDigits: 4 })
  return rate.toLocaleString('en-US', { maximumFractionDigits: 8 })
}

export function RatesPeekCard({ rates }: RatesPeekCardProps) {
  return (
    <Card className="relative overflow-hidden">
      <CardHeader>
        <CardTitle>Rates</CardTitle>
        <Link
          href="/rates"
          className="text-sm font-medium"
          style={{ color: 'var(--color-accent)' }}
        >
          View All →
        </Link>
      </CardHeader>

      {rates.length === 0 ? (
        <EmptyState icon={TrendingUp} message="No rate data available" />
      ) : (
        <div className="relative">
          <div className="space-y-0">
            {rates.map((row, i) => {
              const pct = row.change24hPct
              const changeColor =
                pct == null
                  ? 'var(--color-fg-disabled)'
                  : pct >= 0
                  ? 'var(--color-positive)'
                  : 'var(--color-negative)'

              return (
                <div
                  key={row.symbolId}
                  className="flex items-center gap-3 py-2"
                  style={i < rates.length - 1 ? { borderBottom: '1px solid var(--color-border)' } : {}}
                >
                  {/* Symbol info */}
                  <div className="min-w-0 flex-1">
                    <span
                      className="text-sm font-semibold"
                      style={{ color: 'var(--color-fg-primary)' }}
                    >
                      {row.symbolCode}
                    </span>
                    {row.symbolName && (
                      <span
                        className="text-xs ml-1.5"
                        style={{ color: 'var(--color-fg-secondary)' }}
                      >
                        {row.symbolName}
                      </span>
                    )}
                  </div>

                  {/* Current rate */}
                  <span
                    className="font-mono text-xs"
                    style={{ color: 'var(--color-fg-primary)' }}
                  >
                    {formatRate(row.currentRate)}
                  </span>

                  {/* 24h change */}
                  <span
                    className="font-mono text-xs w-16 text-right shrink-0"
                    style={{ color: changeColor }}
                  >
                    {pct == null ? '—' : formatPct(pct, { showSign: true })}
                  </span>
                </div>
              )
            })}
          </div>

          {/* Fade out gradient at bottom */}
          <div
            className="absolute bottom-0 left-0 right-0 h-10 pointer-events-none"
            style={{
              background: 'linear-gradient(to bottom, transparent, var(--color-bg-card))',
            }}
          />
        </div>
      )}
    </Card>
  )
}
