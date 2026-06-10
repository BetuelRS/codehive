import { Redis } from 'ioredis'
import { randomUUID } from 'node:crypto'
import type { Job, ExecutionRequest, ExecutionResult } from '../types/index.js'

const QUEUE_KEY = 'codehive:queue'
const JOB_PREFIX = 'codehive:job:'

let redis: Redis | null = null
let redisAttempted = false

class MemoryQueue {
  jobs = new Map<string, Job>()
  order: string[] = []

  enqueue(job: Job): void {
    this.jobs.set(job.id, job)
    this.order.push(job.id)
  }

  dequeue(): Job | null {
    const id = this.order.shift()
    if (!id) return null
    return this.jobs.get(id) ?? null
  }

  getJob(id: string): Job | null {
    return this.jobs.get(id) ?? null
  }

  updateJob(id: string, updates: Partial<Job>): void {
    const job = this.jobs.get(id)
    if (!job) throw new Error(`Job ${id} not found`)
    Object.assign(job, updates, { updatedAt: new Date().toISOString() })
  }

  getJobs(limit: number, offset: number, filter?: { since?: string }): Job[] {
    let ids = this.order
    if (filter?.since) ids = ids.filter(id => (this.jobs.get(id)?.createdAt ?? '') >= filter.since!)
    return ids.slice(offset, offset + limit).map(id => this.jobs.get(id)!).filter(Boolean)
  }

  getJobCount(filter?: { since?: string }): number {
    if (filter?.since) return this.order.filter(id => (this.jobs.get(id)?.createdAt ?? '') >= filter.since!).length
    return this.order.length
  }

  clear(): void {
    this.jobs.clear()
    this.order = []
  }
}

const mem = new MemoryQueue()

function getRedis(): Redis {
  if (!redis && !redisAttempted) {
    redisAttempted = true
    if (process.env.REDIS_HOST && process.env.REDIS_HOST !== 'placeholder') {
      redis = new Redis({
        host: process.env.REDIS_HOST,
        port: Number(process.env.REDIS_PORT ?? 6379),
        password: process.env.REDIS_PASSWORD ?? undefined,
        retryStrategy(times: number) {
          const delay = Math.min(times * 100, 3000)
          return delay
        },
        maxRetriesPerRequest: 1,
        lazyConnect: true,
      })
      redis.on('error', (err: Error & { code?: string }) => {
        if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') return
        console.error('Redis error', err)
      })
    }
  }
  return redis!
}

function useRedis(): boolean {
  const r = getRedis()
  return !!r
}

export async function enqueue(request: ExecutionRequest): Promise<Job> {
  const id = randomUUID()
  const now = new Date().toISOString()
  const job: Job = { id, type: 'execute', payload: request, status: 'queued', workerId: null, createdAt: now, updatedAt: now, result: null }

  if (useRedis()) {
    const r = redis!
    await r.multi().set(`${JOB_PREFIX}${id}`, JSON.stringify(job)).lpush(QUEUE_KEY, id).exec()
  } else {
    mem.enqueue(job)
  }
  return job
}

export async function dequeue(): Promise<Job | null> {
  if (useRedis()) {
    const r = redis!
    const id = await r.rpop(QUEUE_KEY)
    if (!id) return null
    const data = await r.get(`${JOB_PREFIX}${id}`)
    return data ? JSON.parse(data) as Job : null
  }
  return mem.dequeue()
}

export async function getJob(id: string): Promise<Job | null> {
  if (useRedis()) {
    const r = redis!
    const data = await r.get(`${JOB_PREFIX}${id}`)
    return data ? JSON.parse(data) as Job : null
  }
  return mem.getJob(id)
}

export async function updateJob(id: string, updates: Partial<Job>): Promise<void> {
  if (useRedis()) {
    const r = redis!
    const job = await getJob(id)
    if (!job) throw new Error(`Job ${id} not found`)
    Object.assign(job, updates, { updatedAt: new Date().toISOString() })
    await r.set(`${JOB_PREFIX}${id}`, JSON.stringify(job))
  } else {
    mem.updateJob(id, updates)
  }
}

export async function updateResult(id: string, result: ExecutionResult): Promise<void> {
  const job = await getJob(id)
  if (!job) throw new Error(`Job ${id} not found`)
  job.result = result
  job.status = result.status
  job.updatedAt = new Date().toISOString()
  if (useRedis()) {
    const r = redis!
    await r.set(`${JOB_PREFIX}${id}`, JSON.stringify(job))
  }
}

export async function getJobs(limit: number, offset: number, filter?: { since?: string }): Promise<Job[]> {
  if (useRedis()) {
    const r = redis!
    const ids = await r.lrange(QUEUE_KEY, offset, offset + limit - 1)
    if (!ids.length) return []
    const pipeline = r.pipeline()
    for (const id of ids) pipeline.get(`${JOB_PREFIX}${id}`)
    const results = await pipeline.exec()
    if (!results) return []
    const jobs: Job[] = []
    for (const [, data] of results) {
      if (data && typeof data === 'string') {
        const job = JSON.parse(data) as Job
        if (filter?.since && job.createdAt < filter.since) continue
        jobs.push(job)
      }
    }
    return jobs.slice(0, limit)
  }
  return mem.getJobs(limit, offset, filter)
}

export async function getJobCount(filter?: { since?: string }): Promise<number> {
  if (useRedis()) {
    const r = redis!
    if (filter?.since) {
      const ids = await r.lrange(QUEUE_KEY, 0, -1)
      let count = 0
      for (const id of ids) {
        const data = await r.get(`${JOB_PREFIX}${id}`)
        if (data) { const j = JSON.parse(data) as Job; if (j.createdAt >= filter.since) count++ }
      }
      return count
    }
    return r.llen(QUEUE_KEY)
  }
  return mem.getJobCount(filter)
}

export async function healthCheck(): Promise<boolean> {
  if (useRedis()) {
    try { await redis!.ping(); return true } catch { return false }
  }
  return true
}

export async function closeRedis(): Promise<void> {
  if (redis) await redis.quit()
}

export { redis }
