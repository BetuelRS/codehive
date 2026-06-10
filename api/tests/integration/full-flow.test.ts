import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import Fastify from 'fastify'
import { registerCors } from '../../src/plugins/cors.js'
import { healthRoutes } from '../../src/routes/health.js'
import { executeRoutes } from '../../src/routes/execute.js'
import { executionsRoutes } from '../../src/routes/executions.js'
import { workerRoutes } from '../../src/routes/workers.js'
import { workerApiRoutes } from '../../src/routes/worker-api.js'
import { closePool } from '../../src/services/db.js'

const mockJobs = new Map<string, any>()
let jobIdCounter = 0

vi.mock('../../src/services/queue.js', () => ({
  enqueue: vi.fn().mockImplementation(async (request: any) => {
    const id = `job-${++jobIdCounter}`
    const job = {
      id,
      type: 'execute',
      payload: request,
      status: 'queued',
      workerId: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      result: null,
    }
    mockJobs.set(id, job)
    return job
  }),
  dequeue: vi.fn().mockImplementation(async () => {
    for (const [id, job] of mockJobs) {
      if (job.status === 'queued') {
        job.status = 'running'
        mockJobs.set(id, job)
        return job
      }
    }
    return null
  }),
  getJob: vi.fn().mockImplementation(async (id: string) => {
    return mockJobs.get(id) ?? null
  }),
  getJobs: vi.fn().mockResolvedValue([]),
  getJobCount: vi.fn().mockResolvedValue(0),
  updateJob: vi.fn().mockResolvedValue(undefined),
  updateResult: vi.fn().mockResolvedValue(undefined),
  healthCheck: vi.fn().mockResolvedValue(true),
  closeRedis: vi.fn().mockResolvedValue(undefined),
}))

describe('E2E full flow via Fastify inject', () => {
  const app = Fastify()

  beforeAll(async () => {
    await registerCors(app)
    await app.register(healthRoutes)
    await app.register(executeRoutes)
    await app.register(executionsRoutes)
    await app.register(workerRoutes)
    await app.register(workerApiRoutes)
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
    await closePool()
  })

  it('GET /api/health returns ok', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/health' })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body).toHaveProperty('status')
    expect(body).toHaveProperty('uptime')
    expect(body).toHaveProperty('timestamp')
    expect(body).toHaveProperty('checks')
  })

  it('POST /api/execute returns 202 with job id', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/execute',
      payload: { language: 'javascript', code: 'console.log("hello")' },
    })
    expect(res.statusCode).toBe(202)
    const body = JSON.parse(res.body)
    expect(body).toHaveProperty('id')
    expect(body.status).toBe('queued')
  })

  it('POST /api/execute returns 400 for invalid body', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/execute',
      payload: {},
    })
    expect(res.statusCode).toBe(400)
  })

  it('POST /api/execute returns 400 for unsupported language', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/execute',
      payload: { language: 'brainfuck', code: '+' },
    })
    expect(res.statusCode).toBe(400)
  })

  it('GET /api/status/:id returns 404 for missing job', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/status/nonexistent-job-id',
    })
    expect(res.statusCode).toBe(404)
  })

  it('POST /api/execute then GET /api/status/:id returns job', async () => {
    const postRes = await app.inject({
      method: 'POST',
      url: '/api/execute',
      payload: { language: 'python', code: 'print(1)' },
    })
    expect(postRes.statusCode).toBe(202)
    const { id } = JSON.parse(postRes.body)

    const getRes = await app.inject({
      method: 'GET',
      url: `/api/status/${id}`,
    })
    expect(getRes.statusCode).toBe(200)
    const job = JSON.parse(getRes.body)
    expect(job.id).toBe(id)
    expect(job.status).toBe('queued')
  })

  it('GET /api/executions returns list', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/executions',
    })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body).toHaveProperty('items')
    expect(body).toHaveProperty('total')
    expect(Array.isArray(body.items)).toBe(true)
  })

  it('GET /api/workers returns empty list', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/workers',
    })
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body)).toEqual([])
  })

  it('GET /api/workers/:id returns 404 for unknown worker', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/workers/unknown',
    })
    expect(res.statusCode).toBe(404)
  })

  it('GET /api/stats returns stats object', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/stats',
    })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body).toHaveProperty('executions24h')
    expect(body).toHaveProperty('activeWorkers')
    expect(body).toHaveProperty('avgDurationMs')
    expect(body).toHaveProperty('successRate')
  })
})
