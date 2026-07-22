import type { SyncOperation, SyncOperationType, SyncEntityType } from '@hospitality-os/domain'

export class OperationLogBuilder {
  private readonly op: Partial<SyncOperation> = {}

  setOrganizationId(id: string): this {
    this.op.organizationId = id
    return this
  }

  setLocationId(id: string): this {
    this.op.locationId = id
    return this
  }

  setDeviceId(id: string): this {
    this.op.deviceId = id
    return this
  }

  setActorId(id: string): this {
    this.op.actorId = id
    return this
  }

  setEntity(entityType: SyncEntityType, entityId: string): this {
    this.op.entityType = entityType
    this.op.entityId = entityId
    return this
  }

  setOperation(op: SyncOperationType): this {
    this.op.operation = op
    return this
  }

  setPayload(payload: Record<string, unknown>): this {
    this.op.payload = payload
    return this
  }

  setBaseVersion(version: number): this {
    this.op.baseVersion = version
    return this
  }

  setIdempotencyKey(key: string): this {
    this.op.idempotencyKey = key
    return this
  }

  build(): SyncOperation {
    if (!this.op.organizationId) throw new Error('organizationId is required')
    if (!this.op.locationId) throw new Error('locationId is required')
    if (!this.op.deviceId) throw new Error('deviceId is required')
    if (!this.op.actorId) throw new Error('actorId is required')
    if (!this.op.entityType) throw new Error('entityType is required')
    if (!this.op.entityId) throw new Error('entityId is required')
    if (!this.op.operation) throw new Error('operation is required')

    return {
      opId: this.op.opId ?? crypto.randomUUID(),
      organizationId: this.op.organizationId,
      locationId: this.op.locationId,
      deviceId: this.op.deviceId,
      actorId: this.op.actorId,
      entityType: this.op.entityType,
      entityId: this.op.entityId,
      operation: this.op.operation,
      payload: this.op.payload ?? {},
      createdAt: this.op.createdAt ?? new Date().toISOString(),
      baseVersion: this.op.baseVersion,
      idempotencyKey: this.op.idempotencyKey,
    }
  }
}
