// P10 — Offline Sync: PowerSync client setup and management.
// Requires @journeyapps/powersync-sdk-react-native to be installed.
// This module initializes the PowerSync database connector and manages the
// sync lifecycle (connect, disconnect, status monitoring).

import type { SyncOperation } from '@hospitality-os/offline-sync'

export type SyncConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error'

export interface SyncClientConfig {
  serverUrl: string
  syncToken: string
}

export class SyncClient {
  private _status: SyncConnectionStatus = 'disconnected'
  private _pendingCount = 0

  get status(): SyncConnectionStatus {
    return this._status
  }

  get pendingOperationCount(): number {
    return this._pendingCount
  }

  async connect(_config: SyncClientConfig): Promise<void> {
    this._status = 'connecting'
    try {
      // In production, this initializes the PowerSync client:
      //   const powersync = new PowerSyncDatabase({
      //     database: { dbFilename: 'pos-app.db' },
      //   })
      //   await powersync.connect({
      //     serverUrl: config.serverUrl,
      //     token: config.syncToken,
      //   })
      // For MVP, simulate a successful connection.
      await new Promise((resolve) => setTimeout(resolve, 100))
      this._status = 'connected'
    } catch {
      this._status = 'error'
      throw new Error('Failed to connect to sync service')
    }
  }

  async disconnect(): Promise<void> {
    this._status = 'disconnected'
    this._pendingCount = 0
  }

  async getCrudBatch(): Promise<SyncOperation[]> {
    // In production, reads from PowerSync's internal CRUD queue.
    // Returns up to 50 pending operations.
    return []
  }

  async completeBatch(opIds: string[]): Promise<void> {
    // In production, marks operations as complete in PowerSync's queue.
    this._pendingCount = Math.max(0, this._pendingCount - opIds.length)
  }

  setPendingCount(count: number): void {
    this._pendingCount = count
  }
}
