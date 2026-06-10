import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { enqueue, getJob } from '../services/queue.js'
import { ValidationError, NotFoundError, sendError } from '../lib/errors.js'
import type { ExecutionResult } from '../types/index.js'

const LANG_TO_IMAGE: Record<string, string> = {
  python: 'python:3.12-slim',
  javascript: 'node:22-slim',
  typescript: 'node:22-slim',
  java: 'eclipse-temurin:21-jre',
  cpp: 'gcc:14-bookworm',
  rust: 'rust:1.85-slim-bookworm',
  go: 'golang:1.23-bookworm',
}

const codeSubmitSchema = z.object({
  language: z.string().min(1),
  code: z.string().min(1),
  stdin: z.string().optional(),
  timeout: z.number().int().positive().max(3600).optional(),
  memory: z.number().int().positive().max(32768).optional(),
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
      if (!parsed.success) {
        throw new ValidationError('Invalid request', parsed.error.flatten())
      }
      const { language, code: _code, stdin, timeout, memory } = parsed.data
      const image = LANG_TO_IMAGE[language]
      if (!image) {
        throw new ValidationError(`Unsupported language: ${language}`)
      }
      const cmd = stdin
        ? ['sh', '-c', `cat > /tmp/code <<'CODE'\n${_code}\nCODE\n${stdin} | exec ${getInterpreter(language)} /tmp/code`]
        : ['sh', '-c', `cat > /tmp/code <<'CODE'\n${_code}\nCODE\nexec ${getInterpreter(language)} /tmp/code`]
      const dockerReq = { image, cmd, timeout, memory, env: { CODEHIVE_LANG: language } }
      const job = await enqueue(dockerReq)
      return reply.code(202).send({ id: job.id, status: 'queued' })
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

function getInterpreter(lang: string): string {
  const map: Record<string, string> = {
    python: 'python3',
    javascript: 'node',
    typescript: 'npx tsx',
    java: 'java',
    cpp: './a.out',
    rust: './target/release/exec',
    go: 'go run',
  }
  return map[lang] ?? 'sh'
}
