'use client'

import { NetWorthCard } from './net-worth-card'
import { AssetBreakdownChart } from './asset-breakdown-chart'
import { PerformanceChart } from './performance-chart'
import { PerformanceCard } from './performance-card'
import { AccountsPeekCard } from './accounts-peek-card'
import { TransactionsPeekCard } from './transactions-peek-card'
import { RatesPeekCard } from './rates-peek-card'
import type { DashboardData } from '@/lib/actions/dashboard'

interface DashboardClientProps {
  data: DashboardData
}

/**
 * Fixed dashboard layout — no drag-and-drop.
 *
 * Mobile (1 col):  NW → Performance → Asset Breakdown → Chart → Accounts → Transactions → Rates
 * md     (2 col):  Col1=NW+Perf | Col2=AssetBreakdown+Chart; peek cards below
 * xl     (3 col):  Col1=NW+Perf | Col2=AssetBreakdown | Col3=Chart; peek cards in row 2 cols 1-3
 */
export function DashboardClient({ data }: DashboardClientProps) {
  return (
    <div className="grid gap-5 items-start grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
      {/* ── Column 1 ── */}
      <div className="flex flex-col gap-5">
        <NetWorthCard
          data={data.netWorth}
          householdId={data.householdId}
        />
        <PerformanceCard
          data={data.performance}
          displayCurrency={data.netWorth.displayCurrency}
        />
      </div>

      {/* ── Columns 2 (and 3 on xl) ──
          On md: this wrapper is a single grid item — AB and Chart stack inside
                 it with no row-height gap between them.
          On xl: xl:contents dissolves the wrapper so AB and Chart become
                 direct grid children and land in cols 2 and 3 respectively. */}
      <div className="flex flex-col gap-5 xl:contents">
        <AssetBreakdownChart
          data={data.assetBreakdown}
          displayCurrency={data.netWorth.displayCurrency}
        />
        <div className="xl:col-start-3 xl:row-start-1">
          <PerformanceChart
            data={data.chartData}
            chartSymbols={data.chartSymbols}
            displayCurrency={data.netWorth.displayCurrency}
          />
        </div>
      </div>

      {/* ── Peek cards — row 2 on xl (cols 1-3), flow naturally on md/mobile ── */}
      <AccountsPeekCard
        accounts={data.peekAccounts}
        displayCurrency={data.netWorth.displayCurrency}
      />
      <TransactionsPeekCard transactions={data.peekTransactions} />
      <RatesPeekCard rates={data.peekRates} />
    </div>
  )
}
