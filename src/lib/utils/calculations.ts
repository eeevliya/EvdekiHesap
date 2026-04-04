/**
 * CAGR (Compound Annual Growth Rate)
 *
 * Formula per PRD:
 *   dailyRate = (currentValue / costBasis)^(1/daysHeld) - 1
 *   cagr = (1 + dailyRate)^365 - 1
 *
 * Returns null if inputs are invalid (zero cost basis, zero days held, or NaN).
 */
export function cagr(
  currentValue: number,
  costBasis: number,
  daysHeld: number
): number | null {
  if (!isFinite(currentValue) || !isFinite(costBasis) || !isFinite(daysHeld)) return null
  if (costBasis <= 0 || daysHeld <= 0) return null

  const dailyRate = Math.pow(currentValue / costBasis, 1 / daysHeld) - 1
  return Math.pow(1 + dailyRate, 365) - 1
}

/**
 * Gain/loss amount and percentage.
 * Returns null if costBasis is null or zero.
 */
export function gainLoss(
  currentValue: number,
  costBasis: number | null
): { amount: number; pct: number } | null {
  if (costBasis == null || costBasis === 0) return null
  const amount = currentValue - costBasis
  const pct = (amount / costBasis) * 100
  return { amount, pct }
}

/**
 * Snap a net worth value from a snapshot row to the given display currency.
 */
export function netWorthForCurrency(
  netWorthTry: number | null,
  netWorthUsd: number | null,
  netWorthEur: number | null,
  currency: 'TRY' | 'USD' | 'EUR'
): number | null {
  if (currency === 'USD') return netWorthUsd
  if (currency === 'EUR') return netWorthEur
  return netWorthTry
}

/**
 * Percentage change between two values.
 * Returns null if from is null or zero.
 */
export function pctChange(from: number | null, to: number): number | null {
  if (from == null || from === 0) return null
  return ((to - from) / from) * 100
}

/**
 * Number of calendar days between two ISO date strings.
 */
export function daysBetween(earlier: string, later: string): number {
  const ms = new Date(later).getTime() - new Date(earlier).getTime()
  return Math.max(0, ms / (1000 * 60 * 60 * 24))
}
