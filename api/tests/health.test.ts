import { describe, it, expect, vi } from 'vitest'
import { healthRoutes } from '../src/routes/health.js'

vi.mock('../src/services/db.js', () => ({
  healthCheck: vi.fn().mockResolvedValue(true),
  closePool: vi.fn(),
}))

vi.mock('../src/services/queue.js', () => ({
  healthCheck: vi.fn().mockResolvedValue(true),
  closeRedis: vi.fn(),
}))

function createMockApp() {
  const routes: Array<{ method: string; url: string; handler: Function }> = []
  return {
    get: (url: string, handler: Function) => routes.push({ method: 'GET', url, handler }),
    routes,
  }
}

describe('healthRoutes', () => {
  it('registers GET /api/health', async () => {
    const app = createMockApp() as any
    await healthRoutes(app)
    expect(app.routes.length).toBe(1)
    expect(app.routes[0].method).toBe('GET')
    expect(app.routes[0].url).toBe('/api/health')
  })

  it('returns ok status when db and redis are healthy', async () => {
    const app = createMockApp() as any
    await healthRoutes(app)

    const handler = app.routes[0].handler
    const reply = {
      code: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
    }

    await handler({}, reply)
    expect(reply.code).toHaveBeenCalledWith(200)
    expect(reply.send).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'ok',
        checks: expect.objectContaining({
          database: 'ok',
          redis: 'ok',
        }),
      }),
    )
  })

  it('includes uptime and timestamp in response', async () => {
    const app = createMockApp() as any
    await healthRoutes(app)

    const handler = app.routes[0].handler
    const reply = {
      code: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
    }

    await handler({}, reply)
    const sent = (reply.send as any).mock.calls[0][0]
    expect(sent).toHaveProperty('uptime')
    expect(sent).toHaveProperty('timestamp')
    expect(typeof sent.uptime).toBe('number')
  })
})
