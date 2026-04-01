'use client'

import { useState, useTransition } from 'react'
import { triggerManualSnapshot } from '@/lib/actions/snapshots'
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

export default function SnapshotHistory({ householdId, displayCurrency, snapshots }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [lastResult, setLastResult] = useState<string | null>(null)

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
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px 16px', fontFamily: 'sans-serif' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Snapshot History</h1>
          <p style={{ color: '#6b7280', marginTop: 4, marginBottom: 0, fontSize: 14 }}>
            Portfolio net worth snapshots. Scheduled every 6 hours; trigger manually below.
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
        <div
          style={{
            background: '#fef2f2',
            border: '1px solid #fca5a5',
            borderRadius: 6,
            padding: '10px 14px',
            color: '#dc2626',
            marginBottom: 16,
            fontSize: 14,
          }}
        >
          {error}
        </div>
      )}

      {lastResult && (
        <div
          style={{
            background: '#f0fdf4',
            border: '1px solid #86efac',
            borderRadius: 6,
            padding: '10px 14px',
            color: '#16a34a',
            marginBottom: 16,
            fontSize: 14,
          }}
        >
          {lastResult}
        </div>
      )}

      {snapshots.length === 0 ? (
        <p style={{ color: '#6b7280', fontSize: 14 }}>
          No snapshots yet. Click &ldquo;Take Snapshot Now&rdquo; to create one.
        </p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                <th style={{ textAlign: 'left', padding: '8px 12px', color: '#6b7280', fontWeight: 600 }}>
                  Taken At
                </th>
                <th style={{ textAlign: 'left', padding: '8px 12px', color: '#6b7280', fontWeight: 600 }}>
                  Trigger
                </th>
                <th style={{ textAlign: 'right', padding: '8px 12px', color: '#6b7280', fontWeight: 600 }}>
                  Net Worth (TRY)
                </th>
                <th style={{ textAlign: 'right', padding: '8px 12px', color: '#6b7280', fontWeight: 600 }}>
                  Net Worth (USD)
                </th>
                <th style={{ textAlign: 'right', padding: '8px 12px', color: '#6b7280', fontWeight: 600 }}>
                  Net Worth (EUR)
                </th>
              </tr>
            </thead>
            <tbody>
              {snapshots.map((snap, i) => (
                <tr
                  key={snap.id}
                  style={{
                    borderBottom: '1px solid #f3f4f6',
                    background: i % 2 === 0 ? '#fff' : '#f9fafb',
                  }}
                >
                  <td style={{ padding: '10px 12px', color: '#111827' }}>{fmtDate(snap.takenAt)}</td>
                  <td style={{ padding: '10px 12px' }}>
                    <span
                      style={{
                        display: 'inline-block',
                        padding: '2px 8px',
                        borderRadius: 12,
                        fontSize: 12,
                        fontWeight: 600,
                        background: snap.trigger === 'manual' ? '#dbeafe' : '#f0fdf4',
                        color: snap.trigger === 'manual' ? '#1d4ed8' : '#15803d',
                      }}
                    >
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
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
