import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { dequeue, updateJob, getJob } from '../services/queue.js'
import { ValidationError, sendError } from '../lib/errors.js'

const heartbeatSchema = z.object({
  hostname: z.string(),
  status: z.enum(['idle', 'busy', 'offline']),
  resources: z.object({
    cpus: z.number(),
    memory: z.number(),
  }),
  labels: z.record(z.string()).optional(),
})

const resultSchema = z.object({
  stdout: z.string(),
  stderr: z.string(),
  exitCode: z.number().nullable(),
  status: z.enum(['completed', 'failed', 'timeout']),
  startedAt: z.string(),
  finishedAt: z.string(),
})

export async function workerApiRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/workers/:id/jobs/next', async (req, reply) => {
    try {
      const job = await dequeue()
      if (!job) return reply.code(204).send()
      await updateJob(job.id, { workerId: (req.params as { id: string }).id, status: 'running' })
      return reply.send(job)
    } catch (err) {
      return sendError(reply, err instanceof Error ? err : new Error(String(err)))
    }
  })

  app.post('/api/workers/:id/jobs/:jobId/result', async (req, reply) => {
    try {
      const { jobId } = req.params as { id: string; jobId: string }
      const parsed = resultSchema.safeParse(req.body)
      if (!parsed.success) throw new ValidationError('Invalid result', parsed.error.flatten())
      const { stdout, stderr, exitCode, status, startedAt, finishedAt } = parsed.data
      const result = { id: jobId, stdout, stderr, exitCode, status, startedAt, finishedAt }
      const job = await getJob(jobId)
      if (!job) return reply.code(404).send({ error: 'NotFound', message: `Job ${jobId} not found` })
      await updateJob(jobId, { status, result, workerId: null })
      return reply.code(200).send({ ok: true })
    } catch (err) {
      return sendError(reply, err instanceof Error ? err : new Error(String(err)))
    }
  })

  app.post('/api/workers/:id/heartbeat', async (req, reply) => {
    try {
      const parsed = heartbeatSchema.safeParse(req.body)
      if (!parsed.success) throw new ValidationError('Invalid heartbeat', parsed.error.flatten())
      return reply.code(200).send({ ok: true })
    } catch (err) {
      return sendError(reply, err instanceof Error ? err : new Error(String(err)))
    }
  })
}
