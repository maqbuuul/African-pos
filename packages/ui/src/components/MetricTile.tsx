import { Minus, TrendingDown, TrendingUp } from 'lucide-react'

import { cn } from '../lib/cn.js'
import { Skeleton } from './Skeleton.js'

export interface MetricTileProps {
  label: string
  value: string
  /** Percentage change vs. the prior comparable period, e.g. -12 or 8. */
  trend?: number | undefined
  /** Reserves the "One Number" type size (frontend-design-system.md) — use
   * on the single most important figure on a given dashboard, never more
   * than one per screen. */
  emphasized?: boolean
  loading?: boolean
  className?: string
}

export function MetricTile({ label, value, trend, emphasized = false, loading = false, className }: MetricTileProps) {
  if (loading) {
    return (
      <div className={cn('rounded-lg border border-border bg-surface p-4', className)}>
        <Skeleton className="h-3.5 w-24" />
        <Skeleton className="mt-3 h-8 w-20" />
      </div>
    )
  }

  const trendTone =
    trend === undefined || trend === 0 ? 'text-ink-faint' : trend > 0 ? 'text-status-healthy' : 'text-status-critical'
  const TrendIcon = trend === undefined || trend === 0 ? Minus : trend > 0 ? TrendingUp : TrendingDown

  return (
    <div className={cn('rounded-lg border border-border bg-surface p-4', className)}>
      <p className="text-sm text-ink-faint">{label}</p>
      <p
        className={cn(
          'mt-1 font-semibold text-ink',
          emphasized ? 'text-[length:var(--font-size-one-number)]' : 'text-2xl',
        )}
      >
        {value}
      </p>
      {trend !== undefined ? (
        <p className={cn('mt-1 flex items-center gap-1 text-xs font-medium', trendTone)}>
          <TrendIcon className="h-3.5 w-3.5" aria-hidden="true" />
          {trend > 0 ? '+' : ''}
          {trend}% vs. yesterday
        </p>
      ) : null}
    </div>
  )
}
