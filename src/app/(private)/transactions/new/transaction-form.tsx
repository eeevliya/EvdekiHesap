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
  const [exchangeRateOverride, setExchangeRateOverride] = useState(false)
  const [notes, setNotes] = useState('')

  // Reset asset selections when type changes
  useEffect(() => {
    setToAssetId('')
    setFromAssetId('')
    setFeeAssetId('')
    setToAmount('')
    setFromAmount('')
    setFeeAmount('')
    setExchangeRate('')
    setExchangeRateOverride(false)
    setError(null)
  }, [type])

  // Auto-compute exchange_rate for trades
  useEffect(() => {
    if (type === 'trade' && !exchangeRateOverride) {
      const from = parseFloat(fromAmount)
      const to = parseFloat(toAmount)
      if (!isNaN(from) && !isNaN(to) && from > 0) {
        setExchangeRate((to / from).toFixed(8))
      } else {
        setExchangeRate('')
      }
    }
  }, [toAmount, fromAmount, type, exchangeRateOverride])

  // For Transfer: filter toAsset options to only match fromAsset's symbol
  const fromAsset = assetOptions.find((a) => a.assetId === fromAssetId)
  const toAssetOptionsForTransfer = type === 'transfer'
    ? assetOptions.filter((a) => a.symbolId === fromAsset?.symbolId && a.assetId !== fromAssetId)
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
      if (!fromAsset || fromAsset.symbolId !== assetOptions.find((a) => a.assetId === toAssetId)?.symbolId) {
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

  const showToAsset = type === 'deposit' || type === 'interest' || type === 'transfer' || type === 'trade'
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
          label={type === 'trade' ? 'Sell asset *' : 'From asset *'}
          value={fromAssetId}
          options={assetOptions}
          onChange={setFromAssetId}
        />
      )}

      {/* From amount */}
      {showFromAsset && (
        <div className="space-y-1">
          <Label>
            {type === 'trade' ? 'Sell amount *' : 'From amount *'}
          </Label>
          <Input
            type="number"
            min="0"
            step="any"
            placeholder="0"
            value={fromAmount}
            onChange={(e) => setFromAmount(e.target.value)}
          />
        </div>
      )}

      {/* To asset */}
      {showToAsset && (
        <AssetSelect
          label={type === 'trade' ? 'Buy asset *' : type === 'transfer' ? 'To asset * (same symbol)' : 'To asset *'}
          value={toAssetId}
          options={type === 'transfer' ? toAssetOptionsForTransfer : assetOptions}
          onChange={setToAssetId}
          placeholder={
            type === 'transfer' && !fromAssetId
              ? 'Select from asset first…'
              : 'Select asset…'
          }
        />
      )}

      {/* To amount */}
      {showToAsset && (
        <div className="space-y-1">
          <Label>
            {type === 'trade' ? 'Buy amount *' : 'Amount *'}
          </Label>
          <Input
            type="number"
            min="0"
            step="any"
            placeholder="0"
            value={toAmount}
            onChange={(e) => setToAmount(e.target.value)}
          />
        </div>
      )}

      {/* Exchange rate (trade only) */}
      {showExchangeRate && (
        <div className="space-y-1">
          <Label>
            Exchange rate *{' '}
            <span className="text-xs text-muted-foreground font-normal">
              (auto-computed; edit to override)
            </span>
          </Label>
          <Input
            type="number"
            min="0"
            step="any"
            placeholder="0"
            value={exchangeRate}
            onChange={(e) => {
              setExchangeRateOverride(true)
              setExchangeRate(e.target.value)
            }}
          />
        </div>
      )}

      {/* Fee (trade/transfer) */}
      {showFee && (
        <>
          <div className="space-y-1">
            <Label>Fee asset</Label>
            <Select value={feeAssetId} onValueChange={setFeeAssetId}>
              <SelectTrigger>
                <SelectValue placeholder="None" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">None</SelectItem>
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
