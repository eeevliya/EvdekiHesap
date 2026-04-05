'use client'

import { useState, useMemo } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts'
import type { HistoricalRatePoint } from '@/lib/actions/rates'

type Range = '24h' | '1W' | '1M' | '1Y'

const RANGES: { key: Range; label: string; msAgo: number }[] = [
  { key: '24h', label: '24h', msAgo: 24 * 60 * 60 * 1000 },
  { key: '1W',  label: '1W',  msAgo: 7  * 24 * 60 * 60 * 1000 },
  { key: '1M',  label: '1M',  msAgo: 30 * 24 * 60 * 60 * 1000 },
  { key: '1Y',  label: '1Y',  msAgo: 365 * 24 * 60 * 60 * 1000 },
]

interface RateHistoricalChartProps {
  history: HistoricalRatePoint[]  // already downsampled 1Y data
}

function formatChartDate(iso: string, range: Range): string {
  const d = new Date(iso)
  if (range === '24h') {
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
  }
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function formatRate(rate: number): string {
  if (rate >= 1000) return rate.toLocaleString('en-US', { maximumFractionDigits: 2 })
  if (rate >= 1) return rate.toFixed(4)
  return rate.toFixed(8)
}

export function RateHistoricalChart({ history }: RateHistoricalChartProps) {
  const [activeRange, setActiveRange] = useState<Range>('1M')

  // Filter to the active range window (history is full 1Y, we filter client-side)
  const now = Date.now()
  const filtered = useMemo(() => {
    const rangeObj = RANGES.find((r) => r.key === activeRange)!
    const cutoff = now - rangeObj.msAgo
    return history.filter((p) => new Date(p.date).getTime() >= cutoff)
  }, [history, activeRange, now])

  // Determine which range buttons have data
  const availableRanges = useMemo(() => {
    return RANGES.filter(({ msAgo }) => {
      const cutoff = now - msAgo
      return history.some((p) => new Date(p.date).getTime() >= cutoff)
    })
  }, [history, now])

  if (history.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-sm" style={{ color: 'var(--color-fg-secondary)' }}>
          No historical data available
        </p>
      </div>
    )
  }

  return (
    <div>
      {/* Range buttons */}
      <div className="flex gap-2 mb-4">
        {availableRanges.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setActiveRange(key)}
            className="px-3 py-1 rounded-lg text-xs font-medium transition-colors"
            style={{
              background: activeRange === key ? 'var(--color-accent)' : 'var(--color-bg-base)',
              color: activeRange === key ? 'var(--color-bg-sidebar)' : 'var(--color-fg-secondary)',
              border: '1px solid var(--color-border)',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={filtered} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="var(--color-border)"
            vertical={false}
          />
          <XAxis
            dataKey="date"
            tickFormatter={(v) => formatChartDate(v, activeRange)}
            tick={{ fontSize: 11, fill: 'var(--color-fg-secondary)' }}
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            tickFormatter={formatRate}
            tick={{ fontSize: 11, fill: 'var(--color-fg-secondary)' }}
            axisLine={false}
            tickLine={false}
            width={70}
          />
          <Tooltip
            formatter={(value: number) => [formatRate(value), 'Rate']}
            labelFormatter={(label: string) => new Date(label).toLocaleString('en-US', {
              month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
            })}
            contentStyle={{
              background: 'var(--color-bg-card)',
              border: '1px solid var(--color-border)',
              borderRadius: 12,
              fontSize: 12,
            }}
          />
          <Line
            type="monotone"
            dataKey="rate"
            stroke="var(--color-chart-1)"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: 'var(--color-chart-1)' }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
