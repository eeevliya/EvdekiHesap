import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'

interface CardProps {
  children: ReactNode
  className?: string
  /** If true, adds hover lift effect */
  hoverable?: boolean
}

export function Card({ children, className, hoverable = false }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-2xl p-5 md:p-6',
        hoverable && 'transition-all duration-150 hover:-translate-y-px cursor-pointer',
        className
      )}
      style={{
        background: 'var(--color-bg-card)',
        border: '1px solid var(--color-border)',
        boxShadow: 'var(--shadow-card)',
      }}
    >
      {children}
    </div>
  )
}

interface CardHeaderProps {
  children: ReactNode
  className?: string
}

export function CardHeader({ children, className }: CardHeaderProps) {
  return (
    <div className={cn('flex items-center justify-between mb-4', className)}>
      {children}
    </div>
  )
}

interface CardTitleProps {
  children: ReactNode
  className?: string
}

export function CardTitle({ children, className }: CardTitleProps) {
  return (
    <h2
      className={cn('text-lg font-semibold', className)}
      style={{ color: 'var(--color-fg-primary)' }}
    >
      {children}
    </h2>
  )
}
