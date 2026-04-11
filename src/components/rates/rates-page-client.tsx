'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { TrendingUp, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/shared/empty-state'
import { RelativeTime } from '@/components/shared/relative-time'
import { RateHistoricalChart } from './rate-historical-chart'
import { ConvertModal } from './convert-modal'
import { getSymbolDetail } from '@/lib/actions/rates'
import { triggerPriceFetch } from '@/lib/actions/prices'
import { formatPct, formatCurrency } from '@/lib/utils/format'
import type { SymbolRateRow, SymbolDetailData, RatesPageData } from '@/lib/actions/rates'
import type { SymbolType } from '@/lib/types/domain'

// Stock codes are stored as full Yahoo Finance tickers (e.g. TTRAK.IS).
// Strip the market suffix for display so users see just the base ticker.
const STOCK_SUFFIXES = ['.IS', '.AS', '.DE', '.HK', '.L', '.MI', '.PA', '.T', '.TO', '.SW']

function displayTicker(code: string, type: SymbolType): string {
  if (type !== 'stock') return code
  const upper = code.toUpperCase()
  // Sort by length descending to match longest suffix first (e.g. .TO before .T)
  const sorted = [...STOCK_SUFFIXES].sort((a, b) => b.length - a.length)
  for (const s of sorted) {
    if (upper.endsWith(s)) return code.slice(0, -s.length)
  }
  return code
}

const TYPE_LABELS: Record<SymbolType, string> = {
  fiat_currency: 'Fiat Currency',
  stock: 'Stock',
  tefas_fund: 'Tefas Fund',
  physical_commodity: 'Commodity',
  cryptocurrency: 'Crypto',
  stablecoin: 'Stablecoin',
  custom: 'Custom',
}

const TYPE_ORDER: SymbolType[] = [
  'fiat_currency', 'stock', 'tefas_fund', 'cryptocurrency', 'stablecoin', 'physical_commodity', 'custom',
]

function formatRate(rate: number | null): string {
  if (rate == null) return '—'
  if (rate >= 1000) return rate.toLocaleString('en-US', { maximumFractionDigits: 2 })
  if (rate >= 1) return rate.toFixed(4)
  return rate.toFixed(8)
}

interface RatesPageClientProps {
  data: RatesPageData
  initialSelectedId: string | null
  isManager: boolean
}

