import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'

type BadgeVariant =
  | 'positive'
  | 'negative'
  | 'neutral'
  | 'warning'
  | 'accent'
  | 'default'

const variantStyles: Record<BadgeVariant, { bg: string; color: string }> = {
  positive: { bg: 'oklch(0.75 0.15 155 / 0.15)', color: 'var(--color-positive)' },
  negative: { bg: 'oklch(0.65 0.18 25 / 0.15)',  color: 'var(--color-negative)' },
  neutral:  { bg: 'oklch(0.70 0.02 255 / 0.15)', color: 'var(--color-neutral)' },
  warning:  { bg: 'oklch(0.80 0.14 75 / 0.15)',  color: 'var(--color-warning)' },
  accent:   { bg: 'oklch(0.80 0.16 195 / 0.15)', color: 'var(--color-accent)' },
  default:  { bg: 'var(--color-bg-card-hover)',   color: 'var(--color-fg-secondary)' },
}

interface BadgeProps {
  children: ReactNode
  variant?: BadgeVariant
  className?: string
}

export function Badge({ children, variant = 'default', className }: BadgeProps) {
  const { bg, color } = variantStyles[variant]
  return (
    <span
      className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium', className)}
      style={{ background: bg, color }}
    >
      {children}
    </span>
  )
}
