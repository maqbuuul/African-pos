import { Loader2, WifiOff } from 'lucide-react'

import { cn } from '../lib/cn.js'

export type ConnectivityStatus = 'online' | 'syncing' | 'offline'

export interface ConnectivityIndicatorProps {
  status: ConnectivityStatus
  message?: string
  className?: string
}

// 3-state banner per frontend-plan.md's packages/ui component list: online
// renders nothing (a banner for the normal case would just be noise),
// syncing is an amber in-progress state, offline is a critical banner that
// stays visible until the connection returns.
export function ConnectivityIndicator({ status, message, className }: ConnectivityIndicatorProps) {
  if (status === 'online') return null

  const isSyncing = status === 'syncing'

  return (
    <div
      role="status"
      className={cn(
        'flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium',
        isSyncing ? 'bg-status-attention-bg text-status-attention' : 'bg-status-critical-bg text-status-critical',
        className,
      )}
    >
      {isSyncing ? (
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
      ) : (
        <WifiOff className="h-4 w-4" aria-hidden="true" />
      )}
      {message ?? (isSyncing ? 'Syncing…' : 'Offline — changes will sync when connection returns')}
    </div>
  )
}
