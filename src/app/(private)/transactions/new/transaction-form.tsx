'use client'

import { useState, useTransition, useEffect } from 'react'
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
import type { TransactionType } from '@/lib/types/domain'
import type { AssetRef } from '../page'

interface Props {
  householdId: string
  assetOptions: AssetRef[]
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

// ── Three-way trade field derivation ─────────────────────────────────────────
// Convention: exchange_rate = fromAmount / toAmount  (sell units per 1 buy unit)
// e.g. selling 100 000 USD for 1 BTC → rate = 100 000
//
// lastEdited tracks the two fields the user most recently typed.
// The third field is always auto-derived from the other two.

type TradeField = 'fromAmount' | 'toAmount' | 'exchangeRate'
const ALL_TRADE_FIELDS: TradeField[] = ['fromAmount', 'toAmount', 'exchangeRate']

function deriveThird(
  field: TradeField,
  value: string,
  current: Record<TradeField, string>,
  prevLastEdited: [TradeField, TradeField]
): { values: Record<TradeField, string>; lastEdited: [TradeField, TradeField] } {
  // Build new values with the just-edited field applied
  const next: Record<TradeField, string> = { ...current, [field]: value }

  // The second element of the new lastEdited is the other recently-edited field
  const partner = prevLastEdited[0] === field ? prevLastEdited[1] : prevLastEdited[0]
  const newLastEdited: [TradeField, TradeField] = [field, partner]

  // The derived field is whichever is not in newLastEdited
  const derived = ALL_TRADE_FIELDS.find((f) => f !== field && f !== partner)!

  const from = parseFloat(next.fromAmount)
  const to = parseFloat(next.toAmount)
  const rate = parseFloat(next.exchangeRate)

  if (derived === 'exchangeRate') {
    // rate = fromAmount / toAmount
    next.exchangeRate =
      !isNaN(from) && !isNaN(to) && to > 0 ? (from / to).toFixed(8) : ''
  } else if (derived === 'toAmount') {
    // toAmount = fromAmount / exchangeRate
    next.toAmount =
      !isNaN(from) && !isNaN(rate) && rate > 0 ? (from / rate).toFixed(8) : ''
  } else {
    // fromAmount = toAmount * exchangeRate
    next.fromAmount =
      !isNaN(to) && !isNaN(rate) ? (to * rate).toFixed(8) : ''
  }

  return { values: next, lastEdited: newLastEdited }
}

export function TransactionForm({ householdId, assetOptions }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const [type, setType] = useState<TransactionType>('deposit')
  const [date, setDate] = useState(nowLocal())
  const [toAssetId, setToAssetId] = useState('')
  const [fromAssetId, setFromAssetId] = useState('')
  const [feeAssetId, setFeeAssetId] = useState('')
  const [toAmount, setToAmount] = useState('')
  const [fromAmount, setFromAmount] = useState('')
  const [feeAmount, setFeeAmount] = useState('')
  const [exchangeRate, setExchangeRate] = useState('')
  // lastEdited: the two trade fields the user most recently typed
  // Default: [fromAmount, toAmount] → exchange rate is auto-derived
  const [lastEdited, setLastEdited] = useState<[TradeField, TradeField]>(['fromAmount', 'toAmount'])
  const [notes, setNotes] = useState('')

  // Reset trade-related fields when type changes
  useEffect(() => {
    setToAssetId('')
    setFromAssetId('')
    setFeeAssetId('')
    setToAmount('')
    setFromAmount('')
    setFeeAmount('')
    setExchangeRate('')
    setLastEdited(['fromAmount', 'toAmount'])
    setError(null)
  }, [type])

  // Handler for the three interdependent trade amount fields
  function handleTradeField(field: TradeField, value: string) {
    const { values, lastEdited: newLastEdited } = deriveThird(
      field,
      value,
      { fromAmount, toAmount, exchangeRate },
      lastEdited
    )
    setFromAmount(values.fromAmount)
    setToAmount(values.toAmount)
    setExchangeRate(values.exchangeRate)
    setLastEdited(newLastEdited)
  }

  // For Transfer: filter toAsset options to only match fromAsset's symbol
  const fromAsset = assetOptions.find((a) => a.assetId === fromAssetId)
  const toAssetOptionsForTransfer =
    type === 'transfer'
      ? assetOptions.filter(
          (a) => a.symbolId === fromAsset?.symbolId && a.assetId !== fromAssetId
        )
      : assetOptions

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
      if (
        !fromAsset ||
        fromAsset.symbolId !== assetOptions.find((a) => a.assetId === toAssetId)?.symbolId
      ) {
        return 'Transfer requires the same symbol in both assets'
      }
      if (!fromAmount) return 'From amount is required'
      if (!toAmount) return 'To amount is required'
    }
    if (type === 'trade') {
      if (!fromAssetId) return 'Sell asset is required'
      if (!toAssetId) return 'Buy asset is required'
      if (fromAssetId === toAssetId) return 'Sell and buy assets must be different'
      if (!fromAmount) return 'Sell amount is required'
      if (!toAmount) return 'Buy amount is required'
      if (!exchangeRate) return 'Exchange rate is required'
    }
    if (feeAmount && !feeAssetId) return 'Fee asset is required when fee amount is specified'
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
        feeAssetId: feeAssetId || undefined,
        toAmount: toAmount ? parseFloat(toAmount) : undefined,
        fromAmount: fromAmount ? parseFloat(fromAmount) : undefined,
        feeAmount: feeAmount ? parseFloat(feeAmount) : undefined,
        exchangeRate: exchangeRate ? parseFloat(exchangeRate) : undefined,
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
              from units per 1 to unit — edit any two fields to derive the third
            </span>
          </Label>
          <Input
            type="number"
            min="0"
            step="any"
            placeholder="0"
            value={exchangeRate}
            onChange={(e) => handleTradeField('exchangeRate', e.target.value)}
          />
        </div>
      )}

      {/* Fee (trade/transfer) */}
      {showFee && (
        <>
          <div className="space-y-1">
            <Label>Fee asset</Label>
            <Select
              value={feeAssetId || '__none__'}
              onValueChange={(v) => setFeeAssetId(v === '__none__' ? '' : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="None" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">None</SelectItem>
                {assetOptions.map((a) => (
                  <SelectItem key={a.assetId} value={a.assetId}>
                    {a.accountName} — {a.symbolCode}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {feeAssetId && (
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
        </>
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
