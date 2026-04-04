'use client'

import { useState } from 'react'
import { ArrowUp, ArrowDown, ChevronDown, ChevronUp } from 'lucide-react'
import { Card, CardHeader, CardTitle } from '@/components/shared/card'
import { Button } from '@/components/ui/button'
import { formatCurrency, formatPct } from '@/lib/utils/format'
import { AssetPerformanceTable } from './asset-performance-table'
import type { AssetPerformanceRow } from '@/lib/actions/dashboard'
import type { DisplayCurrency } from '@/lib/types/domain'

interface PerformanceCardProps {
  data: AssetPerformanceRow[]
  displayCurrency: DisplayCurrency
}

export function PerformanceCard({ data, displayCurrency }: PerformanceCardProps) {
  const [expanded, setExpanded] = useState(false)

  // ── Total G/L ──────────────────────────────────────────────────────────────
  const rowsWithGL = data.filter((r) => r.gainLossAmount != null)
  const totalGL = rowsWithGL.length > 0
    ? rowsWithGL.reduce((sum, r) => sum + r.gainLossAmount!, 0)
    : null
  // Cost basis per row = currentValue − gainLossAmount
  const totalCostBasis = rowsWithGL.length > 0
    ? rowsWithGL.reduce((sum, r) => sum + (r.currentValue - r.gainLossAmount!), 0)
    : null
  const totalGLPct = totalGL != null && totalCostBasis != null && totalCostBasis !== 0
    ? (totalGL / totalCostBasis) * 100
    : null
  const isPositive = totalGL != null && totalGL >= 0

  // ── Best / Worst ───────────────────────────────────────────────────────────
  const withPct = data.filter((r) => r.gainLossPct != null)
  const best  = [...withPct].sort((a, b) => b.gainLossPct! - a.gainLossPct!).slice(0, 3)
  const worst = [...withPct].sort((a, b) => a.gainLossPct! - b.gainLossPct!).slice(0, 3)
  const hasBestWorst = withPct.length > 0

  return (
    // Outer wrapper is the new relative root so the floating panel anchors here,
    // not to the SortableCard parent (which is also relative).
    <div className="relative">
      <Card>
        <CardHeader>
          <CardTitle>Performance</CardTitle>
        </CardHeader>

        {/* Total G/L amount */}
        <div className="mb-4">
          <div className="flex items-center gap-1.5">
            {totalGL != null ? (
              <>
                {isPositive
                  ? <ArrowUp   className="size-5 shrink-0" style={{ color: 'var(--color-positive)' }} />
                  : <ArrowDown className="size-5 shrink-0" style={{ color: 'var(--color-negative)' }} />
                }
                <span
                  className="text-3xl font-bold tracking-tight font-mono"
                  style={{ color: isPositive ? 'var(--color-positive)' : 'var(--color-negative)' }}
                >
                  {formatCurrency(totalGL, displayCurrency)}
                </span>
              </>
            ) : (
              <span
                className="text-3xl font-bold tracking-tight font-mono"
                style={{ color: 'var(--color-fg-disabled)' }}
              >
                —
              </span>
            )}
          </div>

          {/* Derived G/L % */}
          {totalGLPct != null && (
            <p
              className="text-sm font-mono mt-0.5"
              style={{ color: isPositive ? 'var(--color-positive)' : 'var(--color-negative)' }}
            >
              {formatPct(totalGLPct, { showSign: true })} all time
            </p>
          )}
        </div>

        {/* Best / Worst columns */}
        {hasBestWorst && (
          <div
            className="grid grid-cols-2 gap-4 pt-4"
            style={{ borderTop: '1px solid var(--color-border)' }}
          >
            {/* Best */}
            <div>
              <p className="text-xs font-medium mb-2" style={{ color: 'var(--color-positive)' }}>
                Best
              </p>
              <div className="space-y-1.5">
                {best.map((row) => (
                  <div key={row.assetId} className="flex items-center justify-between gap-2">
                    <span
                      className="text-sm font-medium truncate"
                      style={{ color: 'var(--color-fg-primary)' }}
                    >
                      {row.symbolCode}
                    </span>
                    <span
                      className="text-xs font-mono shrink-0"
                      style={{ color: 'var(--color-positive)' }}
                    >
                      {formatPct(row.gainLossPct!, { showSign: true })}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Worst */}
            <div>
              <p className="text-xs font-medium mb-2" style={{ color: 'var(--color-negative)' }}>
                Worst
              </p>
              <div className="space-y-1.5">
                {worst.map((row) => (
                  <div key={row.assetId} className="flex items-center justify-between gap-2">
                    <span
                      className="text-sm font-medium truncate"
                      style={{ color: 'var(--color-fg-primary)' }}
                    >
                      {row.symbolCode}
                    </span>
                    <span
                      className="text-xs font-mono shrink-0"
                      style={{ color: 'var(--color-negative)' }}
                    >
                      {formatPct(row.gainLossPct!, { showSign: true })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Expand / collapse toggle */}
        <div className="flex justify-end mt-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded((e) => !e)}
            className="min-h-[36px]"
            style={{ color: 'var(--color-fg-secondary)' }}
            aria-label={expanded ? 'Collapse full table' : 'Expand full table'}
          >
            {expanded
              ? <ChevronUp   className="size-4" />
              : <ChevronDown className="size-4" />
            }
          </Button>
        </div>
      </Card>

      {/* Floating expanded panel — absolutely positioned so the card's grid footprint is unchanged */}
      {expanded && (
        <div
          className="absolute left-0 right-0 z-50 rounded-2xl p-5 md:p-6 overflow-x-auto"
          style={{
            top: 'calc(100% + 8px)',
            background: 'var(--color-bg-card)',
            border: '1px solid var(--color-border)',
            boxShadow: 'var(--shadow-card)',
          }}
        >
          <AssetPerformanceTable
            data={data}
            displayCurrency={displayCurrency}
            flat
          />
        </div>
      )}
    </div>
  )
}
