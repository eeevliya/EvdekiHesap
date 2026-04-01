'use client'

import { useState, useTransition } from 'react'
import { triggerManualSnapshot, getSnapshotAssets } from '@/lib/actions/snapshots'
import type { SnapshotAssetDetail } from '@/lib/actions/snapshots'
import { useRouter } from 'next/navigation'

interface SnapshotRow {
  id: string
  takenAt: string
  trigger: 'scheduled' | 'manual'
  netWorthTry: number | null
  netWorthUsd: number | null
  netWorthEur: number | null
}

interface Props {
  householdId: string
  displayCurrency: string
  snapshots: SnapshotRow[]
}

function fmt(value: number | null, currency: string): string {
  if (value == null) return '—'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

function fmtAmount(value: number): string {
  // Show up to 8 decimal places but trim trailing zeros
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 8,
  }).format(value)
}

// ─── Asset detail sub-table ───────────────────────────────────────────────────

function AssetDetailTable({
  assets,
  loading,
  error,
}: {
  assets: SnapshotAssetDetail[] | null
  loading: boolean
  error: string | null
}) {
  if (loading) {
    return (
      <tr>
        <td colSpan={6} style={{ padding: '12px 24px', color: '#6b7280', fontSize: 13, fontStyle: 'italic' }}>
          Loading assets…
        </td>
      </tr>
    )
  }

  if (error) {
    return (
      <tr>
        <td colSpan={6} style={{ padding: '12px 24px', color: '#dc2626', fontSize: 13 }}>
          {error}
        </td>
      </tr>
    )
  }

  if (!assets || assets.length === 0) {
    return (
      <tr>
        <td colSpan={6} style={{ padding: '12px 24px', color: '#6b7280', fontSize: 13 }}>
          No asset data recorded for this snapshot.
        </td>
      </tr>
    )
  }

  return (
    <tr>
      <td colSpan={6} style={{ padding: 0 }}>
        <div style={{ background: '#f8fafc', borderTop: '1px solid #e5e7eb', borderBottom: '1px solid #e5e7eb' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                <th style={{ textAlign: 'left', padding: '6px 12px 6px 40px', color: '#9ca3af', fontWeight: 600 }}>
                  Symbol
                </th>
                <th style={{ textAlign: 'left', padding: '6px 12px', color: '#9ca3af', fontWeight: 600 }}>
                  Type
                </th>
                <th style={{ textAlign: 'right', padding: '6px 12px', color: '#9ca3af', fontWeight: 600 }}>
                  Amount
                </th>
                <th style={{ textAlign: 'right', padding: '6px 12px', color: '#9ca3af', fontWeight: 600 }}>
                  Value (TRY)
                </th>
                <th style={{ textAlign: 'right', padding: '6px 12px', color: '#9ca3af', fontWeight: 600 }}>
                  Value (USD)
                </th>
                <th style={{ textAlign: 'right', padding: '6px 12px', color: '#9ca3af', fontWeight: 600 }}>
                  Value (EUR)
                </th>
              </tr>
            </thead>
            <tbody>
              {assets.map((a) => (
                <tr key={a.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '7px 12px 7px 40px', color: '#111827', fontWeight: 600 }}>
                    {a.symbolCode}
                    {a.symbolName && (
                      <span style={{ fontWeight: 400, color: '#6b7280', marginLeft: 6 }}>{a.symbolName}</span>
                    )}
                  </td>
                  <td style={{ padding: '7px 12px', color: '#6b7280' }}>
                    {a.symbolType.replace('_', ' ')}
                  </td>
                  <td style={{ padding: '7px 12px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#374151' }}>
                    {fmtAmount(a.amount)}
                  </td>
                  <td style={{ padding: '7px 12px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#374151' }}>
                    {fmt(a.valueTry, 'TRY')}
                  </td>
                  <td style={{ padding: '7px 12px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#374151' }}>
                    {fmt(a.valueUsd, 'USD')}
                  </td>
                  <td style={{ padding: '7px 12px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#374151' }}>
                    {fmt(a.valueEur, 'EUR')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </td>
    </tr>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function SnapshotHistory({ householdId, displayCurrency, snapshots }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [lastResult, setLastResult] = useState<string | null>(null)

  // Expanded snapshot IDs
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  // Cached asset detail per snapshot ID
  const [assetCache, setAssetCache] = useState<Map<string, SnapshotAssetDetail[]>>(new Map())
  // Loading state per snapshot ID
  const [loadingId, setLoadingId] = useState<string | null>(null)
  // Per-snapshot fetch error
  const [fetchError, setFetchError] = useState<Map<string, string>>(new Map())

  async function toggleExpand(snapshotId: string) {
    if (expanded.has(snapshotId)) {
      setExpanded((prev) => { const next = new Set(prev); next.delete(snapshotId); return next })
      return
    }

    setExpanded((prev) => new Set(prev).add(snapshotId))

    // Already cached — no fetch needed
    if (assetCache.has(snapshotId)) return

    setLoadingId(snapshotId)
    const result = await getSnapshotAssets(snapshotId)
    setLoadingId(null)

    if (result.success) {
      setAssetCache((prev) => new Map(prev).set(snapshotId, result.data))
    } else {
      setFetchError((prev) => new Map(prev).set(snapshotId, result.error))
    }
  }

  function handleTakeSnapshot() {
    setError(null)
    setLastResult(null)
    startTransition(async () => {
      const result = await triggerManualSnapshot(householdId)
      if (result.success) {
        const snap = result.data
        const worth =
          displayCurrency === 'USD'
            ? fmt(snap.netWorthUsd, 'USD')
            : displayCurrency === 'EUR'
              ? fmt(snap.netWorthEur, 'EUR')
              : fmt(snap.netWorthTry, 'TRY')
        setLastResult(`Snapshot taken. Net worth: ${worth}`)
        router.refresh()
      } else {
        setError(result.error)
      }
    })
  }

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '24px 16px', fontFamily: 'sans-serif' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Snapshot History</h1>
          <p style={{ color: '#6b7280', marginTop: 4, marginBottom: 0, fontSize: 14 }}>
            Portfolio net worth snapshots. Scheduled every 6 hours; trigger manually below. Click a row to expand assets.
          </p>
        </div>
        <button
          onClick={handleTakeSnapshot}
          disabled={isPending}
          style={{
            background: isPending ? '#9ca3af' : '#2563eb',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            padding: '10px 18px',
            fontSize: 14,
            fontWeight: 600,
            cursor: isPending ? 'not-allowed' : 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          {isPending ? 'Taking snapshot…' : 'Take Snapshot Now'}
        </button>
      </div>

      {error && (
        <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 6, padding: '10px 14px', color: '#dc2626', marginBottom: 16, fontSize: 14 }}>
          {error}
        </div>
      )}

      {lastResult && (
        <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 6, padding: '10px 14px', color: '#16a34a', marginBottom: 16, fontSize: 14 }}>
          {lastResult}
        </div>
      )}

      {snapshots.length === 0 ? (
        <p style={{ color: '#6b7280', fontSize: 14 }}>
          No snapshots yet. Click &ldquo;Take Snapshot Now&rdquo; to create one.
        </p>
      ) : (
        <div style={{ overflowX: 'auto', border: '1px solid #e5e7eb', borderRadius: 8 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e5e7eb', background: '#f9fafb' }}>
                <th style={{ textAlign: 'left', padding: '10px 12px', color: '#6b7280', fontWeight: 600, width: 28 }} />
                <th style={{ textAlign: 'left', padding: '10px 12px', color: '#6b7280', fontWeight: 600 }}>Taken At</th>
                <th style={{ textAlign: 'left', padding: '10px 12px', color: '#6b7280', fontWeight: 600 }}>Trigger</th>
                <th style={{ textAlign: 'right', padding: '10px 12px', color: '#6b7280', fontWeight: 600 }}>Net Worth (TRY)</th>
                <th style={{ textAlign: 'right', padding: '10px 12px', color: '#6b7280', fontWeight: 600 }}>Net Worth (USD)</th>
                <th style={{ textAlign: 'right', padding: '10px 12px', color: '#6b7280', fontWeight: 600 }}>Net Worth (EUR)</th>
              </tr>
            </thead>
            <tbody>
              {snapshots.map((snap) => {
                const isExpanded = expanded.has(snap.id)
                const isLoading = loadingId === snap.id
                return (
                  <>
                    <tr
                      key={snap.id}
                      onClick={() => toggleExpand(snap.id)}
                      style={{
                        borderBottom: isExpanded ? 'none' : '1px solid #f3f4f6',
                        cursor: 'pointer',
                        background: isExpanded ? '#eff6ff' : '#fff',
                        transition: 'background 0.1s',
                      }}
                    >
                      <td style={{ padding: '10px 12px', color: '#9ca3af', fontSize: 12, userSelect: 'none' }}>
                        {isLoading ? '…' : isExpanded ? '▾' : '▸'}
                      </td>
                      <td style={{ padding: '10px 12px', color: '#111827' }}>{fmtDate(snap.takenAt)}</td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{
                          display: 'inline-block',
                          padding: '2px 8px',
                          borderRadius: 12,
                          fontSize: 12,
                          fontWeight: 600,
                          background: snap.trigger === 'manual' ? '#dbeafe' : '#f0fdf4',
                          color: snap.trigger === 'manual' ? '#1d4ed8' : '#15803d',
                        }}>
                          {snap.trigger}
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                        {fmt(snap.netWorthTry, 'TRY')}
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                        {fmt(snap.netWorthUsd, 'USD')}
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                        {fmt(snap.netWorthEur, 'EUR')}
                      </td>
                    </tr>
                    {isExpanded && (
                      <AssetDetailTable
                        assets={assetCache.get(snap.id) ?? null}
                        loading={isLoading}
                        error={fetchError.get(snap.id) ?? null}
                      />
                    )}
                  </>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
