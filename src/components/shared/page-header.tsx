import type { ReactNode } from 'react'

interface PageHeaderProps {
  title: string
  action?: ReactNode
}

export function PageHeader({ title, action }: PageHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-5">
      <h1 className="text-3xl font-bold tracking-tight" style={{ color: 'var(--color-fg-primary)' }}>
        {title}
      </h1>
      {action && <div>{action}</div>}
    </div>
  )
}
