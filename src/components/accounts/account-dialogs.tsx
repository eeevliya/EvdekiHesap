'use client'

import { useState, useEffect, useTransition } from 'react'
import { Button } from '@/components/ui/button'
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
import { createAccount, updateAccount, deleteAccount } from '@/lib/actions/accounts'
import { createAsset, updateAssetAmount, deleteAsset } from '@/lib/actions/assets'
import type { Asset, AssetSymbol } from '@/lib/types/domain'

export interface AssetWithRate extends Asset {
  symbol: AssetSymbol
  currentValue: number | null
  lastRate: number | null
  rateFetchedAt: string | null
}

export interface AccountRow {
  id: string
  householdId: string
  ownerId: string
  name: string
  institution: string | null
  accountIdentifier: string | null
  ownerName: string
  assets: AssetWithRate[]
  totalValue: number
  latestRateFetchedAt: string | null
}

interface AccountFormState {
  name: string
  institution: string
  accountIdentifier: string
}

const emptyAccountForm: AccountFormState = { name: '', institution: '', accountIdentifier: '' }

interface AssetFormState {
  symbolId: string
  amount: string
}

const emptyAssetForm: AssetFormState = { symbolId: '', amount: '0' }

interface AccountDialogsProps {
  householdId: string
  currentUserId: string
  role: 'manager' | 'editor' | 'viewer'
  accounts: AccountRow[]
  symbols: AssetSymbol[]
  // Create account
  showCreateAccount: boolean
  onCreateClose: () => void
  // Edit account
  editingAccount: AccountRow | null
  onEditClose: () => void
  // Add asset
  addingAssetToAccountId: string | null
  onAddAssetClose: () => void
  // Edit asset
  editingAsset: (Asset & { symbol: AssetSymbol }) | null
  onEditAssetClose: () => void
}

