import { Card, CardBody } from './Card.js'
import { ConfirmDialog } from './ConfirmDialog.js'
import { Button } from './Button.js'
import { EmptyState } from './EmptyState.js'
import { Skeleton } from './Skeleton.js'
import { StatusBadge } from './StatusBadge.js'

export interface ApprovalRequestItem {
  id: string
  action: string
  entityType: string | null
  entityId: string | null
  reason: string | null
  requestedByActorId: string
  createdAt: string
}

export interface ApprovalQueueProps {
  items: ApprovalRequestItem[]
  loading?: boolean
  resolvingId?: string | null
  onApprove: (id: string) => void | Promise<void>
  onReject: (id: string) => void | Promise<void>
}

function humanizeAction(action: string): string {
  const [, verbPhrase] = action.split(':')
  const words = (verbPhrase ?? action).split('_')
  return words.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const minutes = Math.round(diffMs / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.round(hours / 24)}d ago`
}

// Pending approval list: action type, requester, reason, timestamp,
// approve/reject — frontend-plan.md's Critical-tier component list.
// Reject goes through ConfirmDialog (a step more consequential than
// approve); approve stays one click since it's the common, fast path.
export function ApprovalQueue({ items, loading = false, resolvingId, onApprove, onReject }: ApprovalQueueProps) {
  if (loading) {
    return (
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <Card key={i}>
            <CardBody className="space-y-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-64" />
            </CardBody>
          </Card>
        ))}
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <Card>
        <EmptyState
          title="No pending approvals"
          description="Requests that need your sign-off — large price changes, voids, discounts — will show up here."
        />
      </Card>
    )
  }

  return (
    <div className="space-y-3">
      {items.map((item) => {
        const isResolving = resolvingId === item.id
        return (
          <Card key={item.id}>
            <CardBody className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-ink">{humanizeAction(item.action)}</p>
                  <StatusBadge tone="attention" label="Pending" />
                </div>
                {item.reason ? <p className="text-sm text-ink-soft">{item.reason}</p> : null}
                <p className="text-xs text-ink-faint">
                  Requested {relativeTime(item.createdAt)}
                  {item.entityType ? ` · ${item.entityType}` : ''}
                </p>
              </div>
              <div className="flex gap-2">
                <ConfirmDialog
                  trigger={
                    <Button variant="secondary" size="sm" disabled={isResolving}>
                      Reject
                    </Button>
                  }
                  title="Reject this request?"
                  description={`"${humanizeAction(item.action)}" will be denied. The requester will need to submit it again.`}
                  confirmLabel="Reject"
                  destructive
                  onConfirm={() => onReject(item.id)}
                />
                <Button size="sm" loading={isResolving} onClick={() => onApprove(item.id)}>
                  Approve
                </Button>
              </div>
            </CardBody>
          </Card>
        )
      })}
    </div>
  )
}
