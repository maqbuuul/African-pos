import { z } from 'zod'

export const SyncOperationSchema = z.object({
  opId: z.string(),
  tenantId: z.string(),
  locationId: z.string(),
  deviceId: z.string(),
  actorId: z.string(),
  entityType: z.string(),
  entityId: z.string(),
  operation: z.string(),
  payload: z.record(z.unknown()),
  createdAt: z.string(),
  baseVersion: z.number().int().optional(),
})

export type SyncOperation = z.infer<typeof SyncOperationSchema>

