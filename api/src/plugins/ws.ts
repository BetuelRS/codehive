import { FastifyInstance } from 'fastify'
import websocket from '@fastify/websocket'

/** Registers WebSocket plugin with 1MB max payload. */
export async function registerWebSocket(app: FastifyInstance): Promise<void> {
  await app.register(websocket, {
    options: {
      maxPayload: 1048576,
    },
  })
}
