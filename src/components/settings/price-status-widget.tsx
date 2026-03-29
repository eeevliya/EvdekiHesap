'use client'

import { useState, useTransition } from 'react'
import { triggerPriceFetch } from '@/lib/actions/prices'

interface SymbolRow {
  id: string
  code: string
  name: string | null
  type: string
  /** null for fiat symbols — by convention their stored rate is in TRY */
  primaryConversionFiat: string | null
  latestRate: { rate: number; fetched_at: string; source: string | null } | null
  lastLog: { status: string; message: string | null; fetched_at: string } | null
}

interface Props {
  rows: SymbolRow[]
  /** USD/TRY — how many TRY per 1 USD. null if not yet fetched. */
  usdTryRate: number | null
  /** EUR/TRY — how many TRY per 1 EUR. null if not yet fetched. */
  eurTryRate: number | null
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', {
    dateStyle: 'short',
    timeStyle: 'short',
  })
}

function fmt(value: number | null, decimals = 4): string {
  if (value == null) return '—'
  return value.toLocaleString('en-US', { maximumFractionDigits: decimals })
}

/**
 * Derive TRY / USD / EUR display values from a symbol's stored rate.
 *
 * Convention: fiat symbols have primary_conversion_fiat = null, but their
 * stored rate is in TRY (e.g. USD symbol stores USD/TRY, EUR stores EUR/TRY).
 * All other symbol types use the primary_conversion_fiat column explicitly.
 */
function deriveRates(
  storedRate: number,
  primaryConversionFiat: string | null,
  usdTryRate: number | null,
  eurTryRate: number | null
): { tryVal: number | null; usdVal: number | null; eurVal: number | null } {
  // Treat null (fiat convention) as TRY
  const base = primaryConversionFiat ?? 'TRY'

  if (base === 'TRY') {
    return {
      tryVal: storedRate,
      usdVal: usdTryRate ? storedRate / usdTryRate : null,
      eurVal: eurTryRate ? storedRate / eurTryRate : null,
    }
  }
  if (base === 'USD') {
    return {
      tryVal: usdTryRate ? storedRate * usdTryRate : null,
      usdVal: storedRate,
      eurVal: usdTryRate && eurTryRate ? (storedRate * usdTryRate) / eurTryRate : null,
    }
  }
  if (base === 'EUR') {
    return {
      tryVal: eurTryRate ? storedRate * eurTryRate : null,
      usdVal: eurTryRate && usdTryRate ? (storedRate * eurTryRate) / usdTryRate : null,
      eurVal: storedRate,
    }
  }
  // Unknown base currency — cannot derive
  return { tryVal: null, usdVal: null, eurVal: null }
}

// ── Components ────────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const colours: Record<string, string> = {
    success: '#16a34a',
    error: '#dc2626',
    skipped: '#d97706',
  }
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '1px 8px',
        borderRadius: 9999,
        fontSize: 11,
        fontWeight: 600,
        color: '#fff',
        background: colours[status] ?? '#6b7280',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
      }}
    >
      {status}
    </span>
  )
}

// ── Widget ────────────────────────────────────────────────────────────────────

