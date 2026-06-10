/** Routes for code execution: POST /api/execute, GET /api/status/:id. */
import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { enqueue, getJob } from '../services/queue.js'
import { ValidationError, NotFoundError, sendError } from '../lib/errors.js'
import type { ExecutionResult } from '../types/index.js'

const executeBodySchema = z.object({
  image: z.string().min(1),
  cmd: z.array(z.string()).min(1),
  env: z.record(z.string()).optional(),
  timeout: z.number().int().positive().max(3600).optional(),
  memory: z.number().int().positive().max(32768).optional(),
  cpus: z.number().int().positive().max(64).optional(),
})

declare module 'fastify' {
  interface FastifyInstance {
    broadcastExecutionLog: (jobId: string, data: unknown) => void
  }
}

/** Registers execute and status routes on Fastify instance. */
export async function executeRoutes(app: FastifyInstance): Promise<void> {
  app.post('/api/execute', async (req, reply) => {
    try {
      const parsed = executeBodySchema.safeParse(req.body)
      if (!parsed.success) {
        throw new ValidationError('Invalid request', parsed.error.flatten())
      }
      const job = await enqueue(parsed.data)
      return reply.code(202).send({ jobId: job.id, status: 'queued' })
    } catch (err) {
      return sendError(reply, err instanceof Error ? err : new Error(String(err)))
    }
  })

  app.get('/api/status/:id', async (req, reply) => {
    try {
      const { id } = req.params as { id: string }
      if (!id) throw new ValidationError('Missing job id')

      const job = await getJob(id)
      if (!job) throw new NotFoundError('Job', id)

      const result: ExecutionResult = job.result ?? {
        id: job.id,
        status: job.status,
        stdout: '',
        stderr: '',
        exitCode: null,
        startedAt: null,
        finishedAt: null,
      }
      return reply.send(result)
    } catch (err) {
      return sendError(reply, err instanceof Error ? err : new Error(String(err)))
    }
  })
}
