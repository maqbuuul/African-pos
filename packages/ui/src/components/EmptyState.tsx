import { Inbox } from 'lucide-react'
import type { ComponentType, ReactNode } from 'react'

import { cn } from '../lib/cn.js'

export interface EmptyStateProps {
  icon?: ComponentType<{ className?: string }>
  title: string
  description: string
  action?: ReactNode
  className?: string
}

// Never a bare "No data" — description names what would need to happen to
// populate the screen (frontend-design-system.md's Error and Empty States
// section).
export function EmptyState({ icon: Icon = Inbox, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center gap-3 px-6 py-12 text-center', className)}>
      <Icon className="h-10 w-10 text-ink-faint" aria-hidden="true" />
      <div className="space-y-1">
        <p className="text-sm font-semibold text-ink">{title}</p>
        <p className="max-w-sm text-sm text-ink-soft">{description}</p>
      </div>
      {action}
    </div>
  )
}
