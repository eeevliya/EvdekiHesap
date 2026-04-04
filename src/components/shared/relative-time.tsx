'use client'

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

interface RelativeTimeProps {
  isoString: string
}

function formatRelative(isoString: string): string {
  const now = Date.now()
  const then = new Date(isoString).getTime()
  const diffMs = now - then
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHr  = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHr / 24)

  if (diffSec < 60)  return 'just now'
  if (diffMin < 60)  return `${diffMin} min ago`
  if (diffHr  < 24)  return `${diffHr} hr ago`
  if (diffDay < 30)  return `${diffDay} day${diffDay !== 1 ? 's' : ''} ago`
  return new Date(isoString).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatExact(isoString: string): string {
  return new Date(isoString).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function RelativeTime({ isoString }: RelativeTimeProps) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className="text-xs cursor-default"
            style={{ color: 'var(--color-fg-secondary)' }}
          >
            {formatRelative(isoString)}
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <p>{formatExact(isoString)}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
