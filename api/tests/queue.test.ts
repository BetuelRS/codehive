import { describe, it, expect, vi, beforeEach } from 'vitest'

const chain = {
  set: vi.fn().mockReturnThis(),
  lpush: vi.fn().mockReturnThis(),
  exec: vi.fn().mockResolvedValue([]),
}

const mockRedisInstance = {
  get: vi.fn(),
  set: vi.fn(),
  multi: vi.fn().mockReturnValue(chain),
  rpop: vi.fn(),
  ping: vi.fn().mockResolvedValue('PONG'),
  quit: vi.fn().mockResolvedValue(undefined),
  on: vi.fn(),
}

vi.mock('ioredis', () => ({
  default: vi.fn(() => mockRedisInstance),
  Redis: vi.fn(() => mockRedisInstance),
}))

describe('queue service', () => {
  let queue: typeof import('../src/services/queue.js')

  beforeEach(async () => {
    vi.resetModules()
    mockRedisInstance.get.mockReset()
    mockRedisInstance.set.mockReset()
    mockRedisInstance.rpop.mockReset()
    mockRedisInstance.ping.mockReset()
    chain.set.mockClear()
    chain.lpush.mockClear()
    chain.exec.mockClear()
    mockRedisInstance.multi.mockClear()
    queue = await import('../src/services/queue.js')
  })

  it('enqueue creates job with unique id', async () => {
    const job = await queue.enqueue({
      image: 'node:22',
      cmd: ['node', '-e', 'console.log(1)'],
    })
    expect(job.id).toBeDefined()
    expect(job.type).toBe('execute')
    expect(job.status).toBe('queued')
    expect(job.result).toBeNull()
    expect(mockRedisInstance.multi).toHaveBeenCalled()
    expect(chain.set).toHaveBeenCalled()
    expect(chain.lpush).toHaveBeenCalled()
    expect(chain.exec).toHaveBeenCalled()
  })

  it('enqueue sets correct fields', async () => {
    const job = await queue.enqueue({
      image: 'python:3.12',
      cmd: ['python3', '-c', 'print(1)'],
      timeout: 60,
      memory: 512,
    })
    expect(job.payload.image).toBe('python:3.12')
    expect(job.payload.timeout).toBe(60)
    expect(job.payload.memory).toBe(512)
  })

  it('dequeue returns null when queue empty', async () => {
    mockRedisInstance.rpop.mockResolvedValue(null)
    const job = await queue.dequeue()
    expect(job).toBeNull()
  })

  it('healthCheck returns true when redis is up', async () => {
    const healthy = await queue.healthCheck()
    expect(healthy).toBe(true)
    expect(mockRedisInstance.ping).toHaveBeenCalled()
  })

  it('healthCheck returns false on ping failure', async () => {
    mockRedisInstance.ping.mockRejectedValue(new Error('down'))
    const unhealthy = await queue.healthCheck()
    expect(unhealthy).toBe(false)
  })

  it('getJob returns null for missing job', async () => {
    mockRedisInstance.get.mockResolvedValue(null)
    const job = await queue.getJob('nonexistent')
    expect(job).toBeNull()
  })

  it('updateJob throws for missing job', async () => {
    mockRedisInstance.get.mockResolvedValue(null)
    await expect(queue.updateJob('missing', { status: 'running' })).rejects.toThrow(
      'Job missing not found',
    )
  })

  it('updateResult throws for missing job', async () => {
    mockRedisInstance.get.mockResolvedValue(null)
    await expect(
      queue.updateResult('missing', {
        id: 'missing',
        status: 'completed',
        stdout: '',
        stderr: '',
        exitCode: 0,
        startedAt: null,
        finishedAt: null,
      }),
    ).rejects.toThrow('Job missing not found')
  })

  it('closeRedis quits the redis connection', async () => {
    await queue.healthCheck()
    await queue.closeRedis()
    expect(mockRedisInstance.quit).toHaveBeenCalled()
  })

  it('dequeue returns job when queue has items', async () => {
    mockRedisInstance.rpop.mockResolvedValue('job-1')
    mockRedisInstance.get.mockResolvedValue(
      JSON.stringify({
        id: 'job-1',
        type: 'execute',
        status: 'queued',
        payload: { image: 'node:22', cmd: ['node', '-e', '1'] },
        workerId: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        result: null,
      }),
    )
    const job = await queue.dequeue()
    expect(job).not.toBeNull()
    expect(job!.id).toBe('job-1')
  })
})
