/** Request body for code execution. */
export interface ExecutionRequest {
  image: string
  cmd: string[]
  env?: Record<string, string>
  timeout?: number
  memory?: number
  cpus?: number
}

/** Output from completed or failed execution. */
export interface ExecutionResult {
  id: string
  status: 'queued' | 'running' | 'completed' | 'failed' | 'timeout'
  stdout: string
  stderr: string
  exitCode: number | null
  startedAt: string | null
  finishedAt: string | null
  error?: string
}

/** Job stored in Redis queue. */
export interface Job {
  id: string
  type: 'execute'
  payload: ExecutionRequest
  status: ExecutionResult['status']
  workerId: string | null
  createdAt: string
  updatedAt: string
  result: ExecutionResult | null
}

/** Worker registration and health info. */
export interface WorkerInfo {
  id: string
  hostname: string
  status: 'idle' | 'busy' | 'offline'
  labels: Record<string, string>
  lastHeartbeat: string
  currentJob: string | null
  resources: {
    cpus: number
    memory: number
  }
}

/** Health check response shape. */
export interface HealthStatus {
  status: 'ok' | 'degraded' | 'down'
  uptime: number
  timestamp: string
  checks: {
    database: 'ok' | 'error'
    redis: 'ok' | 'error'
  }
}
