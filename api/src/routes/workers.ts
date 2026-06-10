import { FastifyInstance } from 'fastify'
import type { WorkerInfo } from '../types/index.js'
import { NotFoundError, sendError } from '../lib/errors.js'

const workers: Map<string, WorkerInfo> = new Map()

/** Registers GET /api/workers and GET /api/workers/:id routes. */
export async function workerRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/workers', async (_req, reply) => {
    return reply.send(Array.from(workers.values()))
  })

  app.get('/api/workers/:id', async (req, reply) => {
    try {
      const { id } = req.params as { id: string }
      const worker = workers.get(id)
      if (!worker) throw new NotFoundError('Worker', id)
      return reply.send(worker)
    } catch (err) {
      return sendError(reply, err instanceof Error ? err : new Error(String(err)))
    }
  })
}
