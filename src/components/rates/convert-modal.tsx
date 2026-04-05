'use client'

import { useState } from 'react'
import { ArrowLeftRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { SymbolRateRow } from '@/lib/actions/rates'

interface ConvertModalProps {
  open: boolean
  onClose: () => void
  symbols: SymbolRateRow[]
}

export function ConvertModal({ open, onClose, symbols }: ConvertModalProps) {
  const activeSymbols = symbols.filter((s) => s.isActive && s.currentRate != null)

  const [fromSymbolId, setFromSymbolId] = useState<string>('')
  const [toSymbolId, setToSymbolId] = useState<string>('')
  const [amount, setAmount] = useState<string>('')

  function swap() {
    setFromSymbolId(toSymbolId)
    setToSymbolId(fromSymbolId)
  }

  // Compute result client-side using loaded rates
  // All rates are in terms of their primary_conversion_fiat (usually TRY).
  // Convert via TRY: from_amount × from_rate → TRY → / to_rate
  const result = (() => {
    const fromSym = activeSymbols.find((s) => s.symbolId === fromSymbolId)
    const toSym = activeSymbols.find((s) => s.symbolId === toSymbolId)
    const amtNum = parseFloat(amount)
    if (!fromSym || !toSym || isNaN(amtNum) || amtNum <= 0) return null
    if (!fromSym.currentRate || !toSym.currentRate) return null
    // Both rates are in TRY units (per 1 unit of the symbol)
    // This is approximate for cross-currency pairs (USD/EUR) but sufficient for a converter
    const valueTRY = amtNum * fromSym.currentRate
    return valueTRY / toSym.currentRate
  })()

  function formatResult(v: number): string {
    if (v >= 1000) return v.toLocaleString('en-US', { maximumFractionDigits: 4 })
    if (v >= 1) return v.toLocaleString('en-US', { maximumFractionDigits: 6 })
    return v.toLocaleString('en-US', { maximumFractionDigits: 10 })
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Convert</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* From */}
          <div className="space-y-1">
            <Label>From</Label>
            <Select value={fromSymbolId} onValueChange={setFromSymbolId}>
              <SelectTrigger>
                <SelectValue placeholder="Select symbol…" />
              </SelectTrigger>
              <SelectContent>
                {activeSymbols.map((s) => (
                  <SelectItem key={s.symbolId} value={s.symbolId}>
                    {s.code}{s.name ? ` — ${s.name}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Amount */}
          <div className="space-y-1">
            <Label>Amount</Label>
            <Input
              type="number"
              min="0"
              step="any"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="font-mono"
              placeholder="0.00"
            />
          </div>

          {/* Swap */}
          <div className="flex justify-center">
            <Button variant="outline" size="sm" onClick={swap} className="min-h-[44px] min-w-[44px]">
              <ArrowLeftRight className="size-4" />
            </Button>
          </div>

          {/* To */}
          <div className="space-y-1">
            <Label>To</Label>
            <Select value={toSymbolId} onValueChange={setToSymbolId}>
              <SelectTrigger>
                <SelectValue placeholder="Select symbol…" />
              </SelectTrigger>
              <SelectContent>
                {activeSymbols.map((s) => (
                  <SelectItem key={s.symbolId} value={s.symbolId}>
                    {s.code}{s.name ? ` — ${s.name}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Result */}
          <div
            className="rounded-xl px-4 py-3 min-h-[56px] flex items-center"
            style={{ background: 'var(--color-bg-base)', border: '1px solid var(--color-border)' }}
          >
            {result != null ? (
              <span
                className="font-mono text-lg font-semibold"
                style={{ color: 'var(--color-accent)' }}
              >
                {formatResult(result)} {activeSymbols.find((s) => s.symbolId === toSymbolId)?.code ?? ''}
              </span>
            ) : (
              <span className="text-sm" style={{ color: 'var(--color-fg-disabled)' }}>
                Select symbols and enter an amount to convert
              </span>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
