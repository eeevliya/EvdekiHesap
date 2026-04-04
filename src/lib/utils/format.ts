import type { DisplayCurrency } from '@/lib/types/domain'

/**
 * Format a monetary amount with currency symbol/code.
 * Monetary values always use font-mono via the MonoAmount component —
 * this function returns the raw string for use in non-component contexts.
 */
export function formatCurrency(
  amount: number,
  currency: DisplayCurrency,
  opts?: { decimals?: number; compact?: boolean }
): string {
  const decimals = opts?.decimals ?? 2

  if (opts?.compact) {
    const abs = Math.abs(amount)
    const sign = amount < 0 ? '-' : ''
    if (abs >= 1_000_000) return `${sign}${currencySymbol(currency)}${(abs / 1_000_000).toFixed(1)}M`
    if (abs >= 1_000)     return `${sign}${currencySymbol(currency)}${(abs / 1_000).toFixed(1)}K`
  }

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(amount)
}

export function currencySymbol(currency: DisplayCurrency): string {
  const map: Record<DisplayCurrency, string> = { TRY: '₺', USD: '$', EUR: '€' }
  return map[currency]
}

/**
 * Format a percentage with sign.
 */
export function formatPct(pct: number, opts?: { decimals?: number; showSign?: boolean }): string {
  const decimals = opts?.decimals ?? 2
  const showSign = opts?.showSign ?? true
  const sign = showSign && pct > 0 ? '+' : ''
  return `${sign}${pct.toFixed(decimals)}%`
}

/**
 * Format a CAGR value as a percentage string.
 */
export function formatCagr(cagrValue: number | null): string {
  if (cagrValue == null) return '—'
  return formatPct(cagrValue * 100, { showSign: true })
}
