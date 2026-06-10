import { describe, it, expect, vi } from 'vitest'
import { workerRoutes } from '../src/routes/workers.js'

function createMockApp() {
  const routes: Array<{ method: string; url: string; handler: Function }> = []
  return {
    get: (url: string, handler: Function) => routes.push({ method: 'GET', url, handler }),
    routes,
  }
}

describe('workerRoutes', () => {
  it('registers GET /api/workers and GET /api/workers/:id', async () => {
    const app = createMockApp() as any
    await workerRoutes(app)
    expect(app.routes.length).toBe(2)
    expect(app.routes[0].method).toBe('GET')
    expect(app.routes[0].url).toBe('/api/workers')
    expect(app.routes[1].method).toBe('GET')
    expect(app.routes[1].url).toBe('/api/workers/:id')
  })

  it('GET /api/workers returns empty list initially', async () => {
    const app = createMockApp() as any
    await workerRoutes(app)

    const handler = app.routes[0].handler
    const reply = {
      code: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
    }

    await handler({}, reply)
    expect(reply.send).toHaveBeenCalledWith([])
  })

  it('GET /api/workers/:id returns 404 for unknown worker', async () => {
    const app = createMockApp() as any
    await workerRoutes(app)

    const handler = app.routes[1].handler
    const reply = {
      code: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
    }

    await handler({ params: { id: 'unknown' } }, reply)
    expect(reply.code).toHaveBeenCalledWith(404)
  })
})
