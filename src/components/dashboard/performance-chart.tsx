'use client'

import { useState, useMemo } from 'react'
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceDot,
  Label,
} from 'recharts'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardHeader, CardTitle } from '@/components/shared/card'
import { EmptyState } from '@/components/shared/empty-state'
import { TrendingUp } from 'lucide-react'
import { formatCurrency } from '@/lib/utils/format'
import { symbolColorMap } from './asset-breakdown-chart'
import type { ChartPoint } from '@/lib/actions/dashboard'
import type { DisplayCurrency } from '@/lib/types/domain'

type TimeRange = '1D' | '1W' | '1M' | '1Y'

const RANGE_MS: Record<TimeRange, number> = {
  '1D': 24 * 60 * 60 * 1000,
  '1W': 7  * 24 * 60 * 60 * 1000,
  '1M': 30 * 24 * 60 * 60 * 1000,
  '1Y': 365 * 24 * 60 * 60 * 1000,
}

interface PerformanceChartProps {
  data: ChartPoint[]
  chartSymbols: string[]
  displayCurrency: DisplayCurrency
  className?: string
}

export function PerformanceChart({ data, chartSymbols, displayCurrency, className }: PerformanceChartProps) {
  const [range, setRange] = useState<TimeRange>('1M')
  const colorMap = symbolColorMap(chartSymbols)

  const filtered = useMemo(() => {
    if (data.length === 0) return []
    const cutoff = Date.now() - RANGE_MS[range]
    const points = data.filter((p) => new Date(p.date).getTime() >= cutoff)
    return points.length > 0 ? points : data.slice(-1)
  }, [data, range])

  function formatTick(value: number) {
    const abs = Math.abs(value)
    if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
    if (abs >= 1_000) return `${(value / 1_000).toFixed(0)}K`
    return String(value.toFixed(0))
  }

  const tooltipStyle = {
    background: 'var(--color-bg-card)',
    border: '1px solid var(--color-border)',
    borderRadius: '0.75rem',
    boxShadow: 'var(--shadow-elevated)',
    color: 'var(--color-fg-primary)',
  }

  const axisTickStyle = { fill: 'var(--color-fg-secondary)', fontSize: 11 }

  if (data.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Performance</CardTitle>
        </CardHeader>
        <EmptyState icon={TrendingUp} message="Take a snapshot to start tracking performance" />
      </Card>
    )
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Performance</CardTitle>
        <div className="flex gap-1">
          {(['1D', '1W', '1M', '1Y'] as TimeRange[]).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className="px-2.5 py-1 rounded-lg text-xs font-medium min-h-[32px] transition-colors"
              style={{
                background: range === r ? 'var(--color-accent-subtle)' : undefined,
                color: range === r ? 'var(--color-accent)' : 'var(--color-fg-secondary)',
              }}
            >
              {r}
            </button>
          ))}
        </div>
      </CardHeader>

      <Tabs defaultValue="gainloss">
        <TabsList className="mb-4">
          <TabsTrigger value="gainloss">Gain/Loss</TabsTrigger>
          <TabsTrigger value="networth">Net Worth</TabsTrigger>
        </TabsList>

        {/* Gain/Loss tab — line chart */}
        <TabsContent value="gainloss" className="mt-0">
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={filtered} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="var(--color-border)"
                  vertical={false}
                />
                <XAxis
                  dataKey="date"
                  tickLine={false}
                  axisLine={false}
                  tick={axisTickStyle}
                  tickMargin={8}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tick={axisTickStyle}
                  tickMargin={4}
                  tickFormatter={formatTick}
                  width={55}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(value, name) => [
                    formatCurrency(Number(value ?? 0), displayCurrency),
                    String(name),
                  ]}
                />
                {chartSymbols.map((code) => (
                  <Line
                    key={code}
                    type="monotone"
                    dataKey={`bySymbol.${code}`}
                    name={code}
                    stroke={colorMap[code]}
                    strokeWidth={1.5}
                    dot={false}
                    connectNulls
                  />
                ))}
                <Line
                  type="monotone"
                  dataKey="netWorth"
                  name="Total"
                  stroke="oklch(0.80 0.16 195)"
                  strokeWidth={3}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </TabsContent>

        {/* Net Worth tab — stacked area chart */}
        <TabsContent value="networth" className="mt-0">
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={filtered} margin={{ top: 24, right: 5, left: 0, bottom: 0 }}>
                <defs>
                  {chartSymbols.map((code) => (
                    <linearGradient key={code} id={`nw-grad-${code}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={colorMap[code]} stopOpacity={0.45} />
                      <stop offset="95%" stopColor={colorMap[code]} stopOpacity={0.05} />
                    </linearGradient>
                  ))}
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="var(--color-border)"
                  vertical={false}
                />
                <XAxis
                  dataKey="date"
                  tickLine={false}
                  axisLine={false}
                  tick={axisTickStyle}
                  tickMargin={8}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tick={axisTickStyle}
                  tickMargin={4}
                  tickFormatter={formatTick}
                  width={55}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(value, name) => [
                    formatCurrency(Number(value ?? 0), displayCurrency),
                    String(name),
                  ]}
                />
                {chartSymbols.map((code) => (
                  <Area
                    key={code}
                    type="monotone"
                    dataKey={`bySymbol.${code}`}
                    name={code}
                    stackId="a"
                    stroke={colorMap[code]}
                    fill={`url(#nw-grad-${code})`}
                    strokeWidth={1.5}
                    dot={false}
                  />
                ))}
                {filtered.length > 0 && (() => {
                  const last = filtered[filtered.length - 1]
                  return (
                    <ReferenceDot
                      x={last.date}
                      y={last.netWorth}
                      r={3}
                      fill="var(--color-accent)"
                      stroke="none"
                    >
                      <Label
                        value={formatCurrency(last.netWorth, displayCurrency)}
                        position="top"
                        offset={6}
                        style={{ fontSize: 11, fill: 'var(--color-fg-primary)', fontWeight: 600 }}
                      />
                    </ReferenceDot>
                  )
                })()}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </TabsContent>
      </Tabs>

      {/* Legend */}
      {chartSymbols.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-3">
          <div className="flex items-center gap-1.5">
            <div className="size-2.5 rounded-full" style={{ background: 'var(--color-accent)' }} />
            <span className="text-xs" style={{ color: 'var(--color-fg-secondary)' }}>Total</span>
          </div>
          {chartSymbols.map((code) => (
            <div key={code} className="flex items-center gap-1.5">
              <div className="size-2.5 rounded-full" style={{ background: colorMap[code] }} />
              <span className="text-xs" style={{ color: 'var(--color-fg-secondary)' }}>{code}</span>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}