export function RatesPageClient({ data, initialSelectedId, isManager }: RatesPageClientProps) {
  const router = useRouter()
  const [showConvert, setShowConvert] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(
    initialSelectedId ?? (data.symbols.find((s) => s.isActive)?.symbolId ?? null)
  )
  const [detail, setDetail] = useState<SymbolDetailData | null>(null)
  const [detailLoading, startDetailTransition] = useTransition()
  const [collapsedTypes, setCollapsedTypes] = useState<Set<SymbolType>>(new Set())
  const [fetching, startFetchTransition] = useTransition()

  function loadDetail(symbolId: string) {
    setSelectedId(symbolId)
    startDetailTransition(async () => {
      const d = await getSymbolDetail(symbolId)
      setDetail(d)
    })
  }

  function toggleType(type: SymbolType) {
    setCollapsedTypes((prev) => {
      const next = new Set(prev)
      if (next.has(type)) next.delete(type)
      else next.add(type)
      return next
    })
  }

  function handleFetchPrices() {
    startFetchTransition(async () => {
      await triggerPriceFetch()
      router.refresh()
    })
  }

  // Group symbols by type
  const grouped = TYPE_ORDER.reduce<Record<string, SymbolRateRow[]>>((acc, type) => {
    const syms = data.symbols.filter((s) => s.type === type)
    if (syms.length > 0) acc[type] = syms
    return acc
  }, {})

  return (
    <>
      {/* ── Desktop layout ── */}
      <div className="hidden md:flex flex-col h-full">
        {/* Page header */}
        <div className="flex items-center justify-between mb-1">
          <h1 className="text-xl font-semibold" style={{ color: 'var(--color-fg-primary)' }}>
            Rates
          </h1>
          <div className="flex items-center gap-2">
            <button
              onClick={handleFetchPrices}
              disabled={fetching}
              className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium min-h-[44px] transition-opacity disabled:opacity-60"
              style={{
                background: 'var(--color-accent)',
                color: 'var(--color-bg-sidebar)',
                boxShadow: '0 4px 12px oklch(0 0 0 / 0.25)',
              }}
            >
              <RefreshCw className={`size-4 ${fetching ? 'animate-spin' : ''}`} />
              {fetching ? 'Fetching…' : 'Fetch Prices'}
            </button>
            <button
              onClick={() => setShowConvert(true)}
              className="inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-medium min-h-[44px]"
              style={{
                background: 'var(--color-bg-card)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-fg-primary)',
                boxShadow: '0 4px 12px oklch(0 0 0 / 0.15)',
              }}
            >
              Convert
            </button>
            {isManager && (
              <Link
                href="/rates/symbols"
                className="inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-medium min-h-[44px]"
                style={{
                  background: 'var(--color-bg-card)',
                  border: '1px solid var(--color-border)',
                  color: 'var(--color-fg-primary)',
                  boxShadow: '0 4px 12px oklch(0 0 0 / 0.15)',
                }}
              >
                Manage Symbols
              </Link>
            )}
          </div>
        </div>

        {/* Last updated */}
        {data.lastUpdated && (
          <div className="flex items-center gap-1 mb-4">
            <span className="text-xs" style={{ color: 'var(--color-fg-disabled)' }}>Last updated</span>
            <RelativeTime isoString={data.lastUpdated} />
          </div>
        )}

        <div className="flex gap-5 flex-1 min-h-0">
          {/* Symbol list — 35% */}
          <div
            className="w-[35%] shrink-0 rounded-2xl overflow-hidden flex flex-col"
            style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}
          >
            <div className="flex-1 overflow-y-auto">
              {data.symbols.length === 0 ? (
                <EmptyState icon={TrendingUp} message="No symbols available" />
              ) : (
                Object.entries(grouped).map(([type, syms]) => (
                  <div key={type}>
                    {/* Group header */}
                    <button
                      className="w-full flex items-center justify-between px-4 py-2 text-left"
                      style={{
                        borderBottom: '1px solid var(--color-border)',
                        background: 'var(--color-bg-base)',
                      }}
                      onClick={() => toggleType(type as SymbolType)}
                    >
                      <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--color-fg-secondary)' }}>
                        {TYPE_LABELS[type as SymbolType]}
                      </span>
                      <span className="text-xs" style={{ color: 'var(--color-fg-disabled)' }}>
                        {collapsedTypes.has(type as SymbolType) ? '▼' : '▲'}
                      </span>
                    </button>

                    {!collapsedTypes.has(type as SymbolType) && syms
                      // Fiat: hide the symbol that IS the household currency
                      .filter((sym) => !(sym.type === 'fiat_currency' && sym.code === data.displayCurrency))
                      .map((sym) => {
                      const isSelected = sym.symbolId === selectedId

                      // Three-column: non-fiat symbols where PCF differs from HC
                      const showThreeCol = sym.type !== 'fiat_currency'
                        && sym.primaryConversionFiat != null
                        && sym.primaryConversionFiat !== data.displayCurrency

                      // Right column always shows HC rate + HC change
                      const hcPct = sym.hcChange24hPct
                      const hcChangeColor = hcPct == null
                        ? 'var(--color-fg-disabled)'
                        : hcPct >= 0
                        ? 'var(--color-positive)'
                        : 'var(--color-negative)'

                      // physical_commodity symbols (gold) use the name as primary label;
                      // other symbols use the ticker code as primary with name as subtitle.
                      const useNameAsPrimary = sym.type === 'physical_commodity' && !!sym.name
                      const primaryLabel = useNameAsPrimary ? sym.name! : displayTicker(sym.code, sym.type)
                      const subLabel = useNameAsPrimary ? null : sym.name

                      return (
                        <button
                          key={sym.symbolId}
                          className="w-full flex items-center gap-2 px-4 py-3 text-left transition-colors"
                          style={{
                            borderBottom: '1px solid var(--color-border)',
                            borderLeft: isSelected ? '3px solid var(--color-accent)' : '3px solid transparent',
                            background: isSelected ? 'var(--color-accent-subtle)' : undefined,
                          }}
                          onClick={() => loadDetail(sym.symbolId)}
                        >
                          {/* Column 1: symbol info */}
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold" style={{ color: 'var(--color-fg-primary)' }}>
                              {primaryLabel}
                            </p>
                            {subLabel && (
                              <p className="text-xs truncate" style={{ color: 'var(--color-fg-secondary)' }}>
                                {subLabel}
                              </p>
                            )}
                          </div>

                          {/* Column 2 (three-col only): PCF rate + pair label */}
                          {showThreeCol && (
                            <div className="text-right shrink-0 w-20">
                              <p className="font-mono text-xs" style={{ color: 'var(--color-fg-secondary)' }}>
                                {formatRate(sym.currentRate)}
                              </p>
                              <p className="text-xs" style={{ color: 'var(--color-fg-disabled)' }}>
                                {displayTicker(sym.code, sym.type)} / {sym.primaryConversionFiat}
                              </p>
                            </div>
                          )}

                          {/* Column 3 (or column 2 in two-col): HC rate + HC change */}
                          <div className="text-right shrink-0">
                            <p className="font-mono text-sm" style={{ color: 'var(--color-accent)' }}>
                              {formatRate(sym.hcRate)}
                            </p>
                            <p className="font-mono text-xs" style={{ color: hcChangeColor }}>
                              {hcPct == null ? '—' : formatPct(hcPct, { showSign: true })}
                            </p>
                          </div>

                          {sym.fetchedAt && (
                            <div className="shrink-0 hidden xl:block">
                              <RelativeTime isoString={sym.fetchedAt} />
                            </div>
                          )}
                        </button>
                      )
                    })}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Detail panel — 65% */}
          <div
            className="flex-1 min-w-0 rounded-2xl overflow-hidden overflow-y-auto"
            style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}
          >
            {detailLoading ? (
              <div className="flex items-center justify-center h-full p-12">
                <p className="text-sm" style={{ color: 'var(--color-fg-secondary)' }}>Loading…</p>
              </div>
            ) : !selectedId || !detail ? (
              <div className="flex items-center justify-center h-full">
                <EmptyState icon={TrendingUp} message="Select a symbol to view details" />
              </div>
            ) : (
              <SymbolDetailPanel detail={detail} />
            )}
          </div>
        </div>
      </div>

      {/* ── Mobile layout ── */}
      <div className="md:hidden">
        {/* Page header */}
        <div className="flex items-center justify-between mb-1">
          <h1 className="text-xl font-semibold" style={{ color: 'var(--color-fg-primary)' }}>
            Rates
          </h1>
          <div className="flex items-center gap-2">
            <button
              onClick={handleFetchPrices}
              disabled={fetching}
              className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium min-h-[44px] transition-opacity disabled:opacity-60"
              style={{
                background: 'var(--color-accent)',
                color: 'var(--color-bg-sidebar)',
                boxShadow: '0 4px 12px oklch(0 0 0 / 0.25)',
              }}
            >
              <RefreshCw className={`size-4 ${fetching ? 'animate-spin' : ''}`} />
              {fetching ? '…' : 'Fetch'}
            </button>
            <button
              onClick={() => setShowConvert(true)}
              className="inline-flex items-center justify-center rounded-xl px-3 py-2 text-sm font-medium min-h-[44px]"
              style={{
                background: 'var(--color-bg-card)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-fg-primary)',
                boxShadow: '0 4px 12px oklch(0 0 0 / 0.15)',
              }}
            >
              Convert
            </button>
            {isManager && (
              <Link
                href="/rates/symbols"
                className="inline-flex items-center justify-center rounded-xl px-3 py-2 text-sm font-medium min-h-[44px]"
                style={{
                  background: 'var(--color-bg-card)',
                  border: '1px solid var(--color-border)',
                  color: 'var(--color-fg-primary)',
                  boxShadow: '0 4px 12px oklch(0 0 0 / 0.15)',
                }}
              >
                Manage
              </Link>
            )}
          </div>
        </div>

        {/* Last updated */}
        {data.lastUpdated && (
          <div className="flex items-center gap-1 mb-4">
            <span className="text-xs" style={{ color: 'var(--color-fg-disabled)' }}>Last updated</span>
            <RelativeTime isoString={data.lastUpdated} />
          </div>
        )}

        {data.symbols.length === 0 ? (
          <EmptyState icon={TrendingUp} message="No symbols available" />
        ) : (
          <div className="space-y-2">
            {data.symbols.filter((s) => s.isActive).map((sym) => (
              <MobileSymbolCard key={sym.symbolId} sym={sym} />
            ))}
          </div>
        )}
      </div>

      {/* Convert modal */}
      <ConvertModal
        open={showConvert}
        onClose={() => setShowConvert(false)}
        symbols={data.symbols}
      />
    </>
  )
}

