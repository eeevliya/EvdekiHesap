'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { createAssetSymbol, updateAssetSymbol, deleteAssetSymbol } from '@/lib/actions/symbols'
import type { AssetSymbol, SymbolType } from '@/lib/types/domain'

const SYMBOL_TYPE_LABELS: Record<SymbolType, string> = {
  fiat_currency: 'Fiat Currency',
  stock: 'Stock',
  tefas_fund: 'Tefas Fund',
  physical_commodity: 'Physical Commodity',
  cryptocurrency: 'Cryptocurrency',
  custom: 'Custom',
}

interface Props {
  householdId: string
  isManager: boolean
  globalSymbols: AssetSymbol[]
  householdSymbols: AssetSymbol[]
  fiatSymbols: AssetSymbol[]   // active fiat symbols for the conversion fiat dropdown
}

interface SymbolFormState {
  code: string
  name: string
  description: string
  type: SymbolType
  primaryConversionFiat: string
}

const emptyForm: SymbolFormState = {
  code: '',
  name: '',
  description: '',
  type: 'custom',
  primaryConversionFiat: '',
}

export function SymbolsManager({ householdId, isManager, globalSymbols, householdSymbols, fiatSymbols }: Props) {
  const [isPending, startTransition] = useTransition()
  const [showCreate, setShowCreate] = useState(false)
  const [editingSymbol, setEditingSymbol] = useState<AssetSymbol | null>(null)
  const [form, setForm] = useState<SymbolFormState>(emptyForm)
  const [error, setError] = useState<string | null>(null)

  function openCreate() {
    setForm(emptyForm)
    setError(null)
    setShowCreate(true)
  }

  function openEdit(symbol: AssetSymbol) {
    setForm({
      code: symbol.code,
      name: symbol.name ?? '',
      description: symbol.description ?? '',
      type: symbol.type,
      primaryConversionFiat: symbol.primaryConversionFiat ?? '',
    })
    setError(null)
    setEditingSymbol(symbol)
  }

  function handleCreate() {
    if (!form.code.trim()) {
      setError('Code is required')
      return
    }
    setError(null)
    startTransition(async () => {
      const result = await createAssetSymbol(householdId, {
        code: form.code,
        name: form.name || undefined,
        description: form.description || undefined,
        type: form.type,
        primaryConversionFiat: form.primaryConversionFiat || undefined,
      })
      if (!result.success) {
        setError(result.error)
      } else {
        setShowCreate(false)
      }
    })
  }

  function handleUpdate() {
    if (!editingSymbol) return
    setError(null)
    startTransition(async () => {
      const result = await updateAssetSymbol(editingSymbol.id, {
        name: form.name || null,
        description: form.description || null,
      })
      if (!result.success) {
        setError(result.error)
      } else {
        setEditingSymbol(null)
      }
    })
  }

  function handleToggleActive(symbol: AssetSymbol) {
    startTransition(async () => {
      await updateAssetSymbol(symbol.id, { isActive: !symbol.isActive })
    })
  }

  function handleDelete(symbol: AssetSymbol) {
    if (!confirm(`Delete symbol "${symbol.code}"? This cannot be undone.`)) return
    startTransition(async () => {
      const result = await deleteAssetSymbol(symbol.id)
      if (!result.success) alert(result.error)
    })
  }

  return (
    <div className="space-y-8">
      {/* Household-custom symbols */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Custom Symbols</h2>
            <p className="text-sm text-muted-foreground">
              Symbols specific to your household (stocks, custom funds, etc.)
            </p>
          </div>
          {isManager && (
            <Button onClick={openCreate} size="sm">
              Add symbol
            </Button>
          )}
        </div>

        {householdSymbols.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">
            No custom symbols yet.{isManager ? ' Add one above.' : ''}
          </p>
        ) : (
          <div className="divide-y border rounded-lg">
            {householdSymbols.map((symbol) => (
              <div key={symbol.id} className="flex items-center justify-between px-4 py-3 gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono font-semibold">{symbol.code}</span>
                    {symbol.name && (
                      <span className="text-sm text-muted-foreground truncate">{symbol.name}</span>
                    )}
                    <Badge variant={symbol.isActive ? 'default' : 'secondary'}>
                      {SYMBOL_TYPE_LABELS[symbol.type]}
                    </Badge>
                    {!symbol.isActive && (
                      <Badge variant="outline" className="text-muted-foreground">
                        Inactive
                      </Badge>
                    )}
                  </div>
                  {symbol.description && (
                    <p className="text-xs text-muted-foreground mt-1">{symbol.description}</p>
                  )}
                </div>
                {isManager && (
                  <div className="flex gap-2 shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleToggleActive(symbol)}
                      disabled={isPending}
                    >
                      {symbol.isActive ? 'Deactivate' : 'Activate'}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openEdit(symbol)}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDelete(symbol)}
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
      </section>

      {/* Global symbols — read-only */}
      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Global Symbols</h2>
          <p className="text-sm text-muted-foreground">
            Built-in symbols available to all households. Read-only.
          </p>
        </div>

        <div className="divide-y border rounded-lg">
          {globalSymbols.map((symbol) => (
            <div key={symbol.id} className="flex items-center gap-3 px-4 py-3">
              <span className="font-mono font-semibold w-28 shrink-0">{symbol.code}</span>
              <span className="text-sm text-muted-foreground flex-1 truncate">
                {symbol.name ?? '—'}
              </span>
              <Badge variant="outline">{SYMBOL_TYPE_LABELS[symbol.type]}</Badge>
            </div>
          ))}
        </div>
      </section>

      {/* Create dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Custom Symbol</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {error && <p className="text-sm text-destructive">{error}</p>}

            <div className="space-y-1">
              <Label>Code *</Label>
              <Input
                placeholder={
                  form.type === 'cryptocurrency' ? 'e.g. XRPUSDT' :
                  form.type === 'stock' ? 'e.g. THYAO.IS or AAPL' :
                  form.type === 'tefas_fund' ? 'e.g. OSD' :
                  'e.g. MYASSET'
                }
                value={form.code}
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
              />
            </div>

            <div className="space-y-1">
              <Label>Type *</Label>
              <Select
                value={form.type}
                onValueChange={(v) => {
                  const type = v as SymbolType
                  setForm((f) => ({
                    ...f,
                    type,
                    primaryConversionFiat: type === 'fiat_currency' ? '' : f.primaryConversionFiat,
                  }))
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.entries(SYMBOL_TYPE_LABELS) as [SymbolType, string][]).map(
                    ([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    )
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>Name</Label>
              <Input
                placeholder="e.g. Turkish Airlines"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>

            {form.type !== 'fiat_currency' && (
              <div className="space-y-1">
                <Label>Primary conversion fiat</Label>
                <Select
                  value={form.primaryConversionFiat}
                  onValueChange={(v) => setForm((f) => ({ ...f, primaryConversionFiat: v === '__none__' ? '' : v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select fiat currency…" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">None</SelectItem>
                    {fiatSymbols.map((s) => (
                      <SelectItem key={s.id} value={s.code}>
                        {s.code}{s.name ? ` — ${s.name}` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  The fiat currency in which this symbol is priced.
                </p>
              </div>
            )}

            <div className="space-y-1">
              <Label>Description</Label>
              <textarea
                className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                rows={2}
                placeholder="Optional description"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={isPending}>
              {isPending ? 'Creating…' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={!!editingSymbol} onOpenChange={(open) => !open && setEditingSymbol(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Symbol — {editingSymbol?.code}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {error && <p className="text-sm text-destructive">{error}</p>}

            <div className="space-y-1">
              <Label>Name</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>

            <div className="space-y-1">
              <Label>Description</Label>
              <textarea
                className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                rows={2}
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingSymbol(null)}>
              Cancel
            </Button>
            <Button onClick={handleUpdate} disabled={isPending}>
              {isPending ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
