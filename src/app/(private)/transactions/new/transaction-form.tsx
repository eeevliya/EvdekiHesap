'use client'

import { useState, useTransition, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
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
import { createTransaction } from '@/lib/actions/transactions'
import type { TransactionType, FeeSide, EntryMode } from '@/lib/types/domain'
import type { AssetRef } from '../page'

export interface InitialValues {
  type: TransactionType
  date: string
  toAssetId: string
  fromAssetId: string
  toAmount: string
  fromAmount: string
  feeAmount: string
  feeSide: FeeSide | null
  exchangeRate: string
  entryMode: EntryMode | null
  notes: string
}

interface Props {
  householdId: string
  assetOptions: AssetRef[]
  initialValues?: InitialValues
}

// datetime-local value for "now" in local time
function nowLocal(): string {
  const d = new Date()
  d.setSeconds(0, 0)
  return d.toISOString().slice(0, 16)
}

function AssetSelect({
  label,
  value,
  options,
  onChange,
  placeholder,
}: {
  label: string
  value: string
  options: AssetRef[]
  onChange: (v: string) => void
  placeholder?: string
}) {
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue placeholder={placeholder ?? 'Select asset…'} />
        </SelectTrigger>
        <SelectContent>
          {options.map((a) => (
            <SelectItem key={a.assetId} value={a.assetId}>
              {a.accountName} — {a.symbolCode}
              {a.symbolName ? ` (${a.symbolName})` : ''}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

// ── Entry-mode-based three-way derivation ─────────────────────────────────────
// Convention: exchange_rate = fromAmount / toAmount
// The locked (derived) field is determined by entryMode.

function deriveByEntryMode(
  mode: EntryMode,
  field: 'fromAmount' | 'toAmount' | 'exchangeRate',
  value: string,
  current: { fromAmount: string; toAmount: string; exchangeRate: string }
): { fromAmount: string; toAmount: string; exchangeRate: string } {
  const next = { ...current, [field]: value }
  const from = parseFloat(next.fromAmount)
  const to = parseFloat(next.toAmount)
  const rate = parseFloat(next.exchangeRate)

  if (mode === 'both_amounts') {
    next.exchangeRate = !isNaN(from) && !isNaN(to) && to > 0 ? (from / to).toFixed(8) : ''
  } else if (mode === 'to_amount_and_rate') {
    next.fromAmount = !isNaN(to) && !isNaN(rate) ? (to * rate).toFixed(8) : ''
  } else {
    next.toAmount = !isNaN(from) && !isNaN(rate) && rate > 0 ? (from / rate).toFixed(8) : ''
  }
  return next
}

export function TransactionForm({ householdId, assetOptions, initialValues }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const isMounted = useRef(false)

  const [type, setType] = useState<TransactionType>(initialValues?.type ?? 'deposit')
  const [date, setDate] = useState(initialValues?.date ?? nowLocal())
  const [toAssetId, setToAssetId] = useState(initialValues?.toAssetId ?? '')
  const [fromAssetId, setFromAssetId] = useState(initialValues?.fromAssetId ?? '')
  const [feeSide, setFeeSide] = useState<FeeSide | null>(initialValues?.feeSide ?? null)
  const [toAmount, setToAmount] = useState(initialValues?.toAmount ?? '')
  const [fromAmount, setFromAmount] = useState(initialValues?.fromAmount ?? '')
  const [feeAmount, setFeeAmount] = useState(initialValues?.feeAmount ?? '')
  const [exchangeRate, setExchangeRate] = useState(initialValues?.exchangeRate ?? '')
  const [entryMode, setEntryMode] = useState<EntryMode>(initialValues?.entryMode ?? 'both_amounts')
  const [notes, setNotes] = useState(initialValues?.notes ?? '')

  // Reset form when type changes — skip on initial mount (for duplicates)
  useEffect(() => {
    if (!isMounted.current) {
      isMounted.current = true
      return
    }
    setToAssetId('')
    setFromAssetId('')
    setFeeSide(null)
    setToAmount('')
    setFromAmount('')
    setFeeAmount('')
    setExchangeRate('')
    setEntryMode('both_amounts')
    setError(null)
  }, [type])

  function handleEntryModeChange(newMode: EntryMode) {
    setEntryMode(newMode)
    const from = parseFloat(fromAmount)
    const to = parseFloat(toAmount)
    const rate = parseFloat(exchangeRate)
    if (newMode === 'both_amounts') {
      setExchangeRate(!isNaN(from) && !isNaN(to) && to > 0 ? (from / to).toFixed(8) : '')
    } else if (newMode === 'to_amount_and_rate') {
      setFromAmount(!isNaN(to) && !isNaN(rate) ? (to * rate).toFixed(8) : '')
    } else {
      setToAmount(!isNaN(from) && !isNaN(rate) && rate > 0 ? (from / rate).toFixed(8) : '')
    }
  }

  function handleTradeField(field: 'fromAmount' | 'toAmount' | 'exchangeRate', value: string) {
    const derived = deriveByEntryMode(entryMode, field, value, { fromAmount, toAmount, exchangeRate })
    setFromAmount(derived.fromAmount)
    setToAmount(derived.toAmount)
    setExchangeRate(derived.exchangeRate)
  }

  const fromAsset = assetOptions.find((a) => a.assetId === fromAssetId)
  const toAssetOptionsForTransfer =
    type === 'transfer'
      ? assetOptions.filter((a) => a.symbolId === fromAsset?.symbolId && a.assetId !== fromAssetId)
      : assetOptions

  function isFieldLocked(field: 'fromAmount' | 'toAmount' | 'exchangeRate'): boolean {
    if (type !== 'trade') return false
    if (entryMode === 'both_amounts') return field === 'exchangeRate'
    if (entryMode === 'to_amount_and_rate') return field === 'fromAmount'
    return field === 'toAmount'
  }

  function validate(): string | null {
    if (!date) return 'Date is required'
    if ((type === 'deposit' || type === 'interest') && !toAssetId) return 'To asset is required'
    if ((type === 'deposit' || type === 'interest') && !toAmount) return 'Amount is required'
    if (type === 'debit' && !fromAssetId) return 'From asset is required'
    if (type === 'debit' && !fromAmount) return 'Amount is required'
    if (type === 'transfer') {
      if (!fromAssetId) return 'From asset is required'
      if (!toAssetId) return 'To asset is required'
      if (fromAssetId === toAssetId) return 'From and to assets must be different'
      const toAsset = assetOptions.find((a) => a.assetId === toAssetId)
      if (!fromAsset || fromAsset.symbolId !== toAsset?.symbolId) {
        return 'Transfer requires the same symbol in both assets'
      }
      if (!fromAmount) return 'From amount is required'
      if (!toAmount) return 'To amount is required'
    }
    if (type === 'trade') {
      if (!fromAssetId) return 'From asset is required'
      if (!toAssetId) return 'To asset is required'
      if (fromAssetId === toAssetId) return 'From and to assets must be different'
      if (!fromAmount) return 'From amount is required'
      if (!toAmount) return 'To amount is required'
      if (!exchangeRate) return 'Exchange rate is required'
    }
    if (feeSide && !feeAmount) return 'Fee amount is required when fee side is selected'
    return null
  }

  function handleSubmit() {
    const validationError = validate()
    if (validationError) {
      setError(validationError)
      return
    }
    setError(null)

    startTransition(async () => {
      const result = await createTransaction(householdId, {
        type,
        date: new Date(date).toISOString(),
        toAssetId: toAssetId || undefined,
        fromAssetId: fromAssetId || undefined,
        feeSide: feeSide ?? undefined,
        toAmount: toAmount ? parseFloat(toAmount) : undefined,
        fromAmount: fromAmount ? parseFloat(fromAmount) : undefined,
        feeAmount: feeAmount ? parseFloat(feeAmount) : undefined,
        exchangeRate: exchangeRate ? parseFloat(exchangeRate) : undefined,
        entryMode: type === 'trade' ? entryMode : undefined,
        notes: notes || undefined,
      })
      if (!result.success) {
        setError(result.error)
      } else {
        router.push('/transactions')
      }
    })
  }

  const showToAsset =
    type === 'deposit' || type === 'interest' || type === 'transfer' || type === 'trade'
  const showFromAsset = type === 'debit' || type === 'transfer' || type === 'trade'
  const showExchangeRate = type === 'trade'
  const showFee = type === 'trade' || type === 'transfer'

  return (
    <div className="space-y-5">
      {error && <p className="text-sm text-destructive">{error}</p>}

      {/* Type */}
      <div className="space-y-1">
        <Label>Type *</Label>
        <Select value={type} onValueChange={(v) => setType(v as TransactionType)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="deposit">Deposit</SelectItem>
            <SelectItem value="debit">Debit</SelectItem>
            <SelectItem value="transfer">Transfer</SelectItem>
            <SelectItem value="interest">Interest</SelectItem>
            <SelectItem value="trade">Trade</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Entry mode — Trade only */}
      {type === 'trade' && (
        <div className="space-y-1">
          <Label>Entry mode</Label>
          <div className="flex rounded-md border overflow-hidden text-sm">
            {([
              ['both_amounts', 'Both amounts'],
              ['to_amount_and_rate', 'To + rate'],
              ['from_amount_and_rate', 'From + rate'],
            ] as [EntryMode, string][]).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => handleEntryModeChange(value)}
                className={`flex-1 px-2 py-1.5 transition-colors ${
                  entryMode === value
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-background hover:bg-muted text-foreground'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Date */}
      <div className="space-y-1">
        <Label>Date *</Label>
        <Input
          type="datetime-local"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
      </div>

      {/* From asset */}
      {showFromAsset && (
        <AssetSelect
          label="From asset *"
          value={fromAssetId}
          options={assetOptions}
          onChange={setFromAssetId}
        />
      )}

      {/* From amount */}
      {showFromAsset && (
        <div className="space-y-1">
          <Label>From amount *</Label>
          <Input
            type="number"
            min="0"
            step="any"
            placeholder="0"
            value={fromAmount}
            disabled={isFieldLocked('fromAmount')}
            readOnly={isFieldLocked('fromAmount')}
            onChange={(e) =>
              type === 'trade'
                ? handleTradeField('fromAmount', e.target.value)
                : setFromAmount(e.target.value)
            }
          />
        </div>
      )}

      {/* To asset */}
      {showToAsset && (
        <AssetSelect
          label={type === 'transfer' ? 'To asset * (same symbol)' : 'To asset *'}
          value={toAssetId}
          options={type === 'transfer' ? toAssetOptionsForTransfer : assetOptions}
          onChange={setToAssetId}
          placeholder={
            type === 'transfer' && !fromAssetId ? 'Select from asset first…' : 'Select asset…'
          }
        />
      )}

      {/* To amount */}
      {showToAsset && (
        <div className="space-y-1">
          <Label>{type === 'trade' ? 'To amount *' : 'Amount *'}</Label>
          <Input
            type="number"
            min="0"
            step="any"
            placeholder="0"
            value={toAmount}
            disabled={isFieldLocked('toAmount')}
            readOnly={isFieldLocked('toAmount')}
            onChange={(e) =>
              type === 'trade'
                ? handleTradeField('toAmount', e.target.value)
                : setToAmount(e.target.value)
            }
          />
        </div>
      )}

      {/* Exchange rate (trade only) */}
      {showExchangeRate && (
        <div className="space-y-1">
          <Label>
            Exchange rate *{' '}
            <span className="text-xs text-muted-foreground font-normal">
              from units per 1 to unit
            </span>
          </Label>
          <Input
            type="number"
            min="0"
            step="any"
            placeholder="0"
            value={exchangeRate}
            disabled={isFieldLocked('exchangeRate')}
            readOnly={isFieldLocked('exchangeRate')}
            onChange={(e) => handleTradeField('exchangeRate', e.target.value)}
          />
        </div>
      )}

      {/* Fee (trade/transfer) */}
      {showFee && (
        <div className="space-y-2">
          <Label>Fee</Label>
          <div className="space-y-1.5">
            {([
              [null, 'None'],
              ['to', 'Deducted from received amount'],
              ['from', 'Added to sent amount'],
            ] as [FeeSide | null, string][]).map(([value, label]) => (
              <label key={String(value)} className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="radio"
                  name="feeSide"
                  checked={feeSide === value}
                  onChange={() => {
                    setFeeSide(value)
                    if (!value) setFeeAmount('')
                  }}
                  className="accent-primary"
                />
                {label}
              </label>
            ))}
          </div>
          {feeSide && (
            <div className="space-y-1">
              <Label>Fee amount</Label>
              <Input
                type="number"
                min="0"
                step="any"
                placeholder="0"
                value={feeAmount}
                onChange={(e) => setFeeAmount(e.target.value)}
              />
            </div>
          )}
        </div>
      )}

      {/* Notes */}
      <div className="space-y-1">
        <Label>Notes</Label>
        <textarea
          className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 min-h-[80px] resize-y"
          placeholder="Optional notes…"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <Button
          variant="outline"
          className="flex-1"
          onClick={() => router.push('/transactions')}
          disabled={isPending}
        >
          Cancel
        </Button>
        <Button className="flex-1" onClick={handleSubmit} disabled={isPending}>
          {isPending ? 'Saving…' : 'Save transaction'}
        </Button>
      </div>
    </div>
  )
}
