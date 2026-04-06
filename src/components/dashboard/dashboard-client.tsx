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
 * md     (2 col):  Col1=NW+AssetBreakdown | Col2=Performance+Chart; peek cards below
 * xl     (3 col):  Col1=NW+AssetBreakdown | Col2=Performance (full height) | Col3=Chart (full height)
 *
 * DOM order matches mobile order. Explicit col/row placement handles the desktop swap
 * where Performance moves to col 2 and Asset Breakdown drops to col 1 row 2.
 */
export function DashboardClient({ data }: DashboardClientProps) {
  return (
    <div className="space-y-5">
      {/* ── Top section: 4 flat items — explicit placement on md/xl ── */}
      <div className="grid gap-5 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
        {/* 1. Net Worth — col 1 row 1 on desktop */}
        <div className="md:col-start-1 md:row-start-1">
          <NetWorthCard
            data={data.netWorth}
            householdId={data.householdId}
          />
        </div>

        {/* 2. Performance — col 2 row 1 on md; col 2 rows 1–2 on xl */}
        <div className="md:col-start-2 md:row-start-1 xl:row-span-2">
          <PerformanceCard
            data={data.performance}
            displayCurrency={data.netWorth.displayCurrency}
            className="h-full"
          />
        </div>

        {/* 3. Asset Breakdown — col 1 row 2 on desktop */}
        <div className="md:col-start-1 md:row-start-2">
          <AssetBreakdownChart
            data={data.assetBreakdown}
            displayCurrency={data.netWorth.displayCurrency}
          />
        </div>

        {/* 4. Performance Chart — col 2 row 2 on md; col 3 rows 1–2 on xl */}
        <div className="md:col-start-2 md:row-start-2 xl:col-start-3 xl:row-start-1 xl:row-span-2 xl:h-full">
          <PerformanceChart
            data={data.chartData}
            chartSymbols={data.chartSymbols}
            displayCurrency={data.netWorth.displayCurrency}
            className="h-full"
          />
        </div>
      </div>

      {/* ── Peek cards — always in their own row directly below the top section ── */}
      <div className="grid gap-5 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
        <AccountsPeekCard
          accounts={data.peekAccounts}
          displayCurrency={data.netWorth.displayCurrency}
        />
        <TransactionsPeekCard transactions={data.peekTransactions} />
        <RatesPeekCard rates={data.peekRates} />
      </div>
    </div>
  )
}
