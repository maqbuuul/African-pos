// P10 — Offline Sync: Upload queue handler.
// Implements the uploadData() contract from master plan section 27:
//   - Reads pending operations from the local CRUD queue
//   - POSTs them to /sync/push
//   - On success, marks them complete
//   - On failure, leaves them queued for retry

import type { SyncOperation, SyncPushResult } from '@hospitality-os/offline-sync'
import type { SyncClient } from './sync-client.js'

export interface UploadHandlerConfig {
  apiBaseUrl: string
  onStatusChange?: (pending: number) => void
  onConflict?: (conflicts: SyncPushResult['conflicts']) => void
}

export class UploadHandler {
  private readonly apiBaseUrl: string
  private readonly onStatusChange?: ((pending: number) => void) | undefined
  private readonly onConflict?: ((conflicts: SyncPushResult['conflicts']) => void) | undefined
  private isUploading = false

  constructor(
    private readonly syncClient: SyncClient,
    config: UploadHandlerConfig,
  ) {
    this.apiBaseUrl = config.apiBaseUrl
    this.onStatusChange = config.onStatusChange
    this.onConflict = config.onConflict
  }

  get pendingOperationCount(): number {
    return this.syncClient.pendingOperationCount
  }

  async drainQueue(): Promise<void> {
    if (this.isUploading) return
    this.isUploading = true

    try {
      const batch = await this.syncClient.getCrudBatch()
      if (batch.length === 0) return

      const result = await this.pushBatch(batch)

      if (result.accepted.length > 0) {
        const acceptedIds = result.accepted.map((a) => a.opId)
        await this.syncClient.completeBatch(acceptedIds)
      }

      if (result.conflicts.length > 0) {
        this.onConflict?.(result.conflicts)
      }

      const remaining = batch.length - result.accepted.length
      this.syncClient.setPendingCount(remaining)
      this.onStatusChange?.(remaining)
    } finally {
      this.isUploading = false
    }
  }

  private async pushBatch(operations: SyncOperation[]): Promise<SyncPushResult> {
    const response = await fetch(`${this.apiBaseUrl}/sync/push`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ operations }),
    })

    if (!response.ok) {
      throw new Error(`Sync push failed: ${response.status} ${response.statusText}`)
    }

    return response.json() as Promise<SyncPushResult>
  }
}
