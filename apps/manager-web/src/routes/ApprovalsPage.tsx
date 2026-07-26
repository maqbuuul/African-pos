import { ApprovalQueue, Card, EmptyState } from '@hospitality-os/ui'

import { useApprovals } from '../features/approvals/use-approvals.js'

export function ApprovalsPage() {
  const { items, loading, error, resolvingId, approve, reject } = useApprovals()

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-ink-faint">African POS</p>
        <h1 className="text-2xl font-semibold text-ink">Approvals</h1>
      </div>

      {error ? (
        <Card>
          <EmptyState title="Couldn't load approvals" description={error} />
        </Card>
      ) : (
        <ApprovalQueue items={items} loading={loading} resolvingId={resolvingId} onApprove={approve} onReject={reject} />
      )}
    </div>
  )
}
