import type { ConflictResolution, SyncEntityType, SyncOperationType } from '@hospitality-os/domain'

interface ConflictPolicyRule {
  entityType: SyncEntityType
  operation: SyncOperationType
  resolution: ConflictResolution
  description: string
}

const CONFLICT_POLICY_RULES: ConflictPolicyRule[] = [
  {
    entityType: 'order',
    operation: 'create',
    resolution: 'server_wins',
    description: 'Duplicate order create detected — server retains the original',
  },
  {
    entityType: 'order',
    operation: 'update',
    resolution: 'append_merge',
    description: 'Merge append-only item operations on order; paid orders cannot be edited without reopen approval',
  },
  {
    entityType: 'order_item',
    operation: 'create',
    resolution: 'append_merge',
    description: 'Order items are append-only — both devices adding items to the same order merge correctly',
  },
  {
    entityType: 'order_item',
    operation: 'update',
    resolution: 'append_merge',
    description: 'Order item status transitions merge append-only',
  },
  {
    entityType: 'payment',
    operation: 'create',
    resolution: 'payment_dependent',
    description: 'Cash payment syncs offline; mobile money/card require online confirmation',
  },
  {
    entityType: 'payment',
    operation: 'update',
    resolution: 'server_wins',
    description: 'Payment status (confirmed/refunded) is authoritative on server',
  },
  {
    entityType: 'refund',
    operation: 'create',
    resolution: 'manual_review',
    description: 'Conflicting refund attempts require manual manager review',
  },
  {
    entityType: 'receipt',
    operation: 'create',
    resolution: 'server_wins',
    description: 'Receipt generation is idempotent — server dedupes by bill ID',
  },
  {
    entityType: 'customer',
    operation: 'create',
    resolution: 'append_merge',
    description: 'Customers merge by phone number; preserve all notes with author and timestamp',
  },
  {
    entityType: 'customer',
    operation: 'update',
    resolution: 'append_merge',
    description: 'Customer profile updates merge by phone; server keeps latest contact info',
  },
]

export class ConflictPolicyEngine {
  resolve(
    entityType: SyncEntityType,
    operation: SyncOperationType,
  ): ConflictResolution {
    const rule = CONFLICT_POLICY_RULES.find(
      (r) => r.entityType === entityType && r.operation === operation,
    )
    return rule?.resolution ?? 'manual_review'
  }

  getDescription(
    entityType: SyncEntityType,
    operation: SyncOperationType,
  ): string {
    const rule = CONFLICT_POLICY_RULES.find(
      (r) => r.entityType === entityType && r.operation === operation,
    )
    return rule?.description ?? `Unhandled conflict for ${entityType} ${operation}`
  }
}
