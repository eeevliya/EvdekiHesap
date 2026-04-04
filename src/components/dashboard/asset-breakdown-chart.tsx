'use client'

import { useState } from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import { Card, CardHeader, CardTitle } from '@/components/shared/card'
import { EmptyState } from '@/components/shared/empty-state'
import { PieChart as PieIcon } from 'lucide-react'
import { formatCurrency, formatPct } from '@/lib/utils/format'
import type { AssetBreakdownSegment } from '@/lib/actions/dashboard'
import type { DisplayCurrency } from '@/lib/types/domain'

const CHART_COLORS = [
  'var(--color-chart-1)',
  'var(--color-chart-2)',
  'var(--color-chart-3)',
  'var(--color-chart-4)',
  'var(--color-chart-5)',
]

// Map symbol codes to stable chart colors
export function symbolColorMap(symbols: string[]): Record<string, string> {
  const map: Record<string, string> = {}
  symbols.forEach((code, i) => {
    map[code] = CHART_COLORS[i % CHART_COLORS.length]
  })
  return map
}

interface AssetBreakdownChartProps {
  data: AssetBreakdownSegment[]
  displayCurrency: DisplayCurrency
  onSegmentClick?: (symbolCode: string | null) => void
  activeSymbol?: string | null
}

export function AssetBreakdownChart({
  data,
  displayCurrency,
  onSegmentClick,
  activeSymbol,
}: AssetBreakdownChartProps) {
  const colorMap = symbolColorMap(data.map((d) => d.symbolCode))

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader><CardTitle>Asset Breakdown</CardTitle></CardHeader>
        <EmptyState icon={PieIcon} message="No assets yet" />
      </Card>
    )
  }

  const chartData = data.map((seg) => ({
    name: seg.symbolCode,
    value: seg.value,
    pct: seg.pct,
    color: colorMap[seg.symbolCode],
  }))

  function handleClick(entry: { name?: string }) {
    if (!onSegmentClick || !entry.name) return
    if (activeSymbol === entry.name) {
      onSegmentClick(null) // deselect
    } else {
      onSegmentClick(entry.name)
    }
  }

  return (
    <Card>
      <CardHeader><CardTitle>Asset Breakdown</CardTitle></CardHeader>

      {/* Donut chart */}
      <div className="h-[200px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null
                const d = payload[0].payload
                return (
                  <div
                    className="rounded-xl px-3 py-2 text-sm"
                    style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-elevated)' }}
                  >
                    <p className="font-semibold" style={{ color: 'var(--color-fg-primary)' }}>{d.name}</p>
                    <p className="font-mono" style={{ color: 'var(--color-fg-secondary)' }}>
                      {formatCurrency(d.value, displayCurrency)} · {formatPct(d.pct, { showSign: false })}
                    </p>
                  </div>
                )
              }}
            />
            <Pie
              data={chartData}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={55}
              outerRadius={85}
              paddingAngle={2}
              strokeWidth={0}
              onClick={handleClick}
              style={{ cursor: onSegmentClick ? 'pointer' : 'default' }}
            >
              {chartData.map((entry) => (
                <Cell
                  key={entry.name}
                  fill={entry.color}
                  opacity={activeSymbol && activeSymbol !== entry.name ? 0.4 : 1}
                />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div className="mt-4 grid grid-cols-2 gap-2">
        {data.map((seg) => (
          <button
            key={seg.symbolCode}
            onClick={() => onSegmentClick?.(activeSymbol === seg.symbolCode ? null : seg.symbolCode)}
            className="flex items-center gap-2 rounded-lg px-2 py-1 text-left transition-colors min-h-[36px]"
            style={{
              background: activeSymbol === seg.symbolCode ? 'var(--color-accent-subtle)' : undefined,
            }}
          >
            <div
              className="size-2.5 shrink-0 rounded-full"
              style={{ background: colorMap[seg.symbolCode] }}
            />
            <div className="min-w-0 flex-1">
              <p className="text-xs truncate" style={{ color: 'var(--color-fg-secondary)' }}>
                {seg.symbolCode}
              </p>
              <p className="text-xs font-mono font-semibold" style={{ color: 'var(--color-fg-primary)' }}>
                {formatPct(seg.pct, { showSign: false })}
              </p>
            </div>
          </button>
        ))}
      </div>
    </Card>
  )
}
