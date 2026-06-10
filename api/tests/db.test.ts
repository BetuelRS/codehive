import { describe, it, expect, vi } from 'vitest'

const mockQuery = vi.fn()
const mockConnect = vi.fn()
const mockEnd = vi.fn()

vi.mock('pg', () => {
  return {
    default: {
      Pool: vi.fn().mockImplementation(() => ({
        query: mockQuery,
        connect: mockConnect,
        end: mockEnd,
        on: vi.fn(),
      })),
    },
  }
})

describe('db service', () => {
  beforeEach(() => {
    vi.resetModules()
    mockQuery.mockReset()
    mockConnect.mockReset()
    mockEnd.mockReset()
  })

  it('healthCheck returns true on successful query', async () => {
    mockQuery.mockResolvedValue({ rows: [{ '?column?': 1 }] })
    const db = await import('../src/services/db.js')
    const result = await db.healthCheck()
    expect(result).toBe(true)
    expect(mockQuery).toHaveBeenCalledWith('SELECT 1', undefined)
  })

  it('healthCheck returns false on query failure', async () => {
    mockQuery.mockRejectedValue(new Error('connection refused'))
    const db = await import('../src/services/db.js')
    const result = await db.healthCheck()
    expect(result).toBe(false)
  })

  it('query logs duration in dev mode', async () => {
    mockQuery.mockResolvedValue({ rows: [] })
    const origNodeEnv = process.env.NODE_ENV
    process.env.NODE_ENV = 'development'
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {})

    const db = await import('../src/services/db.js')
    await db.query('SELECT 1')

    expect(consoleLog).toHaveBeenCalledWith(
      'query',
      expect.objectContaining({ text: 'SELECT 1' }),
    )

    consoleLog.mockRestore()
    process.env.NODE_ENV = origNodeEnv
  })

  it('getClient returns a client from pool', async () => {
    const mockClient = { query: vi.fn(), release: vi.fn() }
    mockConnect.mockResolvedValue(mockClient)
    const db = await import('../src/services/db.js')
    const client = await db.getClient()
    expect(client).toBe(mockClient)
  })

  it('closePool calls pool.end', async () => {
    mockEnd.mockResolvedValue(undefined)
    const db = await import('../src/services/db.js')
    await db.healthCheck()
    await db.closePool()
    expect(mockEnd).toHaveBeenCalled()
  })

  it('pool is exported', async () => {
    const db = await import('../src/services/db.js')
    expect(db.pool).toBeDefined()
  })
})
