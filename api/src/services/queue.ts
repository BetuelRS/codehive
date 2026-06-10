/** Redis-backed job queue for code execution. */
import { Redis } from 'ioredis'
import { randomUUID } from 'node:crypto'
import type { Job, ExecutionRequest, ExecutionResult } from '../types/index.js'

const QUEUE_KEY = 'codehive:queue'
const JOB_PREFIX = 'codehive:job:'

let redis: Redis | null = null

function getRedis(): Redis {
  if (!redis) {
    redis = new Redis({
      host: process.env.REDIS_HOST ?? 'localhost',
      port: Number(process.env.REDIS_PORT ?? 6379),
      password: process.env.REDIS_PASSWORD ?? undefined,
      retryStrategy(times: number) {
        const delay = Math.min(times * 50, 2000)
        return delay
      },
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    })
    redis.on('error', (err: Error & { code?: string }) => {
      if (err.code === 'ECONNREFUSED') return
      console.error('Redis error', err)
    })
  }
  return redis
}

/** Enqueues execution request to Redis list. */
export async function enqueue(
  request: ExecutionRequest,
): Promise<Job> {
  const id = randomUUID()
  const now = new Date().toISOString()
  const job: Job = {
    id,
    type: 'execute',
    payload: request,
    status: 'queued',
    workerId: null,
    createdAt: now,
    updatedAt: now,
    result: null,
  }

  const r = getRedis()
  await r
    .multi()
    .set(`${JOB_PREFIX}${id}`, JSON.stringify(job))
    .lpush(QUEUE_KEY, id)
    .exec()

  return job
}

/** Dequeues next job from Redis list (right-pop). */
export async function dequeue(): Promise<Job | null> {
  const r = getRedis()
  const id = await r.rpop(QUEUE_KEY)
  if (!id) return null

  const data = await r.get(`${JOB_PREFIX}${id}`)
  if (!data) return null

  return JSON.parse(data) as Job
}

/** Gets job data from Redis by ID. */
export async function getJob(id: string): Promise<Job | null> {
  const r = getRedis()
  const data = await r.get(`${JOB_PREFIX}${id}`)
  if (!data) return null
  return JSON.parse(data) as Job
}

/** Updates job fields in Redis. */
export async function updateJob(
  id: string,
  updates: Partial<Job>,
): Promise<void> {
  const job = await getJob(id)
  if (!job) throw new Error(`Job ${id} not found`)

  Object.assign(job, updates, { updatedAt: new Date().toISOString() })
  const r = getRedis()
  await r.set(`${JOB_PREFIX}${id}`, JSON.stringify(job))
}

/** Updates job with execution result in Redis. */
export async function updateResult(
  id: string,
  result: ExecutionResult,
): Promise<void> {
  const job = await getJob(id)
  if (!job) throw new Error(`Job ${id} not found`)

  job.result = result
  job.status = result.status
  job.updatedAt = new Date().toISOString()
  const r = getRedis()
  await r.set(`${JOB_PREFIX}${id}`, JSON.stringify(job))
}

/** Lists jobs with pagination and optional time filter. */
export async function getJobs(
  limit: number,
  offset: number,
  filter?: { since?: string },
): Promise<Job[]> {
  const r = getRedis()
  const ids = await r.lrange(QUEUE_KEY, offset, offset + limit - 1)
  if (!ids.length) return []
  const pipeline = r.pipeline()
  for (const id of ids) {
    pipeline.get(`${JOB_PREFIX}${id}`)
  }
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

/** Counts total jobs, optionally filtered by time. */
export async function getJobCount(filter?: { since?: string }): Promise<number> {
  const r = getRedis()
  if (filter?.since) {
    const ids = await r.lrange(QUEUE_KEY, 0, -1)
    let count = 0
    for (const id of ids) {
      const data = await r.get(`${JOB_PREFIX}${id}`)
      if (data) {
        const job = JSON.parse(data) as Job
        if (job.createdAt >= filter.since) count++
      }
    }
    return count
  }
  return r.llen(QUEUE_KEY)
}

/** Pings Redis to check connectivity. */
export async function healthCheck(): Promise<boolean> {
  try {
    const r = getRedis()
    await r.ping()
    return true
  } catch {
    return false
  }
}

/** Gracefully closes Redis connection. */
export async function closeRedis(): Promise<void> {
  if (redis) await redis.quit()
}

export { redis }
