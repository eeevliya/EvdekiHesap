'use client'

import { useState, useTransition, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronDown, ChevronUp, SlidersHorizontal, ArrowUpDown, ArrowLeftRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { EmptyState } from '@/components/shared/empty-state'
import { updateTransaction, deleteTransaction } from '@/lib/actions/transactions'
import type { TransactionType, EntryMode, DisplayCurrency } from '@/lib/types/domain'
import type { TransactionRow, AssetRef } from '@/app/(private)/transactions/page'
import { formatPct, formatCurrency } from '@/lib/utils/format'

interface TransactionsPageClientProps {
  transactions: TransactionRow[]
  assetOptions: AssetRef[]
  role: 'manager' | 'editor' | 'viewer'
  displayCurrency: DisplayCurrency
  // per-symbol current rates for trade G/L computation
  rateMap: Record<string, number>
  usdRate: number | null
  eurRate: number | null
}

const TYPE_LABELS: Record<TransactionType, string> = {
  deposit: 'Deposit',
  debit: 'Debit',
  transfer: 'Transfer',
  interest: 'Interest',
  trade: 'Trade',
}

const TYPE_COLORS: Record<TransactionType, string> = {
  deposit: 'var(--color-positive)',
  interest: 'var(--color-positive)',
  debit: 'var(--color-negative)',
  transfer: 'var(--color-fg-secondary)',
  trade: 'var(--color-accent)',
}

const TYPE_BG: Record<TransactionType, string> = {
  deposit: 'oklch(from var(--color-positive) l c h / 0.12)',
  interest: 'oklch(from var(--color-positive) l c h / 0.12)',
  debit: 'oklch(from var(--color-negative) l c h / 0.12)',
  transfer: 'var(--color-bg-base)',
  trade: 'var(--color-accent-subtle)',
}

function formatAmount(amount: number | null, decimals = 6): string {
  if (amount == null) return '—'
  return amount.toLocaleString('en-US', { maximumFractionDigits: decimals })
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

function feeSymbol(tx: TransactionRow): string {
  if (tx.feeSide === 'to') return tx.toAsset?.symbolCode ?? ''
  if (tx.feeSide === 'from') return tx.fromAsset?.symbolCode ?? ''
  return ''
}

// ─── Filters state ────────────────────────────────────────────────────────────

interface FilterState {
  dateFrom: string
  dateTo: string
  types: TransactionType[]
  fromAccountIds: string[]
  toAccountIds: string[]
  symbolIds: string[]
  minVolume: string
  maxVolume: string
}

const emptyFilters: FilterState = {
  dateFrom: '',
  dateTo: '',
  types: [],
  fromAccountIds: [],
  toAccountIds: [],
  symbolIds: [],
  minVolume: '',
  maxVolume: '',
}

function filtersActive(f: FilterState): boolean {
  return !!(
    f.dateFrom || f.dateTo ||
    f.types.length || f.fromAccountIds.length || f.toAccountIds.length ||
    f.symbolIds.length || f.minVolume || f.maxVolume
  )
}

// ─── Edit form helpers ────────────────────────────────────────────────────────

interface EditForm {
  date: string
  toAmount: string
  fromAmount: string
  feeAmount: string
  exchangeRate: string
  notes: string
}

function txToEditForm(tx: TransactionRow): EditForm {
  return {
    date: tx.date.slice(0, 16),
    toAmount: tx.toAmount != null ? String(tx.toAmount) : '',
    fromAmount: tx.fromAmount != null ? String(tx.fromAmount) : '',
    feeAmount: tx.feeAmount != null ? String(tx.feeAmount) : '',
    exchangeRate: tx.exchangeRate != null ? String(tx.exchangeRate) : '',
    notes: tx.notes ?? '',
  }
}

function deriveByMode(
  mode: EntryMode | null,
  values: { fromAmount: string; toAmount: string; exchangeRate: string }
): { fromAmount: string; toAmount: string; exchangeRate: string } {
  const next = { ...values }
  const from = parseFloat(next.fromAmount)
  const to = parseFloat(next.toAmount)
  const rate = parseFloat(next.exchangeRate)
  const effectiveMode = mode ?? 'both_amounts'
  if (effectiveMode === 'both_amounts') {
    next.exchangeRate = !isNaN(from) && !isNaN(to) && to > 0 ? (from / to).toFixed(8) : ''
  } else if (effectiveMode === 'to_amount_and_rate') {
    next.fromAmount = !isNaN(to) && !isNaN(rate) ? (to * rate).toFixed(8) : ''
  } else {
    next.toAmount = !isNaN(from) && !isNaN(rate) && rate > 0 ? (from / rate).toFixed(8) : ''
  }
  return next
}

function isTradeFieldLocked(tx: TransactionRow, field: 'fromAmount' | 'toAmount' | 'exchangeRate'): boolean {
  if (tx.type !== 'trade') return false
  const mode = tx.entryMode ?? 'both_amounts'
  if (mode === 'both_amounts') return field === 'exchangeRate'
  if (mode === 'to_amount_and_rate') return field === 'fromAmount'
  return field === 'toAmount'
}

// ─── Sort ─────────────────────────────────────────────────────────────────────

type SortField = 'date' | 'type'
type SortDir = 'asc' | 'desc'

// ─── Main component ───────────────────────────────────────────────────────────

export function TransactionsPageClient({
  transactions,
  assetOptions,
  role,
  displayCurrency,
  rateMap,
  usdRate,
  eurRate,
}: TransactionsPageClientProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const [filters, setFilters] = useState<FilterState>(emptyFilters)
  const [showFilterSheet, setShowFilterSheet] = useState(false)
  const [showSortSheet, setShowSortSheet] = useState(false)
  const [sortField, setSortField] = useState<SortField>('date')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  // Edit/delete
  const [editingTx, setEditingTx] = useState<TransactionRow | null>(null)
  const [editForm, setEditForm] = useState<EditForm | null>(null)
  const [deletingTx, setDeletingTx] = useState<TransactionRow | null>(null)

  const canMutate = role === 'manager' || role === 'editor'

  // Derived account + symbol options
  const accountOptions = useMemo(() => {
    const seen = new Map<string, string>()
    for (const a of assetOptions) {
      if (!seen.has(a.accountId)) seen.set(a.accountId, a.accountName)
    }
    return Array.from(seen.entries()).map(([id, name]) => ({ id, name }))
  }, [assetOptions])

  const symbolOptions = useMemo(() => {
    const seen = new Map<string, string>()
    for (const a of assetOptions) {
      if (!seen.has(a.symbolId)) seen.set(a.symbolId, a.symbolCode)
    }
    return Array.from(seen.entries()).map(([id, code]) => ({ id, code }))
  }, [assetOptions])

  // Compute trade G/L for a transaction using current rates
  function computeTradeGL(tx: TransactionRow): number | null {
    if (tx.type !== 'trade') return null
    const toSym = tx.toAsset
    const fromSym = tx.fromAsset
    if (!toSym || !fromSym || tx.toAmount == null || tx.fromAmount == null) return null

    const toRateEntry = rateMap[toSym.symbolId]
    const fromRateEntry = rateMap[fromSym.symbolId]
    if (toRateEntry == null || fromRateEntry == null) return null

    // Resolve to display currency value
    function toDisplayValue(symbolId: string, amount: number): number | null {
      const rate = rateMap[symbolId]
      if (rate == null) return null
      const sym = assetOptions.find((a) => a.symbolId === symbolId)
      // We don't have primaryConversionFiat here, so we use the rate as TRY unless it's a USD/EUR rate
      // For simplicity: multiply rate × amount, then convert TRY → display
      const valueTry = amount * rate
      if (displayCurrency === 'USD') return usdRate ? valueTry / usdRate : null
      if (displayCurrency === 'EUR') return eurRate ? valueTry / eurRate : null
      return valueTry
    }

    const toValue = toDisplayValue(toSym.symbolId, tx.toAmount)
    const fromValue = toDisplayValue(fromSym.symbolId, tx.fromAmount)
    if (toValue == null || fromValue == null) return null
    return toValue - fromValue
  }

  // ── Filtering ──────────────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    return transactions.filter((tx) => {
      if (filters.types.length && !filters.types.includes(tx.type)) return false
      if (filters.dateFrom && tx.date.slice(0, 10) < filters.dateFrom) return false
      if (filters.dateTo && tx.date.slice(0, 10) > filters.dateTo) return false
      if (filters.fromAccountIds.length && tx.fromAsset && !filters.fromAccountIds.includes(tx.fromAsset.accountId)) return false
      if (filters.toAccountIds.length && tx.toAsset && !filters.toAccountIds.includes(tx.toAsset.accountId)) return false
      if (filters.symbolIds.length) {
        const hasSymbol = (tx.toAsset && filters.symbolIds.includes(tx.toAsset.symbolId)) ||
                         (tx.fromAsset && filters.symbolIds.includes(tx.fromAsset.symbolId))
        if (!hasSymbol) return false
      }
      return true
    })
  }, [transactions, filters])

  // ── Sorting ────────────────────────────────────────────────────────────────

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let cmp = 0
      if (sortField === 'date') cmp = a.date.localeCompare(b.date)
      else if (sortField === 'type') cmp = a.type.localeCompare(b.type)
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [filtered, sortField, sortDir])

  // ── Column sort toggle ─────────────────────────────────────────────────────
  function toggleSort(field: SortField) {
    if (sortField === field) setSortDir((d) => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir('desc') }
  }

  // ── Edit handlers ──────────────────────────────────────────────────────────

  function openEdit(tx: TransactionRow) {
    setEditForm(txToEditForm(tx))
    setError(null)
    setEditingTx(tx)
  }

  function handleEditTradeField(field: 'fromAmount' | 'toAmount' | 'exchangeRate', value: string) {
    if (!editForm || !editingTx) return
    const updated = { ...editForm, [field]: value }
    const derived = deriveByMode(editingTx.entryMode, {
      fromAmount: updated.fromAmount,
      toAmount: updated.toAmount,
      exchangeRate: updated.exchangeRate,
    })
    setEditForm((f) => f ? { ...f, ...derived } : f)
  }

  function handleSaveEdit() {
    if (!editingTx || !editForm) return
    setError(null)
    startTransition(async () => {
      const toAmount = editForm.toAmount ? parseFloat(editForm.toAmount) : undefined
      const fromAmount = editForm.fromAmount ? parseFloat(editForm.fromAmount) : undefined
      const feeAmount = editForm.feeAmount ? parseFloat(editForm.feeAmount) : undefined
      const exchangeRate = editForm.exchangeRate ? parseFloat(editForm.exchangeRate) : undefined
      const result = await updateTransaction(editingTx.id, {
        date: new Date(editForm.date).toISOString(),
        toAmount: toAmount !== undefined && !isNaN(toAmount) ? toAmount : undefined,
        fromAmount: fromAmount !== undefined && !isNaN(fromAmount) ? fromAmount : undefined,
        feeAmount: feeAmount !== undefined && !isNaN(feeAmount) ? feeAmount : undefined,
        exchangeRate: exchangeRate !== undefined && !isNaN(exchangeRate) ? exchangeRate : undefined,
        notes: editForm.notes || undefined,
      })
      if (!result.success) setError(result.error)
      else { setEditingTx(null); setEditForm(null) }
    })
  }

  function handleConfirmDelete() {
    if (!deletingTx) return
    startTransition(async () => {
      const result = await deleteTransaction(deletingTx.id)
      if (!result.success) setError(result.error)
      setDeletingTx(null)
    })
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      {/* ── Desktop layout ── */}
      <div className="hidden md:flex gap-0 min-h-0">
        {/* Filter panel — 25% */}
        <div
          className="w-[25%] shrink-0 flex flex-col rounded-2xl p-5"
          style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}
        >
          <h2 className="text-base font-semibold mb-4" style={{ color: 'var(--color-fg-primary)' }}>
            Filters
          </h2>

          <div className="flex-1 space-y-4 overflow-y-auto">
            {/* Date range */}
            <div className="space-y-1">
              <Label className="text-xs">From date</Label>
              <Input type="date" value={filters.dateFrom}
                onChange={(e) => setFilters((f) => ({ ...f, dateFrom: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">To date</Label>
              <Input type="date" value={filters.dateTo}
                onChange={(e) => setFilters((f) => ({ ...f, dateTo: e.target.value }))} />
            </div>

            {/* Type */}
            <div className="space-y-1">
              <Label className="text-xs">Type</Label>
              <div className="flex flex-wrap gap-1.5">
                {(['deposit', 'debit', 'transfer', 'interest', 'trade'] as TransactionType[]).map((t) => {
                  const active = filters.types.includes(t)
                  return (
                    <button
                      key={t}
                      onClick={() => setFilters((f) => ({
                        ...f,
                        types: active ? f.types.filter((x) => x !== t) : [...f.types, t]
                      }))}
                      className="px-2 py-1 rounded-lg text-xs font-medium transition-colors"
                      style={{
                        background: active ? 'var(--color-accent)' : 'var(--color-bg-base)',
                        color: active ? 'var(--color-bg-sidebar)' : 'var(--color-fg-secondary)',
                        border: '1px solid var(--color-border)',
                      }}
                    >
                      {TYPE_LABELS[t]}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* From account */}
            <FilterMultiSelect
              label="From account"
              options={accountOptions.map((a) => ({ id: a.id, label: a.name }))}
              selected={filters.fromAccountIds}
              onChange={(ids) => setFilters((f) => ({ ...f, fromAccountIds: ids }))}
            />

            {/* To account */}
            <FilterMultiSelect
              label="To account"
              options={accountOptions.map((a) => ({ id: a.id, label: a.name }))}
              selected={filters.toAccountIds}
              onChange={(ids) => setFilters((f) => ({ ...f, toAccountIds: ids }))}
            />

            {/* Symbol */}
            <FilterMultiSelect
              label="Symbol"
              options={symbolOptions.map((s) => ({ id: s.id, label: s.code }))}
              selected={filters.symbolIds}
              onChange={(ids) => setFilters((f) => ({ ...f, symbolIds: ids }))}
            />
          </div>

          {/* Clear all */}
          {filtersActive(filters) && (
            <Button
              variant="outline"
              className="mt-4 w-full min-h-[44px]"
              onClick={() => setFilters(emptyFilters)}
            >
              Clear All
            </Button>
          )}
        </div>

        {/* Table — 75% */}
        <div className="flex-1 min-w-0 pl-5">
          {/* Page header */}
          <div className="flex items-center justify-between mb-5">
            <h1 className="text-xl font-semibold" style={{ color: 'var(--color-fg-primary)' }}>
              Transactions
            </h1>
            {canMutate && (
              <Link
                href="/transactions/new"
                className="inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-medium min-h-[44px]"
                style={{ background: 'var(--color-accent)', color: 'var(--color-bg-sidebar)' }}
              >
                Add Transaction
              </Link>
            )}
          </div>

          {error && <p className="text-sm mb-3" style={{ color: 'var(--color-negative)' }}>{error}</p>}

          {sorted.length === 0 ? (
            <div
              className="rounded-2xl p-8"
              style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}
            >
              <EmptyState
                icon={ArrowLeftRight}
                message={transactions.length === 0 ? 'No transactions yet' : 'No transactions match the current filters'}
              />
            </div>
          ) : (
            <div
              className="rounded-2xl overflow-hidden"
              style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}
            >
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <SortTh field="date" current={sortField} dir={sortDir} onToggle={toggleSort}>
                      Date
                    </SortTh>
                    <SortTh field="type" current={sortField} dir={sortDir} onToggle={toggleSort}>
                      Type
                    </SortTh>
                    <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--color-fg-secondary)' }}>
                      From
                    </th>
                    <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--color-fg-secondary)' }}>
                      To
                    </th>
                    <th className="text-right px-4 py-3 font-medium" style={{ color: 'var(--color-fg-secondary)' }}>
                      Amount
                    </th>
                    <th className="text-right px-4 py-3 font-medium" style={{ color: 'var(--color-fg-secondary)' }}>
                      Fee
                    </th>
                    <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--color-fg-secondary)' }}>
                      Notes
                    </th>
                    {canMutate && (
                      <th className="px-4 py-3" />
                    )}
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((tx) => (
                    <tr
                      key={tx.id}
                      className="group"
                      style={{ borderBottom: '1px solid var(--color-border)' }}
                    >
                      {/* Date */}
                      <td className="px-4 py-3 whitespace-nowrap" style={{ color: 'var(--color-fg-secondary)' }}>
                        {formatDate(tx.date)}
                      </td>
                      {/* Type */}
                      <td className="px-4 py-3">
                        <span
                          className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
                          style={{
                            background: TYPE_BG[tx.type],
                            color: TYPE_COLORS[tx.type],
                          }}
                        >
                          {TYPE_LABELS[tx.type]}
                        </span>
                      </td>
                      {/* From */}
                      <td className="px-4 py-3 text-xs" style={{ color: 'var(--color-fg-secondary)' }}>
                        {tx.fromAsset
                          ? <><span className="font-mono font-semibold" style={{ color: 'var(--color-fg-primary)' }}>{tx.fromAsset.symbolCode}</span> @ {tx.fromAsset.accountName}</>
                          : '—'}
                      </td>
                      {/* To */}
                      <td className="px-4 py-3 text-xs" style={{ color: 'var(--color-fg-secondary)' }}>
                        {tx.toAsset
                          ? <><span className="font-mono font-semibold" style={{ color: 'var(--color-fg-primary)' }}>{tx.toAsset.symbolCode}</span> @ {tx.toAsset.accountName}</>
                          : '—'}
                      </td>
                      {/* Amount */}
                      <td className="px-4 py-3 text-right font-mono" style={{ color: 'var(--color-fg-primary)' }}>
                        {tx.type === 'trade' ? (
                          <span className="text-xs">
                            {formatAmount(tx.fromAmount)} {tx.fromAsset?.symbolCode ?? ''} → {formatAmount(tx.toAmount)} {tx.toAsset?.symbolCode ?? ''}
                          </span>
                        ) : tx.toAmount != null ? (
                          `${formatAmount(tx.toAmount)} ${tx.toAsset?.symbolCode ?? ''}`
                        ) : tx.fromAmount != null ? (
                          `${formatAmount(tx.fromAmount)} ${tx.fromAsset?.symbolCode ?? ''}`
                        ) : '—'}
                      </td>
                      {/* Fee */}
                      <td className="px-4 py-3 text-right font-mono text-xs" style={{ color: 'var(--color-fg-secondary)' }}>
                        {tx.feeAmount != null && tx.feeAmount > 0
                          ? `${formatAmount(tx.feeAmount)} ${feeSymbol(tx)}`
                          : '—'}
                      </td>
                      {/* Notes */}
                      <td className="px-4 py-3 text-xs max-w-[160px] truncate" style={{ color: 'var(--color-fg-secondary)' }}>
                        {tx.notes || '—'}
                      </td>
                      {/* Actions */}
                      {canMutate && (
                        <td className="px-4 py-3">
                          <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button variant="outline" size="sm" onClick={() => openEdit(tx)} className="min-h-[36px]">
                              Edit
                            </Button>
                            <Button variant="destructive" size="sm" onClick={() => setDeletingTx(tx)} disabled={isPending} className="min-h-[36px]">
                              Delete
                            </Button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ── Mobile layout ── */}
      <div className="md:hidden">
        {/* Page header */}
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-semibold" style={{ color: 'var(--color-fg-primary)' }}>
            Transactions
          </h1>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFilterSheet(true)}
              className="min-h-[44px]"
            >
              <SlidersHorizontal className="size-4 mr-1" />
              Filter
              {filtersActive(filters) && (
                <span
                  className="ml-1 flex size-4 items-center justify-center rounded-full text-xs"
                  style={{ background: 'var(--color-accent)', color: 'var(--color-bg-sidebar)' }}
                >
                  !
                </span>
              )}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowSortSheet(true)}
              className="min-h-[44px]"
            >
              <ArrowUpDown className="size-4 mr-1" />
              Sort
            </Button>
          </div>
        </div>

        {canMutate && (
          <Link
            href="/transactions/new"
            className="flex items-center justify-center w-full rounded-xl px-4 py-3 text-sm font-medium mb-4 min-h-[44px]"
            style={{ background: 'var(--color-accent)', color: 'var(--color-bg-sidebar)' }}
          >
            Add Transaction
          </Link>
        )}

        {error && <p className="text-sm mb-3" style={{ color: 'var(--color-negative)' }}>{error}</p>}

        {sorted.length === 0 ? (
          <EmptyState
            icon={ArrowLeftRight}
            message={transactions.length === 0 ? 'No transactions yet' : 'No transactions match the current filters'}
          />
        ) : (
          <div className="space-y-3">
            {sorted.map((tx) => (
              <MobileTransactionCard
                key={tx.id}
                tx={tx}
                canMutate={canMutate}
                onEdit={() => openEdit(tx)}
                onDelete={() => setDeletingTx(tx)}
                isPending={isPending}
                computeTradeGL={computeTradeGL}
                displayCurrency={displayCurrency}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Filter bottom sheet (mobile) ── */}
      <Sheet open={showFilterSheet} onOpenChange={setShowFilterSheet}>
        <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto">
          <SheetHeader><SheetTitle>Filters</SheetTitle></SheetHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">From date</Label>
                <Input type="date" value={filters.dateFrom}
                  onChange={(e) => setFilters((f) => ({ ...f, dateFrom: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">To date</Label>
                <Input type="date" value={filters.dateTo}
                  onChange={(e) => setFilters((f) => ({ ...f, dateTo: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Type</Label>
              <div className="flex flex-wrap gap-2">
                {(['deposit', 'debit', 'transfer', 'interest', 'trade'] as TransactionType[]).map((t) => {
                  const active = filters.types.includes(t)
                  return (
                    <button
                      key={t}
                      onClick={() => setFilters((f) => ({
                        ...f,
                        types: active ? f.types.filter((x) => x !== t) : [...f.types, t]
                      }))}
                      className="px-3 py-1.5 rounded-xl text-sm font-medium min-h-[44px]"
                      style={{
                        background: active ? 'var(--color-accent)' : 'var(--color-bg-base)',
                        color: active ? 'var(--color-bg-sidebar)' : 'var(--color-fg-secondary)',
                        border: '1px solid var(--color-border)',
                      }}
                    >
                      {TYPE_LABELS[t]}
                    </button>
                  )
                })}
              </div>
            </div>
            {filtersActive(filters) && (
              <Button variant="outline" className="w-full min-h-[44px]" onClick={() => { setFilters(emptyFilters); setShowFilterSheet(false) }}>
                Clear All
              </Button>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* ── Sort bottom sheet (mobile) ── */}
      <Sheet open={showSortSheet} onOpenChange={setShowSortSheet}>
        <SheetContent side="bottom">
          <SheetHeader><SheetTitle>Sort</SheetTitle></SheetHeader>
          <div className="space-y-2 py-4">
            {([['date', 'Date'], ['type', 'Type']] as [SortField, string][]).map(([field, label]) => (
              <button
                key={field}
                className="flex w-full items-center justify-between px-4 py-3 rounded-xl min-h-[52px]"
                style={{
                  background: sortField === field ? 'var(--color-accent-subtle)' : 'var(--color-bg-base)',
                  color: sortField === field ? 'var(--color-accent)' : 'var(--color-fg-primary)',
                  border: '1px solid var(--color-border)',
                }}
                onClick={() => { toggleSort(field); setShowSortSheet(false) }}
              >
                <span className="text-sm font-medium">{label}</span>
                {sortField === field && (
                  <span className="text-xs">
                    {sortDir === 'asc' ? '↑ Asc' : '↓ Desc'}
                  </span>
                )}
              </button>
            ))}
          </div>
        </SheetContent>
      </Sheet>

      {/* ── Edit dialog ── */}
      <Dialog open={!!editingTx} onOpenChange={(open) => { if (!open) { setEditingTx(null); setEditForm(null) } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit {editingTx ? TYPE_LABELS[editingTx.type] : ''} Transaction</DialogTitle>
          </DialogHeader>
          {editForm && editingTx && (
            <div className="space-y-4 py-2">
              {error && <p className="text-sm" style={{ color: 'var(--color-negative)' }}>{error}</p>}
              <div className="space-y-1">
                <Label>Date</Label>
                <Input type="datetime-local" value={editForm.date}
                  onChange={(e) => setEditForm((f) => f ? { ...f, date: e.target.value } : f)} />
              </div>
              {editingTx.fromAssetId && (
                <>
                  <div className="space-y-0.5">
                    <p className="text-xs" style={{ color: 'var(--color-fg-secondary)' }}>From asset</p>
                    <p className="text-sm font-medium">{editingTx.fromAsset?.accountName ?? '—'} — {editingTx.fromAsset?.symbolCode ?? '—'}</p>
                  </div>
                  <div className="space-y-1">
                    <Label>From amount ({editingTx.fromAsset?.symbolCode ?? 'from'})</Label>
                    <Input type="number" min="0" step="any" value={editForm.fromAmount}
                      disabled={isTradeFieldLocked(editingTx, 'fromAmount')}
                      readOnly={isTradeFieldLocked(editingTx, 'fromAmount')}
                      onChange={(e) => editingTx.type === 'trade'
                        ? handleEditTradeField('fromAmount', e.target.value)
                        : setEditForm((f) => f ? { ...f, fromAmount: e.target.value } : f)} />
                  </div>
                </>
              )}
              {editingTx.toAssetId && (
                <>
                  <div className="space-y-0.5">
                    <p className="text-xs" style={{ color: 'var(--color-fg-secondary)' }}>To asset</p>
                    <p className="text-sm font-medium">{editingTx.toAsset?.accountName ?? '—'} — {editingTx.toAsset?.symbolCode ?? '—'}</p>
                  </div>
                  <div className="space-y-1">
                    <Label>To amount ({editingTx.toAsset?.symbolCode ?? 'to'})</Label>
                    <Input type="number" min="0" step="any" value={editForm.toAmount}
                      disabled={isTradeFieldLocked(editingTx, 'toAmount')}
                      readOnly={isTradeFieldLocked(editingTx, 'toAmount')}
                      onChange={(e) => editingTx.type === 'trade'
                        ? handleEditTradeField('toAmount', e.target.value)
                        : setEditForm((f) => f ? { ...f, toAmount: e.target.value } : f)} />
                  </div>
                </>
              )}
              {editingTx.type === 'trade' && (
                <div className="space-y-1">
                  <Label>Exchange rate <span className="text-xs font-normal" style={{ color: 'var(--color-fg-secondary)' }}>from units per 1 to unit</span></Label>
                  <Input type="number" min="0" step="any" value={editForm.exchangeRate}
                    disabled={isTradeFieldLocked(editingTx, 'exchangeRate')}
                    readOnly={isTradeFieldLocked(editingTx, 'exchangeRate')}
                    onChange={(e) => handleEditTradeField('exchangeRate', e.target.value)} />
                </div>
              )}
              {editingTx.feeSide !== null && (
                <div className="space-y-1">
                  <Label>Fee amount <span className="text-xs font-normal" style={{ color: 'var(--color-fg-secondary)' }}>
                    {editingTx.feeSide === 'to'
                      ? `Deducted from received (${editingTx.toAsset?.symbolCode ?? ''})`
                      : `Added to sent (${editingTx.fromAsset?.symbolCode ?? ''})`}
                  </span></Label>
                  <Input type="number" min="0" step="any" value={editForm.feeAmount}
                    onChange={(e) => setEditForm((f) => f ? { ...f, feeAmount: e.target.value } : f)} />
                </div>
              )}
              <div className="space-y-1">
                <Label>Notes</Label>
                <textarea
                  className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring min-h-[80px] resize-y"
                  placeholder="Optional notes…"
                  value={editForm.notes}
                  onChange={(e) => setEditForm((f) => f ? { ...f, notes: e.target.value } : f)}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setEditingTx(null); setEditForm(null) }}>Cancel</Button>
            <Button onClick={handleSaveEdit} disabled={isPending}>{isPending ? 'Saving…' : 'Save'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete confirmation ── */}
      <AlertDialog open={!!deletingTx} onOpenChange={(open) => { if (!open) setDeletingTx(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete transaction?</AlertDialogTitle>
            <AlertDialogDescription>
              All asset balance changes from this transaction will be reversed. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete} disabled={isPending}>
              Delete and reverse
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

// ─── Helper: sort table header ────────────────────────────────────────────────

function SortTh({
  children,
  field,
  current,
  dir,
  onToggle,
}: {
  children: React.ReactNode
  field: SortField
  current: SortField
  dir: SortDir
  onToggle: (f: SortField) => void
}) {
  const isActive = field === current
  return (
    <th className="text-left px-4 py-3 font-medium whitespace-nowrap" style={{ color: 'var(--color-fg-secondary)' }}>
      <button
        onClick={() => onToggle(field)}
        className="flex items-center gap-1 transition-colors hover:text-[var(--color-fg-primary)]"
      >
        {children}
        {isActive
          ? (dir === 'asc' ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />)
          : <ArrowUpDown className="size-3 opacity-40" />}
      </button>
    </th>
  )
}

// ─── Helper: multi-select filter chip ────────────────────────────────────────

function FilterMultiSelect({
  label,
  options,
  selected,
  onChange,
}: {
  label: string
  options: { id: string; label: string }[]
  selected: string[]
  onChange: (ids: string[]) => void
}) {
  if (options.length === 0) return null
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <div className="flex flex-wrap gap-1">
        {options.map((opt) => {
          const active = selected.includes(opt.id)
          return (
            <button
              key={opt.id}
              onClick={() => onChange(
                active ? selected.filter((x) => x !== opt.id) : [...selected, opt.id]
              )}
              className="px-2 py-0.5 rounded-lg text-xs transition-colors"
              style={{
                background: active ? 'var(--color-accent)' : 'var(--color-bg-base)',
                color: active ? 'var(--color-bg-sidebar)' : 'var(--color-fg-secondary)',
                border: '1px solid var(--color-border)',
              }}
            >
              {opt.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── Mobile transaction card (§4.2) ──────────────────────────────────────────

const FIAT_TYPES = new Set(['fiat_currency'])

function isFiat(symbolCode: string | null | undefined, assetOptions: AssetRef[]): boolean {
  if (!symbolCode) return false
  const sym = assetOptions.find((a) => a.symbolCode === symbolCode)
  if (!sym) return false
  // We don't have symbolType in AssetRef, but fiat symbols are TRY/USD/EUR/GBP
  const KNOWN_FIAT = new Set(['TRY', 'USD', 'EUR', 'GBP', 'CHF'])
  return KNOWN_FIAT.has(sym.symbolCode)
}

interface MobileTransactionCardProps {
  tx: TransactionRow
  canMutate: boolean
  onEdit: () => void
  onDelete: () => void
  isPending: boolean
  computeTradeGL: (tx: TransactionRow) => number | null
  displayCurrency: DisplayCurrency
}

function MobileTransactionCard({
  tx,
  canMutate,
  onEdit,
  onDelete,
  isPending,
  computeTradeGL,
  displayCurrency,
}: MobileTransactionCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  function CardContent() {
    if (tx.type === 'trade') {
      const fromCode = tx.fromAsset?.symbolCode ?? null
      const toCode = tx.toAsset?.symbolCode ?? null
      const KNOWN_FIAT = new Set(['TRY', 'USD', 'EUR', 'GBP', 'CHF'])
      const fromIsFiat = fromCode ? KNOWN_FIAT.has(fromCode) : false
      const toIsFiat = toCode ? KNOWN_FIAT.has(toCode) : false

      if (!fromIsFiat && !toIsFiat) {
        // Both non-fiat: Trade badge
        return (
          <>
            <CardHeader
              name={`${fromCode ?? '—'} → ${toCode ?? '—'}`}
              badgeLabel="Trade"
              badgeColor="var(--color-fg-secondary)"
              badgeBg="var(--color-bg-base)"
              date={tx.date}
            />
            <p className="text-xs font-mono mt-1" style={{ color: 'var(--color-fg-secondary)' }}>
              {formatAmount(tx.fromAmount)} {fromCode} → {formatAmount(tx.toAmount)} {toCode}
            </p>
          </>
        )
      }

      if (fromIsFiat && toIsFiat) {
        // Both fiat: Exchange badge
        return (
          <>
            <CardHeader
              name={`${fromCode ?? '—'} → ${toCode ?? '—'}`}
              badgeLabel="Exchange"
              badgeColor="var(--color-fg-secondary)"
              badgeBg="var(--color-bg-base)"
              date={tx.date}
            />
            <p className="text-xs font-mono mt-1" style={{ color: 'var(--color-fg-secondary)' }}>
              {formatAmount(tx.fromAmount)} {fromCode} → {formatAmount(tx.toAmount)} {toCode}
            </p>
          </>
        )
      }

      // One fiat leg
      const isBuy = toIsFiat ? false : true // non-fiat is toAsset → Buy
      const nonFiatCode = isBuy ? toCode : fromCode
      const nonFiatName = isBuy ? tx.toAsset?.symbolName : tx.fromAsset?.symbolName
      const accountName = isBuy ? tx.toAsset?.accountName : tx.fromAsset?.accountName
      const gl = computeTradeGL(tx)
      const glPct = null // we don't have cost basis per-tx

      return (
        <>
          <CardHeader
            name={nonFiatName ?? nonFiatCode ?? '—'}
            badgeLabel={isBuy ? 'Buy' : 'Sell'}
            badgeColor={isBuy ? 'var(--color-positive)' : 'var(--color-negative)'}
            badgeBg={isBuy ? 'oklch(from var(--color-positive) l c h / 0.12)' : 'oklch(from var(--color-negative) l c h / 0.12)'}
            date={tx.date}
          />
          <p className="text-xs mt-0.5" style={{ color: 'var(--color-fg-secondary)' }}>
            {accountName ?? '—'} — {nonFiatCode ?? '—'}
            {gl != null && (
              <span
                className="ml-2 font-mono"
                style={{ color: gl >= 0 ? 'var(--color-positive)' : 'var(--color-negative)' }}
              >
                {gl >= 0 ? '+' : '−'}{Math.abs(gl).toLocaleString('en-US', { maximumFractionDigits: 2 })} {displayCurrency}
              </span>
            )}
          </p>
          <p className="text-xs font-mono mt-0.5" style={{ color: 'var(--color-fg-secondary)' }}>
            {formatAmount(tx.fromAmount)} {fromCode} → {formatAmount(tx.toAmount)} {toCode}
          </p>
        </>
      )
    }

    // Deposit / Debit / Interest / Transfer
    const isPositive = tx.type === 'deposit' || tx.type === 'interest'
    const isDebit = tx.type === 'debit'
    const symCode = isDebit ? tx.fromAsset?.symbolCode : tx.toAsset?.symbolCode
    const symName = isDebit ? tx.fromAsset?.symbolName : tx.toAsset?.symbolName
    const accountName = isDebit ? tx.fromAsset?.accountName : tx.toAsset?.accountName
    const amount = isDebit ? tx.fromAmount : tx.toAmount
    const amountColor = isPositive ? 'var(--color-positive)' : isDebit ? 'var(--color-negative)' : 'var(--color-fg-secondary)'

    return (
      <>
        <CardHeader
          name={symName ?? symCode ?? '—'}
          badgeLabel={TYPE_LABELS[tx.type]}
          badgeColor={TYPE_COLORS[tx.type]}
          badgeBg={TYPE_BG[tx.type]}
          date={tx.date}
        />
        <div className="flex items-center justify-between mt-0.5">
          <span className="text-xs" style={{ color: 'var(--color-fg-secondary)' }}>
            {symName ?? symCode ?? '—'} ({accountName ?? '—'} — {symCode ?? '—'})
          </span>
          <span className="font-mono text-xs" style={{ color: amountColor }}>
            {isPositive ? '+' : isDebit ? '−' : ''}{formatAmount(amount)} {symCode}
          </span>
        </div>
      </>
    )
  }

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}
    >
      <button
        className="w-full text-left px-4 py-3"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <CardContent />
        <div className="flex justify-end mt-1">
          <span className="text-xs" style={{ color: 'var(--color-fg-disabled)' }}>
            {isExpanded ? '▲' : '▼'}
          </span>
        </div>
      </button>

      {isExpanded && (
        <div
          className="px-4 py-3 space-y-2"
          style={{ borderTop: '1px solid var(--color-border)' }}
        >
          {tx.feeAmount != null && tx.feeAmount > 0 && (
            <p className="text-xs" style={{ color: 'var(--color-fg-secondary)' }}>
              Fee: {formatAmount(tx.feeAmount)} {feeSymbol(tx)}
            </p>
          )}
          <p className="text-xs" style={{ color: 'var(--color-fg-secondary)' }}>
            Notes: {tx.notes ?? '—'}
          </p>
          {canMutate && (
            <div className="flex gap-2 pt-1">
              <Button variant="outline" size="sm" onClick={onEdit} className="min-h-[44px]">
                Edit
              </Button>
              <Button variant="destructive" size="sm" onClick={onDelete} disabled={isPending} className="min-h-[44px]">
                Delete
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function CardHeader({
  name,
  badgeLabel,
  badgeColor,
  badgeBg,
  date,
}: {
  name: string
  badgeLabel: string
  badgeColor: string
  badgeBg: string
  date: string
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-sm font-semibold truncate" style={{ color: 'var(--color-fg-primary)' }}>
          {name}
        </span>
        <span
          className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium shrink-0"
          style={{ background: badgeBg, color: badgeColor }}
        >
          {badgeLabel}
        </span>
      </div>
      <span className="text-xs shrink-0" style={{ color: 'var(--color-fg-disabled)' }}>
        {formatDate(date)}
      </span>
    </div>
  )
}
