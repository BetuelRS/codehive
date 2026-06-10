import { EventEmitter } from 'node:events'

export type EventType = 'execution:queued' | 'execution:running' | 'execution:completed' | 'execution:failed' | 'worker:heartbeat' | 'worker:offline'

export interface ExecutionEvent {
  jobId: string
  status: string
  stdout?: string
  stderr?: string
  exitCode?: number | null
  timestamp: string
}

class ExecutionEventBus extends EventEmitter {
  emitExecutionUpdate(event: ExecutionEvent): void {
    this.emit('execution:update', event)
  }

  subscribe(callback: (event: ExecutionEvent) => void): () => void {
    this.on('execution:update', callback)
    return () => { this.off('execution:update', callback) }
  }
}

export const eventBus = new ExecutionEventBus()