export default function PriceStatusWidget({ rows, usdTryRate, eurTryRate }: Props) {
  const [isPending, startTransition] = useTransition()
  const [bannerMessage, setBannerMessage] = useState<string | null>(null)

  function handleRefresh() {
    setBannerMessage(null)
    startTransition(async () => {
      const result = await triggerPriceFetch()
      if (result.success) {
        setBannerMessage(
          `Refresh complete — ${result.data.success} updated, ${result.data.error} errors, ${result.data.skipped} skipped.`
        )
        window.location.reload()
      } else {
        setBannerMessage(`Error: ${result.error}`)
      }
    })
  }

  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', maxWidth: 1100, margin: '40px auto', padding: '0 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, margin: 0 }}>Price Fetch Status</h1>
          <p style={{ color: '#6b7280', marginTop: 4, marginBottom: 0, fontSize: 14 }}>
            Last fetched time, source, and status per active symbol.
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={isPending}
          style={{
            padding: '8px 16px',
            background: isPending ? '#93c5fd' : '#2563eb',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            cursor: isPending ? 'not-allowed' : 'pointer',
            fontWeight: 600,
            fontSize: 14,
          }}
        >
          {isPending ? 'Refreshing…' : 'Refresh Now'}
        </button>
      </div>

      {bannerMessage && (
        <div
          style={{
            padding: '10px 14px',
            borderRadius: 6,
            marginBottom: 20,
            background: bannerMessage.startsWith('Error') ? '#fee2e2' : '#dcfce7',
            color: bannerMessage.startsWith('Error') ? '#991b1b' : '#166534',
            fontSize: 14,
          }}
        >
          {bannerMessage}
        </div>
      )}

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ borderBottom: '2px solid #e5e7eb', textAlign: 'left' }}>
            <th style={{ padding: '8px 12px', color: '#6b7280', fontWeight: 600 }}>Symbol</th>
            <th style={{ padding: '8px 12px', color: '#6b7280', fontWeight: 600 }}>Type</th>
            <th style={{ padding: '8px 12px', color: '#6b7280', fontWeight: 600, textAlign: 'right' }}>Rate (TRY)</th>
            <th style={{ padding: '8px 12px', color: '#6b7280', fontWeight: 600, textAlign: 'right' }}>Rate (USD)</th>
            <th style={{ padding: '8px 12px', color: '#6b7280', fontWeight: 600, textAlign: 'right' }}>Rate (EUR)</th>
            <th style={{ padding: '8px 12px', color: '#6b7280', fontWeight: 600 }}>Source</th>
            <th style={{ padding: '8px 12px', color: '#6b7280', fontWeight: 600 }}>Fetched At</th>
            <th style={{ padding: '8px 12px', color: '#6b7280', fontWeight: 600 }}>Last Status</th>
            <th style={{ padding: '8px 12px', color: '#6b7280', fontWeight: 600 }}>Message</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const derived = row.latestRate
              ? deriveRates(row.latestRate.rate, row.primaryConversionFiat, usdTryRate, eurTryRate)
              : null

            const logStatus = row.lastLog?.status
            const showMessage = logStatus === 'error' || logStatus === 'skipped'
            const messageColour = logStatus === 'error' ? '#dc2626' : '#d97706'

            return (
              <tr key={row.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                <td style={{ padding: '8px 12px', fontWeight: 600 }}>
                  {row.code}
                  {row.name && (
                    <span style={{ fontWeight: 400, color: '#6b7280', marginLeft: 6 }}>
                      {row.name}
                    </span>
                  )}
                </td>
                <td style={{ padding: '8px 12px', color: '#6b7280' }}>{row.type}</td>
                <td style={{ padding: '8px 12px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                  {fmt(derived?.tryVal ?? null)}
                </td>
                <td style={{ padding: '8px 12px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                  {fmt(derived?.usdVal ?? null, 6)}
                </td>
                <td style={{ padding: '8px 12px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                  {fmt(derived?.eurVal ?? null, 6)}
                </td>
                <td style={{ padding: '8px 12px', color: '#6b7280' }}>
                  {row.latestRate?.source ?? '—'}
                </td>
                <td style={{ padding: '8px 12px', color: '#6b7280' }}>
                  {row.latestRate ? formatDate(row.latestRate.fetched_at) : '—'}
                </td>
                <td style={{ padding: '8px 12px' }}>
                  {row.lastLog ? <StatusBadge status={row.lastLog.status} /> : '—'}
                </td>
                <td
                  style={{
                    padding: '8px 12px',
                    color: showMessage ? messageColour : '#9ca3af',
                    maxWidth: 260,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                  title={showMessage ? (row.lastLog?.message ?? undefined) : undefined}
                >
                  {showMessage ? (row.lastLog?.message ?? '—') : '—'}
                </td>
              </tr>
            )
          })}
          {rows.length === 0 && (
            <tr>
              <td colSpan={9} style={{ padding: '24px 12px', textAlign: 'center', color: '#9ca3af' }}>
                No active symbols found.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </main>
  )
}
