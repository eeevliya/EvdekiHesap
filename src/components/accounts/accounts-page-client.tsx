'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Pencil, Trash2, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { RelativeTime } from '@/components/shared/relative-time'
import { EmptyState } from '@/components/shared/empty-state'
import { Wallet } from 'lucide-react'
import { formatCurrency, formatPct } from '@/lib/utils/format'
import { deleteAccount } from '@/lib/actions/accounts'
import { deleteAsset } from '@/lib/actions/assets'
import { AccountDialogs } from './account-dialogs'
import type { DisplayCurrency } from '@/lib/types/domain'
import type { AccountRow, AssetWithRate } from './account-dialogs'

interface AccountsPageClientProps {
  householdId: string
  currentUserId: string
  role: 'manager' | 'editor' | 'viewer'
  accounts: AccountRow[]
  symbols: Symbol[]
  selectedAccountId: string | null
  displayCurrency: DisplayCurrency
}

export function AccountsPageClient({
  householdId,
  currentUserId,
  role,
  accounts,
  symbols,
  selectedAccountId,
  displayCurrency,
}: AccountsPageClientProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  // Dialog state
  const [showCreateAccount, setShowCreateAccount] = useState(false)
  const [editingAccount, setEditingAccount] = useState<AccountRow | null>(null)
  const [addingAssetToAccountId, setAddingAssetToAccountId] = useState<string | null>(null)
  const [editingAsset, setEditingAsset] = useState<AssetWithRate | null>(null)

  const canMutate = role === 'manager' || role === 'editor'

  function canEditAccount(account: AccountRow) {
    return role === 'manager' || (role === 'editor' && account.ownerId === currentUserId)
  }

  function handleDeleteAccount(account: AccountRow) {
    if (!confirm(`Delete account "${account.name}"? All assets in this account will also be deleted.`)) return
    startTransition(async () => {
      const result = await deleteAccount(account.id)
      if (!result.success) alert(result.error)
    })
  }

  function handleDeleteAsset(asset: AssetWithRate) {
    if (!confirm(`Remove ${asset.symbol.code} from this account?`)) return
    startTransition(async () => {
      const result = await deleteAsset(asset.id)
      if (!result.success) alert(result.error)
    })
  }

  const selectedAccount = accounts.find((a) => a.id === selectedAccountId) ?? accounts[0] ?? null

  return (
    <>
      {/* ── Desktop: two-column split ── */}
      <div className="hidden md:flex gap-0 h-full">
        {/* Left: 40% account list */}
        <div
          className="w-[40%] shrink-0 flex flex-col"
          style={{ borderRight: '1px solid var(--color-border)' }}
        >
          {/* Left header */}
          <div
            className="flex items-center justify-between px-5 py-4"
            style={{ borderBottom: '1px solid var(--color-border)' }}
          >
            <h1 className="text-xl font-semibold" style={{ color: 'var(--color-fg-primary)' }}>
              Accounts
            </h1>
            {canMutate && (
              <Button
                size="sm"
                onClick={() => setShowCreateAccount(true)}
                className="min-h-[44px]"
              >
                Add Account
              </Button>
            )}
          </div>

          {/* Account list */}
          <div className="flex-1 overflow-y-auto py-2">
            {accounts.length === 0 ? (
              <EmptyState
                icon={Wallet}
                message="No accounts yet"
                action={
                  canMutate ? (
                    <Button onClick={() => setShowCreateAccount(true)}>
                      Add Account
                    </Button>
                  ) : undefined
                }
              />
            ) : (
              accounts.map((account) => {
                const isSelected = account.id === (selectedAccount?.id ?? null)
                return (
                  <Link
                    key={account.id}
                    href={`/accounts?account=${account.id}`}
                    className="group flex items-start justify-between px-4 py-3 mx-2 rounded-xl transition-colors min-h-[72px]"
                    style={{
                      background: isSelected ? 'var(--color-accent-subtle)' : undefined,
                      border: isSelected ? '1px solid var(--color-accent)' : '1px solid transparent',
                    }}
                  >
                    <div className="min-w-0 flex-1">
                      <p
                        className="font-semibold text-sm truncate"
                        style={{ color: 'var(--color-fg-primary)' }}
                      >
                        {account.name}
                      </p>
                      {account.institution && (
                        <p className="text-xs truncate mt-0.5" style={{ color: 'var(--color-fg-secondary)' }}>
                          {account.institution}
                        </p>
                      )}
                      <p className="text-xs mt-0.5" style={{ color: 'var(--color-fg-secondary)' }}>
                        {account.ownerName}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1 ml-3 shrink-0">
                      <span
                        className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
                        style={{
                          background: 'var(--color-bg-base)',
                          color: 'var(--color-fg-secondary)',
                        }}
                      >
                        {account.assets.length} asset{account.assets.length !== 1 ? 's' : ''}
                      </span>
                      <span
                        className="font-mono text-sm font-semibold"
                        style={{ color: 'var(--color-accent)' }}
                      >
                        {formatCurrency(account.totalValue, displayCurrency)}
                      </span>
                      {canEditAccount(account) && (
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            className="p-1 rounded-lg transition-colors min-h-[32px] min-w-[32px] flex items-center justify-center"
                            style={{ color: 'var(--color-fg-secondary)' }}
                            onClick={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              setEditingAccount(account)
                            }}
                            title="Edit account"
                          >
                            <Pencil className="size-3.5" />
                          </button>
                          <button
                            className="p-1 rounded-lg transition-colors min-h-[32px] min-w-[32px] flex items-center justify-center"
                            style={{ color: 'var(--color-negative)' }}
                            onClick={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              handleDeleteAccount(account)
                            }}
                            title="Delete account"
                            disabled={isPending}
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  </Link>
                )
              })
            )}
          </div>
        </div>

        {/* Right: 60% detail panel */}
        <div className="flex-1 min-w-0">
          {!selectedAccount ? (
            <div className="flex items-center justify-center h-full">
              <EmptyState icon={Wallet} message="Select an account to view assets" />
            </div>
          ) : (
            <AccountDetailPanel
              account={selectedAccount}
              displayCurrency={displayCurrency}
              canMutate={canMutate}
              onAddAsset={() => setAddingAssetToAccountId(selectedAccount.id)}
              onEditAsset={(asset) => setEditingAsset(asset)}
              onDeleteAsset={handleDeleteAsset}
              isPending={isPending}
            />
          )}
        </div>
      </div>

      {/* ── Mobile: single column accordion ── */}
      <div className="md:hidden">
        <div className="flex items-center justify-between px-1 mb-4">
          <h1 className="text-xl font-semibold" style={{ color: 'var(--color-fg-primary)' }}>
            Accounts
          </h1>
          {canMutate && (
            <Button size="sm" onClick={() => setShowCreateAccount(true)} className="min-h-[44px]">
              Add Account
            </Button>
          )}
        </div>

        {accounts.length === 0 ? (
          <EmptyState
            icon={Wallet}
            message="No accounts yet"
            action={
              canMutate ? (
                <Button onClick={() => setShowCreateAccount(true)}>Add Account</Button>
              ) : undefined
            }
          />
        ) : (
          <div className="space-y-3">
            {accounts.map((account) => (
              <MobileAccountCard
                key={account.id}
                account={account}
                displayCurrency={displayCurrency}
                canMutate={canMutate}
                canEdit={canEditAccount(account)}
                onEdit={() => setEditingAccount(account)}
                onDelete={() => handleDeleteAccount(account)}
                onAddAsset={() => setAddingAssetToAccountId(account.id)}
                onEditAsset={(asset) => setEditingAsset(asset)}
                onDeleteAsset={handleDeleteAsset}
                isPending={isPending}
              />
            ))}
          </div>
        )}
      </div>

      {/* Dialogs */}
      <AccountDialogs
        householdId={householdId}
        currentUserId={currentUserId}
        role={role}
        accounts={accounts}
        symbols={symbols}
        showCreateAccount={showCreateAccount}
        onCreateClose={() => setShowCreateAccount(false)}
        editingAccount={editingAccount}
        onEditClose={() => setEditingAccount(null)}
        addingAssetToAccountId={addingAssetToAccountId}
        onAddAssetClose={() => setAddingAssetToAccountId(null)}
        editingAsset={editingAsset}
        onEditAssetClose={() => setEditingAsset(null)}
      />
    </>
  )
}

