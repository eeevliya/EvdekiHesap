import { cn } from '@/lib/utils'

interface MonoAmountProps {
  value: number
  /** ISO currency code, e.g. 'TRY', 'USD', 'EUR' */
  currency?: string
  /** Number of decimal places (default 2) */
  decimals?: number
  /** If true, prefix positive values with '+' */
  showSign?: boolean
  /** Color variant — auto-colors based on sign if 'auto' */
  color?: 'auto' | 'positive' | 'negative' | 'neutral' | 'default'
  className?: string
}

const colorMap = {
  positive: 'var(--color-positive)',
  negative: 'var(--color-negative)',
  neutral:  'var(--color-neutral)',
  default:  'var(--color-fg-primary)',
}

export function MonoAmount({
  value,
  currency,
  decimals = 2,
  showSign = false,
  color = 'default',
  className,
}: MonoAmountProps) {
  const resolvedColor =
    color === 'auto'
      ? value >= 0
        ? colorMap.positive
        : colorMap.negative
      : colorMap[color] ?? colorMap.default

  const formatted = Math.abs(value).toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })

  const sign = showSign ? (value >= 0 ? '+' : '−') : value < 0 ? '−' : ''
  const currencyStr = currency ? ` ${currency}` : ''

  return (
    <span
      className={cn('font-mono text-sm', className)}
      style={{ color: resolvedColor }}
    >
      {sign}
      {formatted}
      {currencyStr}
    </span>
  )
}
