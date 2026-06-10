# CodeHive Wiki

## Architecture Overview

CodeHive is distributed code execution platform. Flow:

```
User/Dashboard → API (Fastify) → Redis Queue → Worker (Rust) → Sandbox → Result
                     ↕                          ↕
              Orchestrator (Go) ←─────── Heartbeat + Poll
```

4 components:
- **API** — Fastify server, REST + WebSocket, Redis-backed job queue
- **Orchestrator** — Go dispatcher, worker pool, HTTP API, PostgreSQL persistence
- **Worker** — Rust binary, polls orchestrator for jobs, executes in sandbox
- **Dashboard** — Svelte 5 SPA with stores, WebSocket live feed

## Data Flow

```ascii
┌──────────┐    POST /api/execute    ┌──────────┐   LPUSH   ┌─────────┐
│ Dashboard │ ──────────────────────→ │   API    │ ────────→ │  Redis  │
│  (Svelte) │ ←────────────────────── │ (Fastify)│ ←──────── │  Queue  │
└──────────┘   GET /api/status/:id    └──────────┘   GET     └─────────┘
                                               │                    ↑
                                               │                    │
                                               ↓                    │
                                        ┌──────────┐    RPOP      │
                                        │ Worker   │ ──────────────┘
                                        │  (Rust)  │
                                        └────┬─────┘
                                             │ execute()
                                             ↓
                                        ┌──────────┐
                                        │  Sandbox │
                                        │  (temp   │
                                        │   dir)   │
                                        └──────────┘

Orchestrator (Go) path:
┌───────────┐  Submit()  ┌────────────┐                      ┌─────────┐
│  API /    │ ─────────→ │ Dispatcher │ ─── workerLoop() ──→ │ Execute │
│  execute  │            │ (Go pool)  │                      │ (cmd)   │
└───────────┘            └────────────┘                      └─────────┘
```

## Module: API (`api/src/`)

Fastify 5 server. Routes:

| Route | Method | Description |
|-------|--------|-------------|
| `/api/execute` | POST | Enqueue code execution |
| `/api/status/:id` | GET | Poll job result |
| `/api/workers` | GET | List registered workers |
| `/api/workers/:id` | GET | Get worker details |
| `/api/health` | GET | DB + Redis health |
| `/ws/execution/:id` | WS | Real-time execution logs |

Plugins: `@fastify/cors`, `@fastify/websocket`.  
Services: PostgreSQL (`services/db.ts`), Redis (`services/queue.ts`).

## Module: Orchestrator (`orchestrator/`)

Go 1.21, entry point `cmd/main.go`. 3 modes:

| Command | Description |
|---------|-------------|
| `orchestrator server` | HTTP API + worker dispatcher |
| `orchestrator worker` | Worker node (polls server) |
| `orchestrator run` | CLI single-shot execution |

Internal packages:
- `api` — HTTP handlers, CORS middleware
- `runner` — Dispatcher, worker pool, language executors
- `db` — PostgreSQL CRUD + migrations
- `types` — Shared structs (ExecutionRequest, Job, Config)

## Module: Worker (`worker/`)

Rust 2021, async with tokio. Core loop:
1. Heartbeat every N seconds → `POST /api/workers/{id}/heartbeat`
2. Poll every N ms → `GET /api/workers/{id}/jobs/next`
3. Execute in Sandbox → report result

Files:
- `main.rs` — Entry, heartbeat loop, poll loop
- `runner.rs` — Direct + Docker execution, command building
- `sandbox.rs` — Temp dir, compilation, cleanup
- `types.rs` — Language, ExecutionJob, ExecutionResult, WorkerConfig

Languages: Python, Node, Go, Rust, C++.  
Docker: optional, `use_docker` config flag.

## Module: Dashboard (`dashboard/`)

Svelte 5 SPA. Vite dev server proxied to API.

| Route | Component | Description |
|-------|-----------|-------------|
| Dashboard | `Dashboard.svelte` | Metrics + live feed |
| Executions | `Executions.svelte` | Code editor + history |
| Workers | `Workers.svelte` | Worker cards + detail |
| Settings | `Settings.svelte` | Theme, connection config |

Components: `CodeEditor`, `ExecutionCard`, `StatusBadge`.  
Lib: `api.ts` (fetch wrapper), `stores.ts` (Svelte stores + WebSocket).

## Module: DB (`db/`)

PostgreSQL schemas (auto-migrated by orchestrator):

- `execution_requests` — id, language, code, stdin, timeout, memory_limit
- `execution_results` — id, stdout, stderr, exit_code, duration, status
- `workers` — id, load, running_jobs, max_jobs, status

API also uses Redis for job queue (`codehive:queue` list, `codehive:job:*` keys).

## Module: Docker (`docker/`)

Empty — worker uses `docker run --rm` directly with language-specific images.

## Setup Guide

### Prerequisites
- Go 1.21+, Rust 2021+, Node 20+
- PostgreSQL (optional), Redis
- Docker (optional, for sandbox)

### Build & Run

```bash
# API
cd api && npm install && npm run dev

# Orchestrator
cd orchestrator && go build -o bin/ ./cmd/main.go
./bin/orchestrator server --port 8080

# Worker
cd worker && cargo build --release
WORKER_ID=node-1 ORCHESTRATOR_URL=http://localhost:8080 ./target/release/codehive-worker

# Dashboard
cd dashboard && npm install && npm run dev
```

### Environment

| Variable | Default | Component |
|----------|---------|-----------|
| `PORT` | 3001 | API |
| `PGHOST` | localhost | API |
| `REDIS_HOST` | localhost | API |
| `ORCHESTRATOR_URL` | http://localhost:8080 | Worker |
| `WORKER_ID` | auto-uuid | Worker |
| `USE_DOCKER` | false | Worker |
| `MAX_CONCURRENT_JOBS` | 4 | Worker |
