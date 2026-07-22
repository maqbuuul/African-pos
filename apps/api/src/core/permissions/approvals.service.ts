import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { and, desc, eq, isNull, sql } from 'drizzle-orm'
import { approvalRequests, type Db } from '@hospitality-os/database'

export interface CreateApprovalRequestInput {
  organizationId: string
  locationId?: string | null
  requestedByActorId: string
  action: string
  entityType?: string | null
  entityId?: string | null
  reason?: string | null
}

export interface ConsumeApprovalInput {
  id: string
  organizationId: string
  requestedByActorId: string
  action: string
}

export interface ResolveApprovalInput {
  id: string
  organizationId: string
  approverActorId: string
}

// Backs the manager-override flow named in BUILD_WORKFLOW.md P2's acceptance
// gate and master plan Module 2 "Manager approvals": a staff member who
// lacks a permission but whose action supports override gets a pending
// approval instead of an outright 403 (see PermissionsGuard); a manager
// resolves it; the requester's retry then spends it exactly once.
@Injectable()
export class ApprovalsService {
  async create(db: Db, input: CreateApprovalRequestInput) {
    const [row] = await db
      .insert(approvalRequests)
      .values({
        organizationId: input.organizationId,
        locationId: input.locationId ?? null,
        requestedByActorId: input.requestedByActorId,
        action: input.action,
        entityType: input.entityType ?? null,
        entityId: input.entityId ?? null,
        reason: input.reason ?? null,
      })
      .returning()
    if (!row) throw new Error('failed to create approval request')
    return row
  }

  // Atomic compare-and-set: only a row that is still 'approved' and not yet
  // consumed can be spent, and this spends it in the same statement that
  // checks it — two concurrent retries of the same original request cannot
  // both succeed off one approval.
  async tryConsume(db: Db, input: ConsumeApprovalInput) {
    const [row] = await db
      .update(approvalRequests)
      .set({ consumedAt: sql`now()` })
      .where(
        and(
          eq(approvalRequests.id, input.id),
          eq(approvalRequests.organizationId, input.organizationId),
          eq(approvalRequests.requestedByActorId, input.requestedByActorId),
          eq(approvalRequests.action, input.action),
          eq(approvalRequests.status, 'approved'),
          isNull(approvalRequests.consumedAt),
        ),
      )
      .returning()
    return row ?? null
  }

  async getById(db: Db, organizationId: string, id: string) {
    const [row] = await db
      .select()
      .from(approvalRequests)
      .where(and(eq(approvalRequests.id, id), eq(approvalRequests.organizationId, organizationId)))
    if (!row) throw new NotFoundException('approval request not found')
    return row
  }

  async listPending(db: Db, organizationId: string) {
    return db
      .select()
      .from(approvalRequests)
      .where(and(eq(approvalRequests.organizationId, organizationId), eq(approvalRequests.status, 'pending')))
      .orderBy(desc(approvalRequests.createdAt))
  }

  async approve(db: Db, input: ResolveApprovalInput) {
    return this.resolve(db, input, 'approved')
  }

  async reject(db: Db, input: ResolveApprovalInput) {
    return this.resolve(db, input, 'rejected')
  }

  private async resolve(db: Db, input: ResolveApprovalInput, outcome: 'approved' | 'rejected') {
    const [existing] = await db
      .select()
      .from(approvalRequests)
      .where(and(eq(approvalRequests.id, input.id), eq(approvalRequests.organizationId, input.organizationId)))
    if (!existing) throw new NotFoundException('approval request not found')
    if (existing.status !== 'pending') {
      throw new BadRequestException(`approval request is already ${existing.status}`)
    }
    // A requester approving their own override defeats the point of the
    // control — the whole reason it exists is that the requester doesn't
    // hold the permission themselves.
    if (existing.requestedByActorId === input.approverActorId) {
      throw new ForbiddenException('cannot resolve your own approval request')
    }

    const [row] = await db
      .update(approvalRequests)
      .set({
        status: outcome,
        approvedByActorId: input.approverActorId,
        approvedAt: sql`now()`,
      })
      .where(eq(approvalRequests.id, input.id))
      .returning()
    if (!row) throw new Error(`failed to ${outcome === 'approved' ? 'approve' : 'reject'} approval request`)
    return row
  }
}