// ─── Desktop symbol detail panel ──────────────────────────────────────────────

function SymbolDetailPanel({ detail }: { detail: SymbolDetailData }) {
  const hasIndicator = detail.change24h != null || detail.change7d != null ||
    detail.change1m != null || detail.change1y != null

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold" style={{ color: 'var(--color-fg-primary)' }}>
            {detail.type === 'physical_commodity' && detail.name ? detail.name : displayTicker(detail.code, detail.type)}
          </h2>
          {detail.type !== 'physical_commodity' && detail.name && (
            <p className="text-sm mt-0.5" style={{ color: 'var(--color-fg-secondary)' }}>
              {detail.name}
            </p>
          )}
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold font-mono" style={{ color: 'var(--color-accent)' }}>
            {formatRate(detail.currentRate)}
          </p>
          {detail.fetchedAt && (
            <div className="flex items-center justify-end gap-1 mt-0.5">
              <span className="text-xs" style={{ color: 'var(--color-fg-disabled)' }}>Updated</span>
              <RelativeTime isoString={detail.fetchedAt} />
            </div>
          )}
        </div>
      </div>

      {/* Change indicators */}
      {hasIndicator && (
        <div
          className="grid grid-cols-4 gap-4 pt-4"
          style={{ borderTop: '1px solid var(--color-border)' }}
        >
          <ChangeIndicator label="24h" pct={detail.change24h} />
          <ChangeIndicator label="1W" pct={detail.change7d} />
          <ChangeIndicator label="1M" pct={detail.change1m} />
          <ChangeIndicator label="1Y" pct={detail.change1y} />
        </div>
      )}

      {/* Historical chart */}
      <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '1.5rem' }}>
        <RateHistoricalChart history={detail.history} quoteCurrency={detail.quoteCurrency} />
      </div>

      {/* Assets section */}
      <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '1.5rem' }}>
        <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--color-fg-primary)' }}>
          Your assets in {displayTicker(detail.code, detail.type)}
        </h3>
        {detail.assets.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--color-fg-secondary)' }}>
            No assets using this symbol
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                <th className="text-left pb-2 font-medium" style={{ color: 'var(--color-fg-secondary)' }}>Account</th>
                <th className="text-right pb-2 font-medium" style={{ color: 'var(--color-fg-secondary)' }}>Amount</th>
                <th className="text-right pb-2 font-medium" style={{ color: 'var(--color-fg-secondary)' }}>Current Value</th>
                <th className="text-right pb-2 font-medium" style={{ color: 'var(--color-fg-secondary)' }}>G/L</th>
              </tr>
            </thead>
            <tbody>
              {detail.assets.map((asset) => {
                const glColor = asset.gainLossAmount == null
                  ? 'var(--color-fg-secondary)'
                  : asset.gainLossAmount >= 0
                  ? 'var(--color-positive)'
                  : 'var(--color-negative)'

                return (
                  <tr key={asset.assetId} style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <td className="py-2.5" style={{ color: 'var(--color-fg-primary)' }}>
                      {asset.accountName}
                    </td>
                    <td className="py-2.5 text-right font-mono" style={{ color: 'var(--color-fg-primary)' }}>
                      {asset.amount.toLocaleString('en-US', { maximumFractionDigits: 8 })}
                    </td>
                    <td className="py-2.5 text-right font-mono" style={{ color: 'var(--color-accent)' }}>
                      {asset.currentValue != null
                        ? formatCurrency(asset.currentValue, detail.displayCurrency)
                        : '—'}
                    </td>
                    <td className="py-2.5 text-right font-mono" style={{ color: glColor }}>
                      {asset.gainLossAmount == null ? '—' : (
                        <>
                          {asset.gainLossAmount >= 0 ? '+' : ''}
                          {formatCurrency(asset.gainLossAmount, detail.displayCurrency)}
                          {asset.gainLossPct != null && (
                            <span className="text-xs ml-1">
                              ({formatPct(asset.gainLossPct, { showSign: true })})
                            </span>
                          )}
                        </>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

// ─── Mobile symbol card ───────────────────────────────────────────────────────

function MobileSymbolCard({ sym }: { sym: SymbolRateRow }) {
  const [isExpanded, setIsExpanded] = useState(false)
  const pct = sym.change24hPct
  const changeColor = pct == null
    ? 'var(--color-fg-disabled)'
    : pct >= 0
    ? 'var(--color-positive)'
    : 'var(--color-negative)'

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}
    >
      <button
        className="w-full flex items-center justify-between px-4 py-3 text-left min-h-[60px]"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="min-w-0 flex-1">
          {(() => {
            const useNameAsPrimary = sym.type === 'physical_commodity' && !!sym.name
            return (
              <>
                <p className="font-semibold text-sm" style={{ color: 'var(--color-fg-primary)' }}>
                  {useNameAsPrimary ? sym.name : displayTicker(sym.code, sym.type)}
                </p>
                {!useNameAsPrimary && sym.name && (
                  <p className="text-xs" style={{ color: 'var(--color-fg-secondary)' }}>
                    {sym.name}
                  </p>
                )}
              </>
            )
          })()}
        </div>
        <div className="text-right">
          <p className="font-mono text-sm" style={{ color: 'var(--color-fg-primary)' }}>
            {formatRate(sym.currentRate)}
          </p>
          <p className="font-mono text-xs" style={{ color: changeColor }}>
            {pct == null ? '—' : formatPct(pct, { showSign: true })}
          </p>
        </div>
      </button>

      {isExpanded && (
        <div
          className="px-4 pb-3 pt-2 space-y-3"
          style={{ borderTop: '1px solid var(--color-border)' }}
        >
          <div className="grid grid-cols-4 gap-2">
            <ChangeIndicator label="24h" pct={sym.change24hPct} />
          </div>
          {sym.fetchedAt && (
            <div className="flex items-center gap-1">
              <span className="text-xs" style={{ color: 'var(--color-fg-disabled)' }}>Updated</span>
              <RelativeTime isoString={sym.fetchedAt} />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function ChangeIndicator({ label, pct }: { label: string; pct: number | null }) {
  if (pct == null) return (
    <div className="flex flex-col items-center gap-0.5">
      <span className="text-xs" style={{ color: 'var(--color-fg-secondary)' }}>{label}</span>
      <span className="font-mono text-sm" style={{ color: 'var(--color-fg-disabled)' }}>—</span>
    </div>
  )
  const color = pct >= 0 ? 'var(--color-positive)' : 'var(--color-negative)'
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className="text-xs" style={{ color: 'var(--color-fg-secondary)' }}>{label}</span>
      <span className="font-mono text-sm font-semibold" style={{ color }}>
        {formatPct(pct, { showSign: true })}
      </span>
    </div>
  )
}