// ─── Account detail panel (desktop right column) ──────────────────────────────

interface AccountDetailPanelProps {
  account: AccountRow
  displayCurrency: DisplayCurrency
  canMutate: boolean
  onAddAsset: () => void
  onEditAsset: (asset: AssetWithRate) => void
  onDeleteAsset: (asset: AssetWithRate) => void
  isPending: boolean
}

function AccountDetailPanel({
  account,
  displayCurrency,
  canMutate,
  onAddAsset,
  onEditAsset,
  onDeleteAsset,
  isPending,
}: AccountDetailPanelProps) {
  return (
    <div className="flex flex-col h-full">
      {/* Sticky header */}
      <div
        className="px-6 py-4 sticky top-0"
        style={{
          borderBottom: '1px solid var(--color-border)',
          background: 'var(--color-bg-card)',
          zIndex: 10,
        }}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-xl font-semibold" style={{ color: 'var(--color-fg-primary)' }}>
              {account.name}
            </h2>
            <p className="text-sm mt-0.5" style={{ color: 'var(--color-fg-secondary)' }}>
              {[account.institution, account.ownerName].filter(Boolean).join(' · ')}
            </p>
          </div>
          <div className="text-right shrink-0">
            <p
              className="text-2xl font-bold font-mono"
              style={{ color: 'var(--color-accent)' }}
            >
              {formatCurrency(account.totalValue, displayCurrency)}
            </p>
            {account.latestRateFetchedAt && (
              <div className="flex items-center justify-end gap-1 mt-0.5">
                <span className="text-xs" style={{ color: 'var(--color-fg-disabled)' }}>
                  Rates updated
                </span>
                <RelativeTime isoString={account.latestRateFetchedAt} />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Asset table */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {account.assets.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <p className="text-sm" style={{ color: 'var(--color-fg-secondary)' }}>
              No assets in this account
            </p>
            {canMutate && (
              <Button size="sm" onClick={onAddAsset} className="min-h-[44px]">
                <Plus className="size-4 mr-1" />
                Add Asset
              </Button>
            )}
          </div>
        ) : (
          <>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ color: 'var(--color-fg-secondary)' }}>
                  <th className="text-left pb-3 font-medium">Symbol</th>
                  <th className="text-left pb-3 font-medium">Name</th>
                  <th className="text-right pb-3 font-medium">Amount</th>
                  <th className="text-right pb-3 font-medium">Current Value</th>
                  <th className="text-right pb-3 font-medium">Last Rate</th>
                  <th className="text-right pb-3 font-medium">Rate Age</th>
                  {canMutate && <th className="pb-3" />}
                </tr>
              </thead>
              <tbody style={{ borderTop: '1px solid var(--color-border)' }}>
                {account.assets.map((asset) => (
                  <tr
                    key={asset.id}
                    className="group"
                    style={{ borderBottom: '1px solid var(--color-border)' }}
                  >
                    <td className="py-3 font-mono font-semibold" style={{ color: 'var(--color-fg-primary)' }}>
                      {asset.symbol.code}
                    </td>
                    <td className="py-3" style={{ color: 'var(--color-fg-secondary)' }}>
                      {asset.symbol.name ?? '—'}
                    </td>
                    <td className="py-3 text-right font-mono" style={{ color: 'var(--color-fg-primary)' }}>
                      {asset.amount.toLocaleString('en-US', { maximumFractionDigits: 8 })}
                    </td>
                    <td className="py-3 text-right font-mono" style={{ color: 'var(--color-accent)' }}>
                      {asset.currentValue != null
                        ? formatCurrency(asset.currentValue, displayCurrency)
                        : '—'}
                    </td>
                    <td className="py-3 text-right font-mono" style={{ color: 'var(--color-fg-secondary)' }}>
                      {asset.lastRate != null
                        ? asset.lastRate.toLocaleString('en-US', { maximumFractionDigits: 6 })
                        : '—'}
                    </td>
                    <td className="py-3 text-right">
                      {asset.rateFetchedAt ? (
                        <RelativeTime isoString={asset.rateFetchedAt} />
                      ) : (
                        <span style={{ color: 'var(--color-fg-disabled)' }}>—</span>
                      )}
                    </td>
                    {canMutate && (
                      <td className="py-3 text-right">
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            className="p-1.5 rounded-lg min-h-[32px] min-w-[32px] flex items-center justify-center"
                            style={{ color: 'var(--color-fg-secondary)' }}
                            onClick={() => onEditAsset(asset)}
                            title="Edit amount"
                          >
                            <Pencil className="size-3.5" />
                          </button>
                          <button
                            className="p-1.5 rounded-lg min-h-[32px] min-w-[32px] flex items-center justify-center"
                            style={{ color: 'var(--color-negative)' }}
                            onClick={() => onDeleteAsset(asset)}
                            disabled={isPending}
                            title="Remove asset"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>

            {canMutate && (
              <div className="mt-4">
                <Button size="sm" variant="outline" onClick={onAddAsset} className="min-h-[44px]">
                  <Plus className="size-4 mr-1" />
                  Add Asset
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// ─── Mobile accordion card ────────────────────────────────────────────────────

interface MobileAccountCardProps {
  account: AccountRow
  displayCurrency: DisplayCurrency
  canMutate: boolean
  canEdit: boolean
  onEdit: () => void
  onDelete: () => void
  onAddAsset: () => void
  onEditAsset: (asset: AssetWithRate) => void
  onDeleteAsset: (asset: AssetWithRate) => void
  isPending: boolean
}

function MobileAccountCard({
  account,
  displayCurrency,
  canMutate,
  canEdit,
  onEdit,
  onDelete,
  onAddAsset,
  onEditAsset,
  onDeleteAsset,
  isPending,
}: MobileAccountCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}
    >
      {/* Collapsed row */}
      <button
        className="w-full flex items-start justify-between px-4 py-3 text-left min-h-[72px]"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-sm" style={{ color: 'var(--color-fg-primary)' }}>
            {account.name}
          </p>
          {account.institution && (
            <p className="text-xs mt-0.5" style={{ color: 'var(--color-fg-secondary)' }}>
              {account.institution}
            </p>
          )}
          <p className="text-xs mt-0.5" style={{ color: 'var(--color-fg-secondary)' }}>
            {account.ownerName}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1 ml-3 shrink-0">
          <span
            className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
            style={{ background: 'var(--color-bg-base)', color: 'var(--color-fg-secondary)' }}
          >
            {account.assets.length} asset{account.assets.length !== 1 ? 's' : ''}
          </span>
          <span className="font-mono text-sm font-semibold" style={{ color: 'var(--color-accent)' }}>
            {formatCurrency(account.totalValue, displayCurrency)}
          </span>
          <span className="text-xs" style={{ color: 'var(--color-fg-disabled)' }}>
            {isExpanded ? '▲' : '▼'}
          </span>
        </div>
      </button>

      {/* Expanded: asset table */}
      {isExpanded && (
        <div style={{ borderTop: '1px solid var(--color-border)' }}>
          <div className="px-4 py-3">
            {canEdit && (
              <div className="flex gap-2 mb-3">
                <Button variant="outline" size="sm" onClick={onEdit} className="min-h-[44px]">
                  Edit Account
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={onDelete}
                  disabled={isPending}
                  className="min-h-[44px]"
                >
                  Delete
                </Button>
              </div>
            )}
            {account.assets.length === 0 ? (
              <p className="text-sm py-2" style={{ color: 'var(--color-fg-secondary)' }}>
                No assets in this account
              </p>
            ) : (
              <table className="w-full text-xs">
                <thead>
                  <tr style={{ color: 'var(--color-fg-secondary)' }}>
                    <th className="text-left pb-2 font-medium">Symbol</th>
                    <th className="text-right pb-2 font-medium">Amount</th>
                    <th className="text-right pb-2 font-medium">Value</th>
                    <th className="text-right pb-2 font-medium">Age</th>
                    {canMutate && <th className="pb-2" />}
                  </tr>
                </thead>
                <tbody style={{ borderTop: '1px solid var(--color-border)' }}>
                  {account.assets.map((asset) => (
                    <tr key={asset.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                      <td className="py-2 font-mono font-semibold" style={{ color: 'var(--color-fg-primary)' }}>
                        {asset.symbol.code}
                      </td>
                      <td className="py-2 text-right font-mono" style={{ color: 'var(--color-fg-primary)' }}>
                        {asset.amount.toLocaleString('en-US', { maximumFractionDigits: 6 })}
                      </td>
                      <td className="py-2 text-right font-mono" style={{ color: 'var(--color-accent)' }}>
                        {asset.currentValue != null
                          ? formatCurrency(asset.currentValue, displayCurrency)
                          : '—'}
                      </td>
                      <td className="py-2 text-right">
                        {asset.rateFetchedAt ? (
                          <RelativeTime isoString={asset.rateFetchedAt} />
                        ) : (
                          <span style={{ color: 'var(--color-fg-disabled)' }}>—</span>
                        )}
                      </td>
                      {canMutate && (
                        <td className="py-2 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              className="p-1 rounded min-h-[32px] min-w-[32px] flex items-center justify-center"
                              style={{ color: 'var(--color-fg-secondary)' }}
                              onClick={() => onEditAsset(asset)}
                            >
                              <Pencil className="size-3" />
                            </button>
                            <button
                              className="p-1 rounded min-h-[32px] min-w-[32px] flex items-center justify-center"
                              style={{ color: 'var(--color-negative)' }}
                              onClick={() => onDeleteAsset(asset)}
                              disabled={isPending}
                            >
                              <Trash2 className="size-3" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {canMutate && (
              <div className="mt-3">
                <Button size="sm" variant="outline" onClick={onAddAsset} className="min-h-[44px]">
                  <Plus className="size-4 mr-1" />
                  Add Asset
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
