'use client'

import React, { useState, useMemo } from 'react'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  Rectangle,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts'
import type { HistoricalRatePoint } from '@/lib/actions/rates'

type Range = '1W' | '1M' | '1Y'

const RANGES: { key: Range; label: string; msAgo: number }[] = [
  { key: '1W', label: '1W', msAgo: 7  * 24 * 60 * 60 * 1000 },
  { key: '1M', label: '1M', msAgo: 30 * 24 * 60 * 60 * 1000 },
  { key: '1Y', label: '1Y', msAgo: 365 * 24 * 60 * 60 * 1000 },
]

interface RateHistoricalChartProps {
  history: HistoricalRatePoint[]
  quoteCurrency: string
}

function formatRate(rate: number): string {
  if (rate >= 1000) return rate.toLocaleString('en-US', { maximumFractionDigits: 2 })
  if (rate >= 1) return rate.toFixed(4)
  return rate.toFixed(8)
}

// Parse YYYY-MM-DD safely (avoid UTC-vs-local offset issues)
function parseDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function formatDayLabel(dateStr: string): string {
  return parseDate(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function formatMonthLabel(dateStr: string): string {
  return parseDate(dateStr).toLocaleDateString('en-US', { month: 'short' })
}

// XAxis minor-tick renderer for 1M mode.
// Draws a short line for every day; adds a text label only on the major days.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function make1MTickRenderer(majorDates: Set<string>): (props: any) => React.ReactElement {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return function MonthlyTick({ x, y, payload }: any): React.ReactElement {
    const isMajor = majorDates.has(payload.value as string)
    return (
      <g transform={`translate(${x},${y})`}>
        <line
          x1={0} y1={0} x2={0} y2={isMajor ? 5 : 3}
          stroke="var(--color-border)" strokeWidth={1}
        />
        {isMajor && (
          <text
            x={0} y={14}
            textAnchor="middle"
            fill="var(--color-fg-secondary)"
            fontSize={11}
          >
            {formatDayLabel(payload.value)}
          </text>
        )}
      </g>
    )
  }
}

