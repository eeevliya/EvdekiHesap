'use client'

import { useState, useTransition } from 'react'
import { triggerPriceFetch } from '@/lib/actions/prices'

interface SymbolRow {
  id: string
  code: string
  name: string | null
  type: string
  latestRate: { rate: number; fetched_at: string; source: string | null } | null
  lastLog: { status: string; message: string | null; fetched_at: string } | null
}

interface Props {
  rows: SymbolRow[]
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', {
    dateStyle: 'short',
    timeStyle: 'short',
  })
}

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

export default function PriceStatusWidget({ rows }: Props) {
  const [isPending, startTransition] = useTransition()
  const [message, setMessage] = useState<string | null>(null)
  const [localRows, setLocalRows] = useState(rows)

  function handleRefresh() {
    setMessage(null)
    startTransition(async () => {
      const result = await triggerPriceFetch()
      if (result.success) {
        setMessage(
          `Refresh complete — ${result.data.success} updated, ${result.data.error} errors, ${result.data.skipped} skipped.`
        )
        // Reload page data (Server Component re-render on revalidatePath)
        window.location.reload()
      } else {
        setMessage(`Error: ${result.error}`)
      }
    })
  }

  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', maxWidth: 900, margin: '40px auto', padding: '0 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, margin: 0 }}>Price Fetch Status</h1>
          <p style={{ color: '#6b7280', marginTop: 4, marginBottom: 0, fontSize: 14 }}>
            Last fetched time, source, and last error per active symbol.
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

      {message && (
        <div
          style={{
            padding: '10px 14px',
            borderRadius: 6,
            marginBottom: 20,
            background: message.startsWith('Error') ? '#fee2e2' : '#dcfce7',
            color: message.startsWith('Error') ? '#991b1b' : '#166534',
            fontSize: 14,
          }}
        >
          {message}
        </div>
      )}

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ borderBottom: '2px solid #e5e7eb', textAlign: 'left' }}>
            <th style={{ padding: '8px 12px', color: '#6b7280', fontWeight: 600 }}>Symbol</th>
            <th style={{ padding: '8px 12px', color: '#6b7280', fontWeight: 600 }}>Type</th>
            <th style={{ padding: '8px 12px', color: '#6b7280', fontWeight: 600 }}>Latest Rate</th>
            <th style={{ padding: '8px 12px', color: '#6b7280', fontWeight: 600 }}>Source</th>
            <th style={{ padding: '8px 12px', color: '#6b7280', fontWeight: 600 }}>Fetched At</th>
            <th style={{ padding: '8px 12px', color: '#6b7280', fontWeight: 600 }}>Last Status</th>
            <th style={{ padding: '8px 12px', color: '#6b7280', fontWeight: 600 }}>Message</th>
          </tr>
        </thead>
        <tbody>
          {localRows.map((row) => (
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
              <td style={{ padding: '8px 12px' }}>
                {row.latestRate != null ? row.latestRate.rate.toLocaleString('en-US', { maximumFractionDigits: 6 }) : '—'}
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
                  color: '#dc2626',
                  maxWidth: 240,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
                title={row.lastLog?.message ?? undefined}
              >
                {row.lastLog?.status === 'error' ? (row.lastLog.message ?? '—') : '—'}
              </td>
            </tr>
          ))}
          {localRows.length === 0 && (
            <tr>
              <td colSpan={7} style={{ padding: '24px 12px', textAlign: 'center', color: '#9ca3af' }}>
                No active symbols found.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </main>
  )
}
