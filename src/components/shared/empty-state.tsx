import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

interface EmptyStateProps {
  icon: LucideIcon
  message: string
  action?: ReactNode
}

export function EmptyState({ icon: Icon, message, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
      <Icon
        className="size-10"
        style={{ color: 'var(--color-fg-disabled)' }}
      />
      <p className="text-sm" style={{ color: 'var(--color-fg-secondary)' }}>
        {message}
      </p>
      {action && <div className="mt-1">{action}</div>}
    </div>
  )
}
