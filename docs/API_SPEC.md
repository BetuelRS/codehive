# CodeHive API Specification

## OpenAPI 3.1

```yaml
openapi: 3.1.0
info:
  title: CodeHive API
  version: 0.1.0
  description: Distributed code execution platform API
servers:
  - url: http://localhost:3001
    description: Development
  - url: http://localhost:8080
    description: Orchestrator (Go)

paths:
  /api/execute:
    post:
      summary: Enqueue code execution
      operationId: executeCode
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/ExecutionRequest'
      responses:
        '202':
          description: Job queued
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/QueuedResponse'
        '400':
          description: Validation error
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'

  /api/status/{id}:
    get:
      summary: Get execution result
      operationId: getStatus
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
            format: uuid
      responses:
        '200':
          description: Execution result
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ExecutionResult'
        '404':
          description: Job not found
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'

  /api/workers:
    get:
      summary: List registered workers
      operationId: listWorkers
      responses:
        '200':
          description: Worker list
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: '#/components/schemas/WorkerInfo'

  /api/workers/{id}:
    get:
      summary: Get worker details
      operationId: getWorker
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
      responses:
        '200':
          description: Worker info
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/WorkerInfo'
        '404':
          description: Worker not found

  /api/workers/{id}/heartbeat:
    post:
      summary: Worker heartbeat (internal)
      operationId: workerHeartbeat
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
      requestBody:
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/WorkerStatus'
      responses:
        '200':
          description: Acknowledged

  /api/workers/{id}/jobs/next:
    get:
      summary: Dequeue next job (internal)
      operationId: dequeueJob
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
      responses:
        '200':
          description: Job assigned
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ExecutionJob'
        '204':
          description: No pending jobs

  /api/workers/{id}/jobs/{jobId}/result:
    post:
      summary: Submit execution result (internal)
      operationId: submitResult
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
        - name: jobId
          in: path
          required: true
          schema:
            type: string
      requestBody:
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/ExecutionResult'
      responses:
        '200':
          description: Result stored

  /api/health:
    get:
      summary: Health check
      operationId: healthCheck
      responses:
        '200':
          description: Healthy or degraded
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/HealthStatus'
        '503':
          description: Service down

components:
  schemas:
    ExecutionRequest:
      type: object
      required: [image, cmd]
      properties:
        image:
          type: string
          description: Docker image or language runtime
          example: python:3.12-slim
        cmd:
          type: array
          items:
            type: string
          description: Command to execute
          example: ["python3", "-c", "print('hello')"]
        env:
          type: object
          additionalProperties:
            type: string
          description: Environment variables
        timeout:
          type: integer
          maximum: 3600
          default: 30
          description: Timeout in seconds
        memory:
          type: integer
          maximum: 32768
          description: Memory limit in MB
        cpus:
          type: integer
          maximum: 64
          description: CPU limit

    QueuedResponse:
      type: object
      properties:
        jobId:
          type: string
          format: uuid
        status:
          type: string
          enum: [queued]
      example:
        jobId: "550e8400-e29b-41d4-a716-446655440000"
        status: "queued"

    ExecutionResult:
      type: object
      properties:
        id:
          type: string
        status:
          type: string
          enum: [queued, running, completed, failed, timeout]
        stdout:
          type: string
        stderr:
          type: string
        exitCode:
          type: integer
          nullable: true
        startedAt:
          type: string
          format: date-time
          nullable: true
        finishedAt:
          type: string
          format: date-time
          nullable: true
        error:
          type: string
      example:
        id: "550e8400-e29b-41d4-a716-446655440000"
        status: "completed"
        stdout: "hello world\n"
        stderr: ""
        exitCode: 0
        startedAt: "2026-06-10T12:00:00Z"
        finishedAt: "2026-06-10T12:00:01Z"

    WorkerInfo:
      type: object
      properties:
        id:
          type: string
        hostname:
          type: string
        status:
          type: string
          enum: [idle, busy, offline]
        labels:
          type: object
          additionalProperties:
            type: string
        lastHeartbeat:
          type: string
          format: date-time
        currentJob:
          type: string
          nullable: true
        resources:
          type: object
          properties:
            cpus:
              type: integer
            memory:
              type: integer

    WorkerStatus:
      type: object
      properties:
        worker_id:
          type: string
        hostname:
          type: string
        version:
          type: string
        uptime_seconds:
          type: integer
        active_jobs:
          type: integer
        completed_jobs:
          type: integer
        failed_jobs:
          type: integer
        avg_duration_ms:
          type: number
        docker_available:
          type: boolean
        languages:
          type: array
          items:
            type: string

    ExecutionJob:
      type: object
      properties:
        id:
          type: string
        code:
          type: string
        language:
          type: string
          enum: [python, node, go, rust, cpp]
        timeout_ms:
          type: integer
          default: 30000
        memory_limit_mb:
          type: integer
          nullable: true
        stdin:
          type: string
          nullable: true
        env_vars:
          type: object
          additionalProperties:
            type: string
          nullable: true

    HealthStatus:
      type: object
      properties:
        status:
          type: string
          enum: [ok, degraded, down]
        uptime:
          type: number
        timestamp:
          type: string
          format: date-time
        checks:
          type: object
          properties:
            database:
              type: string
              enum: [ok, error]
            redis:
              type: string
              enum: [ok, error]

    ErrorResponse:
      type: object
      properties:
        error:
          type: string
        message:
          type: string
        details:
          type: object
```

## TypeScript Client Types

```typescript
export interface ExecutionRequest {
  image: string
  cmd: string[]
  env?: Record<string, string>
  timeout?: number
  memory?: number
  cpus?: number
}

export interface QueuedResponse {
  jobId: string
  status: 'queued'
}

export type JobStatus = 'queued' | 'running' | 'completed' | 'failed' | 'timeout'

export interface ExecutionResult {
  id: string
  status: JobStatus
  stdout: string
  stderr: string
  exitCode: number | null
  startedAt: string | null
  finishedAt: string | null
  error?: string
}

export interface WorkerInfo {
  id: string
  hostname: string
  status: 'idle' | 'busy' | 'offline'
  labels: Record<string, string>
  lastHeartbeat: string
  currentJob: string | null
  resources: { cpus: number; memory: number }
}

export interface HealthStatus {
  status: 'ok' | 'degraded' | 'down'
  uptime: number
  timestamp: string
  checks: { database: 'ok' | 'error'; redis: 'ok' | 'error' }
}
```

## Request/Response Examples

### Execute code
```bash
curl -X POST http://localhost:3001/api/execute \
  -H 'Content-Type: application/json' \
  -d '{"image":"python:3.12-slim","cmd":["python3","-c","print(2+2)"]}'
```
→ `202 {"jobId":"uuid","status":"queued"}`

### Poll status
```bash
curl http://localhost:3001/api/status/uuid
```
→ `200 {"id":"uuid","status":"completed","stdout":"4\n","exitCode":0,...}`

### List workers
```bash
curl http://localhost:3001/api/workers
```
→ `200 [{"id":"worker-1","hostname":"node-1","status":"idle",...}]`

### Health check
```bash
curl http://localhost:3001/api/health
```
→ `200 {"status":"ok","uptime":123.45,"timestamp":"2026-06-10T12:00:00Z","checks":{"database":"ok","redis":"ok"}}`
