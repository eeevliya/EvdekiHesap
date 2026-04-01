'use client'

import React, { useState, useTransition } from 'react'
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

// ─── Formatters ───────────────────────────────────────────────────────────────

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
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 8,
  }).format(value)
}

// ─── Account group ────────────────────────────────────────────────────────────

interface AccountGroup {
  accountId: string
  accountName: string
  assets: SnapshotAssetDetail[]
  totalTry: number
  totalUsd: number | null
  totalEur: number | null
}

function groupByAccount(assets: SnapshotAssetDetail[]): AccountGroup[] {
  const map = new Map<string, AccountGroup>()

  for (const a of assets) {
    let group = map.get(a.accountId)
    if (!group) {
      group = { accountId: a.accountId, accountName: a.accountName, assets: [], totalTry: 0, totalUsd: null, totalEur: null }
      map.set(a.accountId, group)
    }
    group.assets.push(a)
    group.totalTry += a.valueTry ?? 0
    if (a.valueUsd != null) group.totalUsd = (group.totalUsd ?? 0) + a.valueUsd
    if (a.valueEur != null) group.totalEur = (group.totalEur ?? 0) + a.valueEur
  }

  // Sort groups by total TRY descending
  return Array.from(map.values()).sort((a, b) => b.totalTry - a.totalTry)
}

// ─── Asset rows ───────────────────────────────────────────────────────────────

