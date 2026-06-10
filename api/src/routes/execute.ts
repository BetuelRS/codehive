import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { enqueue, getJob } from '../services/queue.js'
import { executeJob } from '../services/executor.js'
import { ValidationError, NotFoundError, sendError } from '../lib/errors.js'
import type { ExecutionResult } from '../types/index.js'

const SUPPORTED = ['python','javascript','typescript','java','cpp','rust','go']

const codeSubmitSchema = z.object({
  language: z.string().min(1),
  code: z.string().min(1),
  stdin: z.string().optional(),
  timeout: z.number().int().positive().max(3600).optional(),
})

declare module 'fastify' {
  interface FastifyInstance {
    broadcastExecutionLog: (jobId: string, data: unknown) => void
  }
}

export async function executeRoutes(app: FastifyInstance): Promise<void> {
  app.post('/api/execute', async (req, reply) => {
    try {
      const parsed = codeSubmitSchema.safeParse(req.body)
      if (!parsed.success) throw new ValidationError('Invalid request', parsed.error.flatten())
      const { language, code, stdin, timeout } = parsed.data
      if (!SUPPORTED.includes(language)) throw new ValidationError(`Unsupported language: ${language}`)

      const job = await enqueue({ image: '', cmd: [], env: { CODEHIVE_LANG: language } })

      // Execute inline in background
      executeJob(job.id, language, code, stdin, timeout).catch((err) => {
        app.log.error({ jobId: job.id, err }, 'inline execution failed')
      })

      return reply.code(202).send({ id: job.id, status: 'queued', language })
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
