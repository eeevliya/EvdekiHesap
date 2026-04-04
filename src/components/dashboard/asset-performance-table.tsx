'use client'

import { useState } from 'react'
import { ChevronUp, ChevronDown, X, BarChart2 } from 'lucide-react'
import { Card, CardHeader, CardTitle } from '@/components/shared/card'
import { EmptyState } from '@/components/shared/empty-state'
import { Button } from '@/components/ui/button'
import { formatCurrency, formatPct, formatCagr } from '@/lib/utils/format'
import { cn } from '@/lib/utils'
import type { AssetPerformanceRow } from '@/lib/actions/dashboard'
import type { DisplayCurrency } from '@/lib/types/domain'

type SortKey = keyof Pick<
  AssetPerformanceRow,
  'symbolCode' | 'amount' | 'currentValue' | 'costBasis' | 'gainLossAmount' | 'gainLossPct' | 'cagrValue'
>

interface AssetPerformanceTableProps {
  data: AssetPerformanceRow[]
  displayCurrency: DisplayCurrency
  /** Symbol filter driven by clicking the donut chart */
  activeSymbol?: string | null
  onClearFilter?: () => void
}

export function AssetPerformanceTable({
  data,
  displayCurrency,
  activeSymbol,
  onClearFilter,
}: AssetPerformanceTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('currentValue')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  const filtered = activeSymbol
    ? data.filter((r) => r.symbolCode === activeSymbol)
    : data

  const sorted = [...filtered].sort((a, b) => {
    const av = a[sortKey] ?? (sortDir === 'asc' ? Infinity : -Infinity)
    const bv = b[sortKey] ?? (sortDir === 'asc' ? Infinity : -Infinity)
    if (typeof av === 'string' && typeof bv === 'string') {
      return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
    }
    const an = Number(av)
    const bn = Number(bv)
    return sortDir === 'asc' ? an - bn : bn - an
  })

  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col) return <ChevronUp className="size-3 opacity-30" />
    return sortDir === 'asc'
      ? <ChevronUp className="size-3" />
      : <ChevronDown className="size-3" />
  }

  function ColHeader({ col, label, right }: { col: SortKey; label: string; right?: boolean }) {
    return (
      <th
        className={cn(
          'pb-2 text-xs font-medium cursor-pointer select-none whitespace-nowrap',
          right ? 'text-right' : 'text-left'
        )}
        style={{ color: 'var(--color-fg-secondary)' }}
        onClick={() => handleSort(col)}
      >
        <span className="inline-flex items-center gap-1">
          {label}
          <SortIcon col={col} />
        </span>
      </th>
    )
  }

  function MonoCell({ value, pct }: { value: number; pct?: boolean }) {
    const color = pct !== undefined || value !== undefined
      ? value >= 0
        ? 'var(--color-positive)'
        : 'var(--color-negative)'
      : 'var(--color-fg-primary)'
    return (
      <td className="py-2.5 text-right">
        <span className="font-mono text-sm" style={{ color }}>
          {pct ? formatPct(value, { showSign: true }) : formatCurrency(value, displayCurrency)}
        </span>
      </td>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          Asset Performance
          {activeSymbol && (
            <span
              className="ml-2 text-sm font-normal px-2 py-0.5 rounded-full"
              style={{ background: 'var(--color-accent-subtle)', color: 'var(--color-accent)' }}
            >
              {activeSymbol}
            </span>
          )}
        </CardTitle>
        {activeSymbol && onClearFilter && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearFilter}
            className="min-h-[36px]"
            style={{ color: 'var(--color-fg-secondary)' }}
          >
            <X className="size-4 mr-1" />
            Clear
          </Button>
        )}
      </CardHeader>

      {sorted.length === 0 ? (
        <EmptyState icon={BarChart2} message="No assets yet" />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px]">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                <ColHeader col="symbolCode"   label="Symbol" />
                <ColHeader col="amount"       label="Amount"        right />
                <ColHeader col="currentValue" label="Current Value" right />
                <ColHeader col="costBasis"    label="Cost Basis"    right />
                <ColHeader col="gainLossAmount" label="G/L"         right />
                <ColHeader col="gainLossPct"  label="G/L %"         right />
                <ColHeader col="cagrValue"    label="CAGR"          right />
              </tr>
            </thead>
            <tbody>
              {sorted.map((row) => (
                <tr
                  key={row.assetId}
                  style={{ borderBottom: '1px solid var(--color-border)' }}
                  className="transition-colors"
                >
                  {/* Symbol + account */}
                  <td className="py-2.5 pr-4">
                    <div>
                      <p className="text-sm font-medium" style={{ color: 'var(--color-fg-primary)' }}>
                        {row.symbolCode}
                      </p>
                      <p className="text-xs" style={{ color: 'var(--color-fg-secondary)' }}>
                        {row.accountName}
                      </p>
                    </div>
                  </td>

                  {/* Amount */}
                  <td className="py-2.5 text-right">
                    <span className="font-mono text-sm" style={{ color: 'var(--color-fg-primary)' }}>
                      {row.amount.toLocaleString('en-US', { maximumFractionDigits: 6 })}
                    </span>
                  </td>

                  {/* Current value */}
                  <td className="py-2.5 text-right">
                    <span className="font-mono text-sm" style={{ color: 'var(--color-fg-primary)' }}>
                      {formatCurrency(row.currentValue, displayCurrency)}
                    </span>
                  </td>

                  {/* Cost basis */}
                  <td className="py-2.5 text-right">
                    <span className="font-mono text-sm" style={{ color: 'var(--color-fg-secondary)' }}>
                      {row.costBasis != null
                        ? formatCurrency(row.costBasis, displayCurrency)
                        : '—'}
                    </span>
                  </td>

                  {/* G/L amount */}
                  <td className="py-2.5 text-right">
                    {row.gainLossAmount != null ? (
                      <span
                        className="font-mono text-sm"
                        style={{ color: row.gainLossAmount >= 0 ? 'var(--color-positive)' : 'var(--color-negative)' }}
                      >
                        {row.gainLossAmount >= 0 ? '+' : ''}
                        {formatCurrency(row.gainLossAmount, displayCurrency)}
                      </span>
                    ) : (
                      <span className="font-mono text-sm" style={{ color: 'var(--color-fg-disabled)' }}>—</span>
                    )}
                  </td>

                  {/* G/L % */}
                  <td className="py-2.5 text-right">
                    {row.gainLossPct != null ? (
                      <span
                        className="font-mono text-sm"
                        style={{ color: row.gainLossPct >= 0 ? 'var(--color-positive)' : 'var(--color-negative)' }}
                      >
                        {formatPct(row.gainLossPct, { showSign: true })}
                      </span>
                    ) : (
                      <span className="font-mono text-sm" style={{ color: 'var(--color-fg-disabled)' }}>—</span>
                    )}
                  </td>

                  {/* CAGR */}
                  <td className="py-2.5 text-right">
                    <span
                      className="font-mono text-sm"
                      style={{
                        color: row.cagrValue == null
                          ? 'var(--color-fg-disabled)'
                          : row.cagrValue >= 0
                          ? 'var(--color-positive)'
                          : 'var(--color-negative)',
                      }}
                    >
                      {formatCagr(row.cagrValue)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}
