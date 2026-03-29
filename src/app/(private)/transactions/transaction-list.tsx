'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
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
import { updateTransaction, deleteTransaction } from '@/lib/actions/transactions'
import type { TransactionType, EntryMode } from '@/lib/types/domain'
import type { TransactionRow, AssetRef } from './page'

interface Props {
  transactions: TransactionRow[]
  assetOptions: AssetRef[]
  role: 'manager' | 'editor' | 'viewer'
}

const TYPE_LABELS: Record<TransactionType, string> = {
  deposit: 'Deposit',
  debit: 'Debit',
  transfer: 'Transfer',
  interest: 'Interest',
  trade: 'Trade',
}

const TYPE_VARIANTS: Record<TransactionType, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  deposit: 'default',
  interest: 'default',
  debit: 'destructive',
  transfer: 'secondary',
  trade: 'outline',
}

function formatAmount(amount: number | null): string {
  if (amount == null) return '—'
  return amount.toLocaleString('en-US', { maximumFractionDigits: 8 })
}

function txSummary(tx: TransactionRow): string {
  switch (tx.type) {
    case 'deposit':
    case 'interest':
      return `+${formatAmount(tx.toAmount)} ${tx.toAsset?.symbolCode ?? ''} → ${tx.toAsset?.accountName ?? ''}`
    case 'debit':
      return `-${formatAmount(tx.fromAmount)} ${tx.fromAsset?.symbolCode ?? ''} from ${tx.fromAsset?.accountName ?? ''}`
    case 'transfer':
      return `${formatAmount(tx.fromAmount)} ${tx.fromAsset?.symbolCode ?? ''} (${tx.fromAsset?.accountName ?? ''}) → ${tx.toAsset?.accountName ?? ''}`
    case 'trade':
      return `${formatAmount(tx.fromAmount)} ${tx.fromAsset?.symbolCode ?? ''} → ${formatAmount(tx.toAmount)} ${tx.toAsset?.symbolCode ?? ''}`
    default:
      return ''
  }
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

// ── Entry-mode-based three-way derivation ─────────────────────────────────────
// Convention: exchange_rate = fromAmount / toAmount
// The locked (derived) field is determined by the stored entryMode.

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

// ── Edit form state ────────────────────────────────────────────────────────────

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

export function TransactionList({ transactions, assetOptions: _assetOptions, role }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  // Filters
  const [filterType, setFilterType] = useState<string>('all')
  const [filterDate, setFilterDate] = useState('')

  // Edit dialog
  const [editingTx, setEditingTx] = useState<TransactionRow | null>(null)
  const [editForm, setEditForm] = useState<EditForm | null>(null)

  // Delete dialog
  const [deletingTx, setDeletingTx] = useState<TransactionRow | null>(null)

  const canMutate = role === 'manager' || role === 'editor'

  // ── Filtering ────────────────────────────────────────────────────────────────

  const filtered = transactions.filter((tx) => {
    if (filterType !== 'all' && tx.type !== filterType) return false
    if (filterDate) {
      const txDate = tx.date.slice(0, 10)
      if (txDate < filterDate) return false
    }
    return true
  })

  // ── Edit handlers ────────────────────────────────────────────────────────────

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
      if (!result.success) {
        setError(result.error)
      } else {
        setEditingTx(null)
        setEditForm(null)
      }
    })
  }

  // ── Delete handlers ──────────────────────────────────────────────────────────

  function handleConfirmDelete() {
    if (!deletingTx) return
    startTransition(async () => {
      const result = await deleteTransaction(deletingTx.id)
      if (!result.success) {
        setError(result.error)
      }
      setDeletingTx(null)
    })
  }

  // ── Helpers ───────────────────────────────────────────────────────────────────

  function feeSymbol(tx: TransactionRow): string {
    if (tx.feeSide === 'to') return tx.toAsset?.symbolCode ?? ''
    if (tx.feeSide === 'from') return tx.fromAsset?.symbolCode ?? ''
    return ''
  }

  function isTradeFieldLocked(field: 'fromAmount' | 'toAmount' | 'exchangeRate'): boolean {
    if (!editingTx || editingTx.type !== 'trade') return false
    const mode = editingTx.entryMode ?? 'both_amounts'
    if (mode === 'both_amounts') return field === 'exchangeRate'
    if (mode === 'to_amount_and_rate') return field === 'fromAmount'
    return field === 'toAmount'
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="flex-1 min-w-[140px]">
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="h-9">
              <SelectValue placeholder="All types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              <SelectItem value="deposit">Deposit</SelectItem>
              <SelectItem value="debit">Debit</SelectItem>
              <SelectItem value="transfer">Transfer</SelectItem>
              <SelectItem value="interest">Interest</SelectItem>
              <SelectItem value="trade">Trade</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex-1 min-w-[160px]">
          <Input
            type="date"
            className="h-9"
            placeholder="From date"
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
          />
        </div>
        {(filterType !== 'all' || filterDate) && (
          <Button
            variant="outline"
            size="sm"
            className="h-9"
            onClick={() => { setFilterType('all'); setFilterDate('') }}
          >
            Clear
          </Button>
        )}
      </div>

      {/* Error */}
      {error && <p className="text-sm text-destructive">{error}</p>}

      {/* List */}
      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">
          {transactions.length === 0
            ? 'No transactions yet. Add one to get started.'
            : 'No transactions match the current filters.'}
        </p>
      ) : (
        <div className="divide-y border rounded-lg overflow-hidden">
          {filtered.map((tx) => (
            <div key={tx.id} className="flex items-start justify-between px-4 py-3 gap-4 hover:bg-muted/30 transition-colors">
              <div className="min-w-0 flex-1 space-y-0.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant={TYPE_VARIANTS[tx.type]}>{TYPE_LABELS[tx.type]}</Badge>
                  <span className="text-sm text-muted-foreground">{formatDate(tx.date)}</span>
                </div>
                <p className="text-sm font-medium truncate">{txSummary(tx)}</p>
                {tx.feeAmount != null && tx.feeAmount > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Fee: {formatAmount(tx.feeAmount)} {feeSymbol(tx)}
                  </p>
                )}
                {tx.notes && (
                  <p className="text-xs text-muted-foreground italic truncate">{tx.notes}</p>
                )}
              </div>
              {canMutate && (
                <div className="flex gap-2 shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => router.push(`/transactions/new?copy=${tx.id}`)}
                    disabled={isPending}
                  >
                    Duplicate
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => openEdit(tx)}>
                    Edit
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setDeletingTx(tx)}
                    disabled={isPending}
                  >
                    Delete
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Edit dialog */}
      <Dialog open={!!editingTx} onOpenChange={(open) => { if (!open) { setEditingTx(null); setEditForm(null) } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Edit {editingTx ? TYPE_LABELS[editingTx.type] : ''} Transaction
            </DialogTitle>
          </DialogHeader>
          {editForm && editingTx && (
            <div className="space-y-4 py-2">
              {error && <p className="text-sm text-destructive">{error}</p>}

              <div className="space-y-1">
                <Label>Date</Label>
                <Input
                  type="datetime-local"
                  value={editForm.date}
                  onChange={(e) => setEditForm((f) => f ? { ...f, date: e.target.value } : f)}
                />
              </div>

              {editingTx.fromAssetId && (
                <>
                  <div className="space-y-0.5">
                    <p className="text-xs text-muted-foreground">From asset</p>
                    <p className="text-sm font-medium">
                      {editingTx.fromAsset?.accountName ?? '—'} — {editingTx.fromAsset?.symbolCode ?? '—'}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <Label>From amount ({editingTx.fromAsset?.symbolCode ?? 'from'})</Label>
                    <Input
                      type="number"
                      min="0"
                      step="any"
                      value={editForm.fromAmount}
                      disabled={isTradeFieldLocked('fromAmount')}
                      readOnly={isTradeFieldLocked('fromAmount')}
                      onChange={(e) =>
                        editingTx.type === 'trade'
                          ? handleEditTradeField('fromAmount', e.target.value)
                          : setEditForm((f) => f ? { ...f, fromAmount: e.target.value } : f)
                      }
                    />
                  </div>
                </>
              )}

              {editingTx.toAssetId && (
                <>
                  <div className="space-y-0.5">
                    <p className="text-xs text-muted-foreground">To asset</p>
                    <p className="text-sm font-medium">
                      {editingTx.toAsset?.accountName ?? '—'} — {editingTx.toAsset?.symbolCode ?? '—'}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <Label>To amount ({editingTx.toAsset?.symbolCode ?? 'to'})</Label>
                    <Input
                      type="number"
                      min="0"
                      step="any"
                      value={editForm.toAmount}
                      disabled={isTradeFieldLocked('toAmount')}
                      readOnly={isTradeFieldLocked('toAmount')}
                      onChange={(e) =>
                        editingTx.type === 'trade'
                          ? handleEditTradeField('toAmount', e.target.value)
                          : setEditForm((f) => f ? { ...f, toAmount: e.target.value } : f)
                      }
                    />
                  </div>
                </>
              )}

              {editingTx.type === 'trade' && (
                <div className="space-y-1">
                  <Label>
                    Exchange rate{' '}
                    <span className="text-xs text-muted-foreground font-normal">
                      from units per 1 to unit
                    </span>
                  </Label>
                  <Input
                    type="number"
                    min="0"
                    step="any"
                    value={editForm.exchangeRate}
                    disabled={isTradeFieldLocked('exchangeRate')}
                    readOnly={isTradeFieldLocked('exchangeRate')}
                    onChange={(e) => handleEditTradeField('exchangeRate', e.target.value)}
                  />
                </div>
              )}

              {/* Fee amount — only editable when feeSide is set; side is immutable */}
              {editingTx.feeSide !== null && (
                <div className="space-y-1">
                  <Label>
                    Fee amount{' '}
                    <span className="text-xs text-muted-foreground font-normal">
                      {editingTx.feeSide === 'to'
                        ? `Deducted from received (${editingTx.toAsset?.symbolCode ?? ''})`
                        : `Added to sent (${editingTx.fromAsset?.symbolCode ?? ''})`}
                    </span>
                  </Label>
                  <Input
                    type="number"
                    min="0"
                    step="any"
                    value={editForm.feeAmount}
                    onChange={(e) => setEditForm((f) => f ? { ...f, feeAmount: e.target.value } : f)}
                  />
                </div>
              )}

              <div className="space-y-1">
                <Label>Notes</Label>
                <textarea
                  className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 min-h-[80px] resize-y"
                  placeholder="Optional notes…"
                  value={editForm.notes}
                  onChange={(e) => setEditForm((f) => f ? { ...f, notes: e.target.value } : f)}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setEditingTx(null); setEditForm(null) }}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit} disabled={isPending}>
              {isPending ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
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
    </div>
  )
}
