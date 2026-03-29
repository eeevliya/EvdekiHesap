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
import { createAccount, updateAccount, deleteAccount } from '@/lib/actions/accounts'
import { createAsset, updateAssetAmount, deleteAsset } from '@/lib/actions/assets'
import type { Account, Asset, Symbol } from '@/lib/types/domain'

interface AccountRow extends Account {
  ownerName: string
  assets: (Asset & { symbol: Symbol })[]
}

interface Props {
  householdId: string
  currentUserId: string
  role: 'manager' | 'editor' | 'viewer'
  accounts: AccountRow[]
  symbols: Symbol[]
}

// ─── Account form ─────────────────────────────────────────────────────────────

interface AccountFormState {
  name: string
  institution: string
  accountIdentifier: string
}

const emptyAccountForm: AccountFormState = {
  name: '',
  institution: '',
  accountIdentifier: '',
}

// ─── Asset form ───────────────────────────────────────────────────────────────

interface AssetFormState {
  symbolId: string
  amount: string
}

const emptyAssetForm: AssetFormState = { symbolId: '', amount: '0' }

export function AccountsManager({ householdId, currentUserId, role, accounts, symbols }: Props) {
  const [isPending, startTransition] = useTransition()
  const [expandedAccountId, setExpandedAccountId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Account dialogs
  const [showCreateAccount, setShowCreateAccount] = useState(false)
  const [editingAccount, setEditingAccount] = useState<AccountRow | null>(null)
  const [accountForm, setAccountForm] = useState<AccountFormState>(emptyAccountForm)

  // Asset dialogs
  const [addingAssetToAccountId, setAddingAssetToAccountId] = useState<string | null>(null)
  const [editingAsset, setEditingAsset] = useState<(Asset & { symbol: Symbol }) | null>(null)
  const [assetForm, setAssetForm] = useState<AssetFormState>(emptyAssetForm)

  const canMutate = role === 'manager' || role === 'editor'

  // ── Account actions ──

  function openCreateAccount() {
    setAccountForm(emptyAccountForm)
    setError(null)
    setShowCreateAccount(true)
  }

  function openEditAccount(account: AccountRow) {
    setAccountForm({
      name: account.name,
      institution: account.institution ?? '',
      accountIdentifier: account.accountIdentifier ?? '',
    })
    setError(null)
    setEditingAccount(account)
  }

  function canEditAccount(account: AccountRow) {
    return role === 'manager' || (role === 'editor' && account.ownerId === currentUserId)
  }

  function handleCreateAccount() {
    if (!accountForm.name.trim()) {
      setError('Account name is required')
      return
    }
    setError(null)
    startTransition(async () => {
      const result = await createAccount(householdId, {
        name: accountForm.name,
        institution: accountForm.institution || undefined,
        accountIdentifier: accountForm.accountIdentifier || undefined,
      })
      if (!result.success) {
        setError(result.error)
      } else {
        setShowCreateAccount(false)
      }
    })
  }

  function handleUpdateAccount() {
    if (!editingAccount) return
    if (!accountForm.name.trim()) {
      setError('Account name is required')
      return
    }
    setError(null)
    startTransition(async () => {
      const result = await updateAccount(editingAccount.id, {
        name: accountForm.name,
        institution: accountForm.institution || undefined,
        accountIdentifier: accountForm.accountIdentifier || undefined,
      })
      if (!result.success) {
        setError(result.error)
      } else {
        setEditingAccount(null)
      }
    })
  }

  function handleDeleteAccount(account: AccountRow) {
    if (!confirm(`Delete account "${account.name}"? All assets in this account will also be deleted.`)) return
    startTransition(async () => {
      const result = await deleteAccount(account.id)
      if (!result.success) alert(result.error)
    })
  }

  // ── Asset actions ──

  function openAddAsset(accountId: string) {
    setAssetForm(emptyAssetForm)
    setError(null)
    setAddingAssetToAccountId(accountId)
  }

  function openEditAsset(asset: Asset & { symbol: Symbol }) {
    setAssetForm({ symbolId: asset.symbolId, amount: String(asset.amount) })
    setError(null)
    setEditingAsset(asset)
  }

  function handleCreateAsset() {
    if (!assetForm.symbolId) {
      setError('Please select a symbol')
      return
    }
    const amount = parseFloat(assetForm.amount)
    if (isNaN(amount) || amount < 0) {
      setError('Amount must be a non-negative number')
      return
    }
    setError(null)
    startTransition(async () => {
      const result = await createAsset(householdId, {
        accountId: addingAssetToAccountId!,
        symbolId: assetForm.symbolId,
        amount,
      })
      if (!result.success) {
        setError(result.error)
      } else {
        setAddingAssetToAccountId(null)
      }
    })
  }

  function handleUpdateAsset() {
    if (!editingAsset) return
    const amount = parseFloat(assetForm.amount)
    if (isNaN(amount) || amount < 0) {
      setError('Amount must be a non-negative number')
      return
    }
    setError(null)
    startTransition(async () => {
      const result = await updateAssetAmount(editingAsset.id, amount)
      if (!result.success) {
        setError(result.error)
      } else {
        setEditingAsset(null)
      }
    })
  }

  function handleDeleteAsset(asset: Asset & { symbol: Symbol }) {
    if (!confirm(`Remove ${asset.symbol.code} from this account?`)) return
    startTransition(async () => {
      const result = await deleteAsset(asset.id)
      if (!result.success) alert(result.error)
    })
  }

  // ── Available symbols for asset picker (exclude already-added ones) ──
  function availableSymbols(account: AccountRow) {
    const usedIds = new Set(account.assets.map((a) => a.symbolId))
    return symbols.filter((s) => !usedIds.has(s.id) && s.isActive)
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {accounts.length === 0
            ? 'No accounts yet.'
            : `${accounts.length} account${accounts.length !== 1 ? 's' : ''}`}
        </p>
        {canMutate && (
          <Button onClick={openCreateAccount} size="sm">
            Add account
          </Button>
        )}
      </div>

      {/* Account list */}
      <div className="space-y-3">
        {accounts.map((account) => {
          const isExpanded = expandedAccountId === account.id

          return (
            <div key={account.id} className="border rounded-lg overflow-hidden">
              {/* Account row */}
              <div
                className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => setExpandedAccountId(isExpanded ? null : account.id)}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{account.name}</span>
                    {account.institution && (
                      <span className="text-sm text-muted-foreground">{account.institution}</span>
                    )}
                    <Badge variant="outline" className="text-xs">
                      {account.assets.length} asset{account.assets.length !== 1 ? 's' : ''}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Owner: {account.ownerName}
                    {account.accountIdentifier && ` · ${account.accountIdentifier}`}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {canEditAccount(account) && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          openEditAccount(account)
                        }}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDeleteAccount(account)
                        }}
                        disabled={isPending}
                      >
                        Delete
                      </Button>
                    </>
                  )}
                  <span className="text-muted-foreground text-sm">{isExpanded ? '▲' : '▼'}</span>
                </div>
              </div>

              {/* Assets panel */}
              {isExpanded && (
                <div className="border-t bg-muted/20 px-4 py-3 space-y-3">
                  {account.assets.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No assets in this account.</p>
                  ) : (
                    <div className="divide-y">
                      {account.assets.map((asset) => (
                        <div
                          key={asset.id}
                          className="flex items-center justify-between py-2 gap-4"
                        >
                          <div className="min-w-0 flex-1">
                            <span className="font-mono font-semibold">{asset.symbol.code}</span>
                            {asset.symbol.name && (
                              <span className="text-sm text-muted-foreground ml-2">
                                {asset.symbol.name}
                              </span>
                            )}
                          </div>
                          <span className="text-sm font-medium">{asset.amount}</span>
                          {canMutate && (
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openEditAsset(asset)}
                              >
                                Edit
                              </Button>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => handleDeleteAsset(asset)}
                                disabled={isPending}
                              >
                                Remove
                              </Button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {canMutate && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openAddAsset(account.id)}
                    >
                      Add asset
                    </Button>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Create account dialog */}
      <Dialog open={showCreateAccount} onOpenChange={setShowCreateAccount}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Account</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="space-y-1">
              <Label>Name *</Label>
              <Input
                placeholder="e.g. Garanti Bankası"
                value={accountForm.name}
                onChange={(e) => setAccountForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label>Institution</Label>
              <Input
                placeholder="e.g. Garanti BBVA"
                value={accountForm.institution}
                onChange={(e) => setAccountForm((f) => ({ ...f, institution: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label>Account identifier</Label>
              <Input
                placeholder="IBAN, wallet address, etc."
                value={accountForm.accountIdentifier}
                onChange={(e) =>
                  setAccountForm((f) => ({ ...f, accountIdentifier: e.target.value }))
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateAccount(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateAccount} disabled={isPending}>
              {isPending ? 'Creating…' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit account dialog */}
      <Dialog open={!!editingAccount} onOpenChange={(open) => !open && setEditingAccount(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Account — {editingAccount?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="space-y-1">
              <Label>Name *</Label>
              <Input
                value={accountForm.name}
                onChange={(e) => setAccountForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label>Institution</Label>
              <Input
                value={accountForm.institution}
                onChange={(e) => setAccountForm((f) => ({ ...f, institution: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label>Account identifier</Label>
              <Input
                value={accountForm.accountIdentifier}
                onChange={(e) =>
                  setAccountForm((f) => ({ ...f, accountIdentifier: e.target.value }))
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingAccount(null)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateAccount} disabled={isPending}>
              {isPending ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add asset dialog */}
      <Dialog
        open={!!addingAssetToAccountId}
        onOpenChange={(open) => !open && setAddingAssetToAccountId(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Asset</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="space-y-1">
              <Label>Symbol *</Label>
              <Select
                value={assetForm.symbolId}
                onValueChange={(v) => setAssetForm((f) => ({ ...f, symbolId: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a symbol…" />
                </SelectTrigger>
                <SelectContent>
                  {availableSymbols(
                    accounts.find((a) => a.id === addingAssetToAccountId) ?? {
                      id: '',
                      assets: [],
                    } as unknown as AccountRow
                  ).map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.code}{s.name ? ` — ${s.name}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Initial amount</Label>
              <Input
                type="number"
                min="0"
                step="any"
                value={assetForm.amount}
                onChange={(e) => setAssetForm((f) => ({ ...f, amount: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddingAssetToAccountId(null)}>
              Cancel
            </Button>
            <Button onClick={handleCreateAsset} disabled={isPending}>
              {isPending ? 'Adding…' : 'Add'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit asset amount dialog */}
      <Dialog open={!!editingAsset} onOpenChange={(open) => !open && setEditingAsset(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Amount — {editingAsset?.symbol.code}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="space-y-1">
              <Label>Amount</Label>
              <Input
                type="number"
                min="0"
                step="any"
                value={assetForm.amount}
                onChange={(e) => setAssetForm((f) => ({ ...f, amount: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingAsset(null)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateAsset} disabled={isPending}>
              {isPending ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