function AccountGroupRows({
  group,
  isGroupExpanded,
  onToggle,
}: {
  group: AccountGroup
  isGroupExpanded: boolean
  onToggle: () => void
}) {
  return (
    <>
      {/* Account header row */}
      <tr
        onClick={onToggle}
        style={{ cursor: 'pointer', background: isGroupExpanded ? '#f0f9ff' : '#f8fafc', borderBottom: '1px solid #e5e7eb' }}
      >
        <td style={{ padding: '8px 12px 8px 40px', color: '#6b7280', fontSize: 12, userSelect: 'none', whiteSpace: 'nowrap' }}>
          {isGroupExpanded ? '▾' : '▸'}
        </td>
        <td colSpan={2} style={{ padding: '8px 12px', fontWeight: 600, color: '#374151', fontSize: 13 }}>
          {group.accountName}
        </td>
        <td style={{ padding: '8px 12px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontSize: 13, color: '#374151' }}>
          {fmt(group.totalTry, 'TRY')}
        </td>
        <td style={{ padding: '8px 12px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontSize: 13, color: '#374151' }}>
          {fmt(group.totalUsd, 'USD')}
        </td>
        <td style={{ padding: '8px 12px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontSize: 13, color: '#374151' }}>
          {fmt(group.totalEur, 'EUR')}
        </td>
      </tr>

      {/* Asset rows within this account */}
      {isGroupExpanded && group.assets.map((a) => (
        <tr key={a.id} style={{ borderBottom: '1px solid #f1f5f9', background: '#fff' }}>
          <td style={{ padding: '7px 12px 7px 60px', color: '#374151', fontWeight: 600, fontSize: 13 }} colSpan={1}>
            {a.symbolCode}
          </td>
          <td style={{ padding: '7px 12px', color: '#6b7280', fontSize: 13 }}>
            {a.symbolName ?? ''}
          </td>
          <td style={{ padding: '7px 12px', color: '#6b7280', fontSize: 12 }}>
            {a.symbolType.replace(/_/g, ' ')}
          </td>
          <td style={{ padding: '7px 12px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#374151', fontSize: 13 }}>
            {fmtAmount(a.amount)} → {fmt(a.valueTry, 'TRY')}
          </td>
          <td style={{ padding: '7px 12px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#374151', fontSize: 13 }}>
            {fmt(a.valueUsd, 'USD')}
          </td>
          <td style={{ padding: '7px 12px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#374151', fontSize: 13 }}>
            {fmt(a.valueEur, 'EUR')}
          </td>
        </tr>
      ))}
    </>
  )
}

// ─── Snapshot detail section ──────────────────────────────────────────────────

function SnapshotDetail({
  snapshotId,
  assets,
  loading,
  error,
  expandedGroups,
  onToggleGroup,
}: {
  snapshotId: string
  assets: SnapshotAssetDetail[] | null
  loading: boolean
  error: string | null
  expandedGroups: Set<string>
  onToggleGroup: (accountId: string) => void
}) {
  if (loading) {
    return (
      <tr>
        <td colSpan={6} style={{ padding: '12px 40px', color: '#6b7280', fontSize: 13, fontStyle: 'italic', background: '#f8fafc' }}>
          Loading…
        </td>
      </tr>
    )
  }
  if (error) {
    return (
      <tr>
        <td colSpan={6} style={{ padding: '12px 40px', color: '#dc2626', fontSize: 13, background: '#fef2f2' }}>
          {error}
        </td>
      </tr>
    )
  }
  if (!assets || assets.length === 0) {
    return (
      <tr>
        <td colSpan={6} style={{ padding: '12px 40px', color: '#6b7280', fontSize: 13, background: '#f8fafc' }}>
          No asset data recorded for this snapshot.
        </td>
      </tr>
    )
  }

  const groups = groupByAccount(assets)
  return (
    <>
      {groups.map((group) => (
        <AccountGroupRows
          key={`${snapshotId}-${group.accountId}`}
          group={group}
          isGroupExpanded={expandedGroups.has(group.accountId)}
          onToggle={() => onToggleGroup(group.accountId)}
        />
      ))}
    </>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function SnapshotHistory({ householdId, displayCurrency, snapshots }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [actionError, setActionError] = useState<string | null>(null)
  const [lastResult, setLastResult] = useState<string | null>(null)

  // Which snapshot rows are expanded
  const [expandedSnapshots, setExpandedSnapshots] = useState<Set<string>>(new Set())
  // Cached asset detail per snapshot ID
  const [assetCache, setAssetCache] = useState<Map<string, SnapshotAssetDetail[]>>(new Map())
  // Loading / fetch-error state per snapshot
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [fetchError, setFetchError] = useState<Map<string, string>>(new Map())
  // Which account groups are expanded, keyed by `${snapshotId}:${accountId}`
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())

  async function toggleSnapshot(snapshotId: string) {
    if (expandedSnapshots.has(snapshotId)) {
      setExpandedSnapshots((prev) => { const n = new Set(prev); n.delete(snapshotId); return n })
      return
    }
    setExpandedSnapshots((prev) => new Set(prev).add(snapshotId))
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

  function toggleGroup(snapshotId: string, accountId: string) {
    const key = `${snapshotId}:${accountId}`
    setExpandedGroups((prev) => {
      const n = new Set(prev)
      if (n.has(key)) { n.delete(key) } else { n.add(key) }
      return n
    })
  }

  function handleTakeSnapshot() {
    setActionError(null)
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
        setActionError(result.error)
      }
    })
  }

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '24px 16px', fontFamily: 'sans-serif' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Snapshot History</h1>
          <p style={{ color: '#6b7280', marginTop: 4, marginBottom: 0, fontSize: 14 }}>
            Portfolio net worth snapshots. Scheduled every 6 hours; trigger manually below. Click a row to expand.
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

      {actionError && (
        <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 6, padding: '10px 14px', color: '#dc2626', marginBottom: 16, fontSize: 14 }}>
          {actionError}
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
                const isExpanded = expandedSnapshots.has(snap.id)
                const isLoading = loadingId === snap.id
                const groupsForSnapshot = new Set(
                  Array.from(expandedGroups).filter((k) => k.startsWith(`${snap.id}:`)).map((k) => k.split(':')[1])
                )
                return (
                  <React.Fragment key={snap.id}>
                    {/* Snapshot summary row */}
                    <tr
                      onClick={() => toggleSnapshot(snap.id)}
                      style={{
                        borderBottom: isExpanded ? 'none' : '1px solid #f3f4f6',
                        cursor: 'pointer',
                        background: isExpanded ? '#eff6ff' : '#fff',
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

                    {/* Account groups + asset detail rows */}
                    {isExpanded && (
                      <SnapshotDetail
                        snapshotId={snap.id}
                        assets={assetCache.get(snap.id) ?? null}
                        loading={isLoading}
                        error={fetchError.get(snap.id) ?? null}
                        expandedGroups={groupsForSnapshot}
                        onToggleGroup={(accountId) => toggleGroup(snap.id, accountId)}
                      />
                    )}
                  </React.Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
