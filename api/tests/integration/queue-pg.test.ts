import { describe, it, expect } from 'vitest'
import { enqueue, dequeue, updateJob, updateResult, getJob, closeRedis } from '../../src/services/queue.js'
import type { ExecutionResult } from '../../src/types/index.js'

const describeRedis = process.env.REDIS_HOST
  ? describe
  : describe.skip

describeRedis('real Redis integration', () => {
  afterAll(async () => {
    await closeRedis()
  })

  it('enqueue job then getJob returns same job', async () => {
    const job = await enqueue({
      image: 'node:22-slim',
      cmd: ['node', '-e', 'console.log("hi")'],
      timeout: 30,
    })
    expect(job.id).toBeDefined()
    expect(job.status).toBe('queued')

    const fetched = await getJob(job.id)
    expect(fetched).not.toBeNull()
    expect(fetched!.id).toBe(job.id)
    expect(fetched!.payload.image).toBe('node:22-slim')
  })

  it('enqueue → dequeue round-trip', async () => {
    const job = await enqueue({
      image: 'python:3.12-slim',
      cmd: ['python3', '-c', 'print(42)'],
    })
    const dequeued = await dequeue()
    expect(dequeued).not.toBeNull()
    expect(dequeued!.id).toBe(job.id)
  })

  it('dequeue returns null when queue empty', async () => {
    const result = await dequeue()
    expect(result).toBeNull()
  })

  it('updateJob modifies job fields', async () => {
    const job = await enqueue({
      image: 'node:22-slim',
      cmd: ['node', '-e', '1'],
    })
    await updateJob(job.id, { status: 'running', workerId: 'w1' })
    const updated = await getJob(job.id)
    expect(updated!.status).toBe('running')
    expect(updated!.workerId).toBe('w1')
  })

  it('updateResult sets execution result', async () => {
    const job = await enqueue({
      image: 'node:22-slim',
      cmd: ['node', '-e', '1'],
    })
    const result: ExecutionResult = {
      id: job.id,
      status: 'completed',
      stdout: '1\n',
      stderr: '',
      exitCode: 0,
      startedAt: new Date().toISOString(),
      finishedAt: new Date().toISOString(),
    }
    await updateResult(job.id, result)
    const fetched = await getJob(job.id)
    expect(fetched!.status).toBe('completed')
    expect(fetched!.result).not.toBeNull()
    expect(fetched!.result!.stdout).toBe('1\n')
  })

  it('getJob returns null for nonexistent job', async () => {
    const fetched = await getJob('nonexistent-job-id')
    expect(fetched).toBeNull()
  })
})
