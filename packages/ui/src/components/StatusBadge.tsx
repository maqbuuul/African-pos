import { AlertTriangle, CheckCircle2, Circle, Clock, Sparkles, XCircle } from 'lucide-react'
import type { ReactNode } from 'react'

import { cn } from '../lib/cn.js'

export type StatusTone = 'healthy' | 'attention' | 'critical' | 'active' | 'ai' | 'neutral'

const toneClasses: Record<StatusTone, string> = {
  healthy: 'text-status-healthy bg-status-healthy-bg',
  attention: 'text-status-attention bg-status-attention-bg',
  critical: 'text-status-critical bg-status-critical-bg',
  active: 'text-status-active bg-status-active-bg',
  ai: 'text-insight-ai bg-insight-ai-bg',
  neutral: 'text-ink-soft bg-surface-2',
}

const toneIcons: Record<StatusTone, ReactNode> = {
  healthy: <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />,
  attention: <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />,
  critical: <XCircle className="h-3.5 w-3.5" aria-hidden="true" />,
  active: <Clock className="h-3.5 w-3.5" aria-hidden="true" />,
  ai: <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />,
  neutral: <Circle className="h-3.5 w-3.5" aria-hidden="true" />,
}

export interface StatusBadgeProps {
  tone: StatusTone
  label: string
  className?: string
}

// Color is never the only signal (frontend-design-system.md's
// Accessibility section) — every instance carries an icon and a text
// label alongside the tone color, so it reads in bright kitchen light
// and for color-blind staff.
export function StatusBadge({ tone, label, className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium',
        toneClasses[tone],
        className,
      )}
    >
      {toneIcons[tone]}
      {label}
    </span>
  )
}
