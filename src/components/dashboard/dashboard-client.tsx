'use client'

import { DashboardGrid } from './dashboard-grid'
import { NetWorthCard } from './net-worth-card'
import { AssetBreakdownChart } from './asset-breakdown-chart'
import { PerformanceChart } from './performance-chart'
import { PerformanceCard } from './performance-card'
import type { DashboardData } from '@/lib/actions/dashboard'

interface DashboardClientProps {
  data: DashboardData
}

export function DashboardClient({ data }: DashboardClientProps) {
  const gridItems = [
    {
      id: 'net-worth',
      content: (
        <NetWorthCard
          data={data.netWorth}
          householdId={data.householdId}
        />
      ),
    },
    {
      id: 'asset-breakdown',
      content: (
        <AssetBreakdownChart
          data={data.assetBreakdown}
          displayCurrency={data.netWorth.displayCurrency}
        />
      ),
    },
    {
      id: 'performance-chart',
      content: (
        <PerformanceChart
          data={data.chartData}
          chartSymbols={data.chartSymbols}
          displayCurrency={data.netWorth.displayCurrency}
        />
      ),
    },
    {
      id: 'performance-card',
      content: (
        <PerformanceCard
          data={data.performance}
          displayCurrency={data.netWorth.displayCurrency}
        />
      ),
    },
  ]

  return <DashboardGrid items={gridItems} />
}
