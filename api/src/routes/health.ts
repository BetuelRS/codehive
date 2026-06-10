/** Health check routes. */
import { FastifyInstance } from 'fastify'
import { healthCheck as dbHealth } from '../services/db.js'
import { healthCheck as redisHealth } from '../services/queue.js'
import type { HealthStatus } from '../types/index.js'

/** Registers GET /api/health route. */
export async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/health', async (_req, reply) => {
    const [db, redis] = await Promise.all([dbHealth(), redisHealth()])
    const status: HealthStatus = {
      status: db && redis ? 'ok' : db || redis ? 'degraded' : 'down',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      checks: { database: db ? 'ok' : 'error', redis: redis ? 'ok' : 'error' },
    }
    const code = status.status === 'ok' ? 200 : status.status === 'degraded' ? 200 : 503
    return reply.code(code).send(status)
  })
}