// Candlestick body: [bottom, top] of open/close range
function barDataKey(entry: HistoricalRatePoint): [number, number] {
  return [Math.min(entry.open, entry.close), Math.max(entry.open, entry.close)]
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CandlestickShape(props: any) {
  // Recharts spreads the entry data onto shape props
  const { x, y, width, height, open, high, low, close, background } = props as {
    x: number; y: number; width: number; height: number
    open: number; high: number; low: number; close: number
    background?: { y: number; height: number }
  }

  const color = open <= close ? 'var(--color-positive)' : 'var(--color-negative)'
  const midX = x + width / 2
  const bodyTop = y
  const bodyBottom = y + Math.max(1, height)
  const bodyHigh = Math.max(open, close)
  const bodyLow = Math.min(open, close)

  // Derive pixel-per-price-unit from the body dimensions.
  // When open === close (doji), high and low are also equal, so wicks are zero-length.
  const bodyPriceSpan = bodyHigh - bodyLow
  const pixPerUnit = bodyPriceSpan > 0 ? Math.max(1, height) / bodyPriceSpan : 0

  const wickTopY = pixPerUnit > 0
    ? bodyTop - (high - bodyHigh) * pixPerUnit
    : bodyTop

  const wickBottomY = pixPerUnit > 0
    ? bodyBottom + (bodyLow - low) * pixPerUnit
    : bodyBottom

  // Clamp wicks to the chart area
  const chartTop = background?.y ?? 0
  const chartBottom = (background?.y ?? 0) + (background?.height ?? 9999)
  const clampedWickTopY = Math.max(chartTop, wickTopY)
  const clampedWickBottomY = Math.min(chartBottom, wickBottomY)

  return (
    <g>
      <line x1={midX} y1={clampedWickTopY} x2={midX} y2={bodyTop} stroke={color} strokeWidth={1.5} />
      <rect x={x} y={bodyTop} width={Math.max(1, width)} height={Math.max(1, height)} fill={color} />
      <line x1={midX} y1={bodyBottom} x2={midX} y2={clampedWickBottomY} stroke={color} strokeWidth={1.5} />
    </g>
  )
}

export function RateHistoricalChart({ history, quoteCurrency }: RateHistoricalChartProps) {
  const [activeRange, setActiveRange] = useState<Range>('1M')

  const now = Date.now()

  const filtered = useMemo(() => {
    const rangeObj = RANGES.find((r) => r.key === activeRange)!
    const cutoff = now - rangeObj.msAgo
    return history.filter((p) => parseDate(p.date).getTime() >= cutoff)
  }, [history, activeRange, now])

  const availableRanges = useMemo(() => {
    return RANGES.filter(({ msAgo }) => {
      const cutoff = now - msAgo
      return history.some((p) => parseDate(p.date).getTime() >= cutoff)
    })
  }, [history, now])

  // Use candlestick if any day has open !== close
  const isCandlestick = useMemo(
    () => filtered.some((p) => p.open !== p.close),
    [filtered],
  )

  // Build all XAxis props per-range so each mode can control tick lines and renderers
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const xAxisProps: Record<string, any> = useMemo(() => {
    const dates = filtered.map((p) => p.date)
    const base = { dataKey: 'date', interval: 0, axisLine: false }

    if (activeRange === '1W') {
      return {
        ...base,
        ticks: dates,
        tickLine: { stroke: 'var(--color-border)', strokeWidth: 1 },
        tick: { fontSize: 11, fill: 'var(--color-fg-secondary)' },
        tickFormatter: formatDayLabel,
      }
    }

    if (activeRange === '1M') {
      const majorDates = new Set(
        dates.filter((d) => { const day = parseDate(d).getDate(); return day === 1 || day === 11 || day === 21 }),
      )
      return {
        ...base,
        ticks: dates,
        tickLine: false,
        tick: make1MTickRenderer(majorDates),
      }
    }

    // 1Y: one tick per month
    const seenMonths = new Set<string>()
    const monthTicks: string[] = []
    for (const d of dates) {
      const ym = d.slice(0, 7)
      if (!seenMonths.has(ym)) { seenMonths.add(ym); monthTicks.push(d) }
    }
    return {
      ...base,
      ticks: monthTicks,
      tickLine: { stroke: 'var(--color-border)', strokeWidth: 1 },
      tick: { fontSize: 11, fill: 'var(--color-fg-secondary)' },
      tickFormatter: formatMonthLabel,
    }
  }, [filtered, activeRange])

  if (history.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-sm" style={{ color: 'var(--color-fg-secondary)' }}>
          No historical data available
        </p>
      </div>
    )
  }

  const yAxisProps = {
    tickFormatter: formatRate,
    width: 72,
    tick: { fontSize: 11, fill: 'var(--color-fg-secondary)' },
    axisLine: false,
    tickLine: false,
    label: {
      value: quoteCurrency,
      position: 'insideTop' as const,
      offset: -4,
      fontSize: 10,
      fill: 'var(--color-fg-secondary)',
    },
  }

  const gridProps = {
    strokeDasharray: '3 3',
    stroke: 'var(--color-border)',
    vertical: false,
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
        {isCandlestick ? (
          <BarChart data={filtered} margin={{ top: 16, right: 4, bottom: 0, left: 0 }}>
            <CartesianGrid {...gridProps} />
            <XAxis {...xAxisProps} />
            <YAxis {...yAxisProps} domain={['dataMin', 'dataMax']} />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null
                const p = payload[0].payload as HistoricalRatePoint
                return (
                  <div
                    style={{
                      background: 'var(--color-bg-card)',
                      border: '1px solid var(--color-border)',
                      borderRadius: 12,
                      fontSize: 12,
                      padding: '8px 12px',
                      color: 'var(--color-fg-primary)',
                    }}
                  >
                    <p style={{ margin: 0, marginBottom: 4, color: 'var(--color-fg-secondary)' }}>
                      {formatDayLabel(p.date)}
                    </p>
                    <p style={{ margin: 0 }}>O: {formatRate(p.open)}</p>
                    <p style={{ margin: 0 }}>H: {formatRate(p.high)}</p>
                    <p style={{ margin: 0 }}>L: {formatRate(p.low)}</p>
                    <p style={{ margin: 0 }}>C: {formatRate(p.close)}</p>
                  </div>
                )
              }}
            />
            <Bar dataKey={barDataKey} shape={<CandlestickShape />} isAnimationActive={false} />
          </BarChart>
        ) : (
          <LineChart data={filtered} margin={{ top: 16, right: 4, bottom: 0, left: 0 }}>
            <CartesianGrid {...gridProps} />
            <XAxis {...xAxisProps} />
            <YAxis {...yAxisProps} />
            <Tooltip
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              formatter={(value: any) => [value != null ? formatRate(Number(value)) : '—', 'Rate']}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              labelFormatter={(label: any) => (typeof label === 'string' ? formatDayLabel(label) : String(label))}
              contentStyle={{
                background: 'var(--color-bg-card)',
                border: '1px solid var(--color-border)',
                borderRadius: 12,
                fontSize: 12,
              }}
            />
            <Line
              type="monotone"
              dataKey="close"
              stroke="var(--color-chart-1)"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: 'var(--color-chart-1)' }}
            />
          </LineChart>
        )}
      </ResponsiveContainer>
    </div>
  )
}
