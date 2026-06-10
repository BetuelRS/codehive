import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import Fastify from 'fastify'
import { executeRoutes } from '../../src/routes/execute.js'
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
  updateJob: vi.fn().mockImplementation(async (id: string, updates: any) => {
    const job = mockJobs.get(id)
    if (job) {
      Object.assign(job, updates, { updatedAt: new Date().toISOString() })
      mockJobs.set(id, job)
    }
  }),
  updateResult: vi.fn().mockResolvedValue(undefined),
  getJobs: vi.fn().mockResolvedValue([]),
  getJobCount: vi.fn().mockResolvedValue(0),
  healthCheck: vi.fn().mockResolvedValue(true),
  closeRedis: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../../src/services/executor.js', () => ({
  executeJob: vi.fn().mockResolvedValue(undefined),
}))

describe('worker-facing API flow', () => {
  const app = Fastify()

  beforeAll(async () => {
    await app.register(executeRoutes)
    await app.register(workerApiRoutes)
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
    await closePool()
  })

  it('POST /api/workers/:id/heartbeat accepts valid heartbeat', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/workers/w1/heartbeat',
      payload: {
        hostname: 'worker-1',
        status: 'idle',
        resources: { cpus: 4, memory: 8192 },
      },
    })
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body)).toEqual({ ok: true })
  })

  it('POST /api/workers/:id/heartbeat returns 400 for invalid body', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/workers/w1/heartbeat',
      payload: {},
    })
    expect(res.statusCode).toBe(400)
  })

  it('GET /api/workers/:id/jobs/next returns 204 when queue empty', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/workers/w1/jobs/next',
    })
    expect(res.statusCode).toBe(204)
  })

  it('GET /api/workers/:id/jobs/next returns job after enqueue', async () => {
    const postRes = await app.inject({
      method: 'POST',
      url: '/api/execute',
      payload: { language: 'javascript', code: 'console.log("hi")' },
    })
    expect(postRes.statusCode).toBe(202)
    const { id } = JSON.parse(postRes.body)

    const dequeueRes = await app.inject({
      method: 'GET',
      url: '/api/workers/w1/jobs/next',
    })
    expect(dequeueRes.statusCode).toBe(200)
    const job = JSON.parse(dequeueRes.body)
    expect(job.id).toBe(id)
    expect(job.status).toBe('running')
    expect(job.workerId).toBe('w1')
  })

  it('POST /api/workers/:id/jobs/:jobId/result accepts valid result', async () => {
    const postRes = await app.inject({
      method: 'POST',
      url: '/api/execute',
      payload: { language: 'javascript', code: 'console.log("ok")' },
    })
    const { id } = JSON.parse(postRes.body)

    const dequeueRes = await app.inject({
      method: 'GET',
      url: '/api/workers/w1/jobs/next',
    })
    expect(dequeueRes.statusCode).toBe(200)

    const resultRes = await app.inject({
      method: 'POST',
      url: `/api/workers/w1/jobs/${id}/result`,
      payload: {
        stdout: 'ok\n',
        stderr: '',
        exitCode: 0,
        status: 'completed',
        startedAt: new Date().toISOString(),
        finishedAt: new Date().toISOString(),
      },
    })
    expect(resultRes.statusCode).toBe(200)
    expect(JSON.parse(resultRes.body)).toEqual({ ok: true })
  })

  it('POST /api/workers/:id/jobs/:jobId/result returns 400 for invalid payload', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/workers/w1/jobs/j1/result',
      payload: { stdout: '' },
    })
    expect(res.statusCode).toBe(400)
  })

  it('POST /api/workers/:id/jobs/:jobId/result returns 404 for missing job', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/workers/w1/jobs/nonexistent/result',
      payload: {
        stdout: '',
        stderr: '',
        exitCode: 0,
        status: 'completed',
        startedAt: new Date().toISOString(),
        finishedAt: new Date().toISOString(),
      },
    })
    expect(res.statusCode).toBe(404)
  })
})