export function AccountDialogs({
  householdId,
  currentUserId,
  role,
  accounts,
  symbols,
  showCreateAccount,
  onCreateClose,
  editingAccount,
  onEditClose,
  addingAssetToAccountId,
  onAddAssetClose,
  editingAsset,
  onEditAssetClose,
}: AccountDialogsProps) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [accountForm, setAccountForm] = useState<AccountFormState>(emptyAccountForm)
  const [assetForm, setAssetForm] = useState<AssetFormState>(emptyAssetForm)

  // Reset create form when dialog opens (onOpenChange doesn't fire for externally-controlled open)
  useEffect(() => {
    if (showCreateAccount) {
      setAccountForm(emptyAccountForm)
      setError(null)
    }
  }, [showCreateAccount])

  // Sync edit form when editingAccount changes
  useEffect(() => {
    if (editingAccount) {
      setAccountForm({
        name: editingAccount.name,
        institution: editingAccount.institution ?? '',
        accountIdentifier: editingAccount.accountIdentifier ?? '',
      })
      setError(null)
    }
  }, [editingAccount])

  function handleCreateAccount() {
    if (!accountForm.name.trim()) { setError('Account name is required'); return }
    setError(null)
    startTransition(async () => {
      const result = await createAccount(householdId, {
        name: accountForm.name,
        institution: accountForm.institution || undefined,
        accountIdentifier: accountForm.accountIdentifier || undefined,
      })
      if (!result.success) setError(result.error)
      else onCreateClose()
    })
  }

  function handleUpdateAccount() {
    if (!editingAccount) return
    if (!accountForm.name.trim()) { setError('Account name is required'); return }
    setError(null)
    startTransition(async () => {
      const result = await updateAccount(editingAccount.id, {
        name: accountForm.name,
        institution: accountForm.institution || undefined,
        accountIdentifier: accountForm.accountIdentifier || undefined,
      })
      if (!result.success) setError(result.error)
      else onEditClose()
    })
  }

  function handleCreateAsset() {
    if (!assetForm.symbolId) { setError('Please select a symbol'); return }
    const amount = parseFloat(assetForm.amount)
    if (isNaN(amount) || amount < 0) { setError('Amount must be a non-negative number'); return }
    setError(null)
    startTransition(async () => {
      const result = await createAsset(householdId, {
        accountId: addingAssetToAccountId!,
        symbolId: assetForm.symbolId,
        amount,
      })
      if (!result.success) setError(result.error)
      else { setAssetForm(emptyAssetForm); onAddAssetClose() }
    })
  }

  function handleUpdateAsset() {
    if (!editingAsset) return
    const amount = parseFloat(assetForm.amount)
    if (isNaN(amount) || amount < 0) { setError('Amount must be a non-negative number'); return }
    setError(null)
    startTransition(async () => {
      const result = await updateAssetAmount(editingAsset.id, amount)
      if (!result.success) setError(result.error)
      else onEditAssetClose()
    })
  }

  function availableSymbols(accountId: string) {
    const account = accounts.find((a) => a.id === accountId)
    if (!account) return symbols.filter((s) => s.isActive)
    const usedIds = new Set(account.assets.map((a) => a.symbolId))
    return symbols.filter((s) => !usedIds.has(s.id) && s.isActive)
  }

  return (
    <>
      {/* Create account */}
      <Dialog
        open={showCreateAccount}
        onOpenChange={(open) => { if (!open) onCreateClose() }}
      >
        <DialogContent>
          <DialogHeader><DialogTitle>Add Account</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            {error && <p className="text-sm" style={{ color: 'var(--color-negative)' }}>{error}</p>}
            <div className="space-y-1">
              <Label>Name *</Label>
              <Input placeholder="e.g. Garanti Bankası" value={accountForm.name}
                onChange={(e) => setAccountForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Institution</Label>
              <Input placeholder="e.g. Garanti BBVA" value={accountForm.institution}
                onChange={(e) => setAccountForm((f) => ({ ...f, institution: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Account identifier</Label>
              <Input placeholder="IBAN, wallet address, etc." value={accountForm.accountIdentifier}
                onChange={(e) => setAccountForm((f) => ({ ...f, accountIdentifier: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={onCreateClose}>Cancel</Button>
            <Button onClick={handleCreateAccount} disabled={isPending}>
              {isPending ? 'Creating…' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit account */}
      <Dialog
        open={!!editingAccount}
        onOpenChange={(open) => { if (!open) onEditClose() }}
      >
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Account — {editingAccount?.name}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            {error && <p className="text-sm" style={{ color: 'var(--color-negative)' }}>{error}</p>}
            <div className="space-y-1">
              <Label>Name *</Label>
              <Input value={accountForm.name}
                onChange={(e) => setAccountForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Institution</Label>
              <Input value={accountForm.institution}
                onChange={(e) => setAccountForm((f) => ({ ...f, institution: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Account identifier</Label>
              <Input value={accountForm.accountIdentifier}
                onChange={(e) => setAccountForm((f) => ({ ...f, accountIdentifier: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={onEditClose}>Cancel</Button>
            <Button onClick={handleUpdateAccount} disabled={isPending}>
              {isPending ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add asset */}
      <Dialog
        open={!!addingAssetToAccountId}
        onOpenChange={(open) => {
          if (!open) { setAssetForm(emptyAssetForm); onAddAssetClose() }
        }}
      >
        <DialogContent>
          <DialogHeader><DialogTitle>Add Asset</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            {error && <p className="text-sm" style={{ color: 'var(--color-negative)' }}>{error}</p>}
            <div className="space-y-1">
              <Label>Symbol *</Label>
              <Select value={assetForm.symbolId}
                onValueChange={(v) => setAssetForm((f) => ({ ...f, symbolId: v }))}>
                <SelectTrigger><SelectValue placeholder="Select a symbol…" /></SelectTrigger>
                <SelectContent>
                  {availableSymbols(addingAssetToAccountId ?? '').map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.code}{s.name ? ` — ${s.name}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Initial amount</Label>
              <Input type="number" min="0" step="any" value={assetForm.amount}
                onChange={(e) => setAssetForm((f) => ({ ...f, amount: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={onAddAssetClose}>Cancel</Button>
            <Button onClick={handleCreateAsset} disabled={isPending}>
              {isPending ? 'Adding…' : 'Add'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit asset amount */}
      <Dialog
        open={!!editingAsset}
        onOpenChange={(open) => {
          if (!open) onEditAssetClose()
          else if (editingAsset) setAssetForm({ symbolId: editingAsset.symbolId, amount: String(editingAsset.amount) })
        }}
      >
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Amount — {editingAsset?.symbol.code}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            {error && <p className="text-sm" style={{ color: 'var(--color-negative)' }}>{error}</p>}
            <div className="space-y-1">
              <Label>Amount</Label>
              <Input type="number" min="0" step="any" value={assetForm.amount}
                onChange={(e) => setAssetForm((f) => ({ ...f, amount: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={onEditAssetClose}>Cancel</Button>
            <Button onClick={handleUpdateAsset} disabled={isPending}>
              {isPending ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
