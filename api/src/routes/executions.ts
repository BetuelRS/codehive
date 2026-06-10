import { FastifyInstance } from 'fastify'
import { getJobs, getJobCount } from '../services/queue.js'
import { sendError } from '../lib/errors.js'
import type { Job } from '../types/index.js'

export async function executionsRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/executions', async (req, reply) => {
    try {
      const query = req.query as { limit?: string; offset?: string }
      const limit = Math.min(Number(query.limit) || 50, 200)
      const offset = Number(query.offset) || 0
      const [items, total] = await Promise.all([
        getJobs(limit, offset),
        getJobCount(),
      ])
      void total
      return reply.send({ items, total })
    } catch (err) {
      return sendError(reply, err instanceof Error ? err : new Error(String(err)))
    }
  })

  app.get('/api/stats', async (_req, reply) => {
    try {
      const now = Date.now()
      const dayAgo = new Date(now - 86400000).toISOString()
      const weekAgo = new Date(now - 604800000).toISOString()
      const [dayCount, weekCount, dayResults] = await Promise.all([
        getJobCount({ since: dayAgo }),
        getJobCount({ since: weekAgo }),
        getJobs(500, 0, { since: dayAgo }),
      ])
      const completed = dayResults.filter((j: { status: string }) => j.status === 'completed')
      const successRate = dayResults.length > 0 ? completed.length / dayResults.length : 1
      const avgDuration = completed.length > 0
        ? (completed as Job[]).reduce((sum: number, j: Job) => {
            if (j.result?.startedAt && j.result?.finishedAt) {
              return sum + (new Date(j.result.finishedAt).getTime() - new Date(j.result.startedAt).getTime())
            }
            return sum
          }, 0) / completed.length
        : 0

      return reply.send({
        executions24h: dayCount,
        executions7d: weekCount,
        activeWorkers: 0,
        avgDurationMs: Math.round(avgDuration),
        successRate: Math.round(successRate * 100) / 100,
      })
    } catch (err) {
      return sendError(reply, err instanceof Error ? err : new Error(String(err)))
    }
  })
}
