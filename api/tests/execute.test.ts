import { describe, it, expect, vi, beforeEach } from 'vitest'
import { executeRoutes } from '../src/routes/execute.js'

vi.mock('../src/services/queue.js', () => ({
  enqueue: vi.fn().mockResolvedValue({ id: 'test-job-id', status: 'queued' }),
  getJob: vi.fn().mockImplementation((id: string) => {
    if (id === 'existing') {
      return {
        id: 'existing',
        status: 'completed',
        result: { id: 'existing', status: 'completed', stdout: 'hello', stderr: '', exitCode: 0, startedAt: null, finishedAt: null },
      }
    }
    return null
  }),
  healthCheck: vi.fn().mockResolvedValue(true),
  closeRedis: vi.fn(),
}))

function createMockApp() {
  const routes: Array<{ method: string; url: string; handler: Function }> = []
  return {
    post: (url: string, handler: Function) => routes.push({ method: 'POST', url, handler }),
    get: (url: string, handler: Function) => routes.push({ method: 'GET', url, handler }),
    routes,
  }
}

describe('executeRoutes', () => {
  it('registers POST /api/execute and GET /api/status/:id', async () => {
    const app = createMockApp() as any
    app.broadcastExecutionLog = vi.fn()
    await executeRoutes(app)
    expect(app.routes.length).toBe(2)
    expect(app.routes[0].method).toBe('POST')
    expect(app.routes[0].url).toBe('/api/execute')
    expect(app.routes[1].method).toBe('GET')
    expect(app.routes[1].url).toBe('/api/status/:id')
  })

  it('POST /api/execute returns 202 with valid body', async () => {
    const app = createMockApp() as any
    app.broadcastExecutionLog = vi.fn()
    await executeRoutes(app)

    const handler = app.routes[0].handler
    const reply = {
      code: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
    }

    await handler(
      { body: { image: 'node:22', cmd: ['node', '-e', 'console.log(1)'] } },
      reply,
    )

    expect(reply.code).toHaveBeenCalledWith(202)
    expect(reply.send).toHaveBeenCalledWith(
      expect.objectContaining({ jobId: 'test-job-id', status: 'queued' }),
    )
  })

  it('POST /api/execute returns 400 with invalid body', async () => {
    const app = createMockApp() as any
    app.broadcastExecutionLog = vi.fn()
    await executeRoutes(app)

    const handler = app.routes[0].handler
    const reply = {
      code: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
    }

    await handler({ body: {} }, reply)
    expect(reply.code).toHaveBeenCalledWith(400)
  })

  it('GET /api/status/:id returns 404 for missing job', async () => {
    const app = createMockApp() as any
    app.broadcastExecutionLog = vi.fn()
    await executeRoutes(app)

    const handler = app.routes[1].handler
    const reply = {
      code: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
    }

    await handler({ params: { id: 'nonexistent' } }, reply)
    expect(reply.code).toHaveBeenCalledWith(404)
  })

  it('GET /api/status/:id returns job for existing job', async () => {
    const app = createMockApp() as any
    app.broadcastExecutionLog = vi.fn()
    await executeRoutes(app)

    const handler = app.routes[1].handler
    const reply = {
      code: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
    }

    await handler({ params: { id: 'existing' } }, reply)
    expect(reply.send).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'completed', stdout: 'hello' }),
    )
  })

  it('GET /api/status/:id returns 400 with missing id', async () => {
    const app = createMockApp() as any
    app.broadcastExecutionLog = vi.fn()
    await executeRoutes(app)

    const handler = app.routes[1].handler
    const reply = {
      code: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
    }

    await handler({ params: { id: '' } }, reply)
    expect(reply.code).toHaveBeenCalledWith(400)
  })
})
