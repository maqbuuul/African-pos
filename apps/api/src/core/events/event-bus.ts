import { Injectable } from '@nestjs/common'
import { EventEmitter } from 'events'

export interface DomainEvent {
  eventType: string
  organizationId: string
  locationId?: string
  entityType: string
  entityId: string
  data?: Record<string, unknown>
  occurredAt: Date
}

export type EventHandler = (event: DomainEvent) => void | Promise<void>

@Injectable()
export class EventBus {
  private readonly emitter = new EventEmitter()
  // Cap listeners per event to prevent memory leaks
  private static readonly MAX_LISTENERS = 64

  constructor() {
    this.emitter.setMaxListeners(EventBus.MAX_LISTENERS)
  }

  emit(event: DomainEvent): void {
    this.emitter.emit(event.eventType, event)
  }

  emitAsync(event: DomainEvent): Promise<void[]> {
    const results = this.emitter.listeners(event.eventType).map((handler) => {
      const result = (handler as (...args: unknown[]) => unknown)(event)
      return result instanceof Promise ? result : Promise.resolve()
    })
    return Promise.all(results)
  }

  on(eventType: string, handler: EventHandler): void {
    this.emitter.on(eventType, handler)
  }

  off(eventType: string, handler: EventHandler): void {
    this.emitter.off(eventType, handler)
  }

  removeAllListeners(eventType?: string): void {
    this.emitter.removeAllListeners(eventType)
  }

  listenerCount(eventType: string): number {
    return this.emitter.listenerCount(eventType)
  }
}
