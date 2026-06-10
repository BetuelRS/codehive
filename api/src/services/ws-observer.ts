import { FastifyInstance } from 'fastify'
import { WebSocket } from 'ws'
import { eventBus, type ExecutionEvent } from './events.js'

interface WsClient {
  id: string
  socket: WebSocket
  jobFilter?: string
}

class WsObserver {
  private clients: Map<string, WsClient> = new Map()
  private unsubscribe: (() => void) | null = null

  init(app: FastifyInstance): void {
    this.unsubscribe = eventBus.subscribe((event: ExecutionEvent) => {
      this.broadcast(event, event.jobId)
    })

    app.get('/ws', { websocket: true }, (socket, req) => {
      const id = crypto.randomUUID()
      const url = new URL(req.url, 'http://localhost')
      const jobFilter = url.searchParams.get('jobId') ?? undefined

      this.clients.set(id, { id, socket, jobFilter })
      app.log.info({ clientId: id, jobFilter }, 'ws client connected')

      socket.on('close', () => {
        this.clients.delete(id)
        app.log.info({ clientId: id }, 'ws client disconnected')
      })

      socket.on('error', () => {
        this.clients.delete(id)
      })
    })
  }

  private broadcast(event: ExecutionEvent, jobId: string): void {
    const msg = JSON.stringify({ type: 'execution_update', payload: event })
    for (const client of this.clients.values()) {
      if (client.jobFilter && client.jobFilter !== jobId) continue
      if (client.socket.readyState === WebSocket.OPEN) {
        client.socket.send(msg)
      }
    }
  }

  destroy(): void {
    this.unsubscribe?.()
    for (const client of this.clients.values()) {
      client.socket.close()
    }
    this.clients.clear()
  }
}

export const wsObserver = new WsObserver()
