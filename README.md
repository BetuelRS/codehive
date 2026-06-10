# CodeHive

> Distributed code execution platform — submit code, queue in Redis, execute in sandboxed Rust workers, stream results to Svelte 5 dashboard.

[![Go](https://img.shields.io/badge/Go-1.21-00ADD8?logo=go)](orchestrator/)
[![Rust](https://img.shields.io/badge/Rust-2021-000000?logo=rust)](worker/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?logo=typescript)](api/)
[![Svelte](https://img.shields.io/badge/Svelte-5-FF3E00?logo=svelte)](dashboard/)
[![Fastify](https://img.shields.io/badge/Fastify-5-000000?logo=fastify)](api/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?logo=postgresql)](db/)
[![Redis](https://img.shields.io/badge/Redis-DC382D?logo=redis)](api/src/services/queue.ts)

## Architecture

```
User → Dashboard (Svelte 5) → API (Fastify 5) → Redis Queue
                                                ↓
Worker (Rust) → Sandbox (subprocess/Docker) → Result
Orchestrator (Go) ↔ PostgreSQL ← direct dispatch path
```

**4 components**:
- **API** — Fastify 5, REST + WebSocket, Redis-backed queue, PostgreSQL pool
- **Orchestrator** — Go 1.21, worker pool dispatcher, HTTP API, PostgreSQL persistence
- **Worker** — Rust 2021, tokio async, heartbeat + poll loops, sandboxed execution
- **Dashboard** — Svelte 5 SPA, stores, WebSocket live feed, code editor

**5 languages**: Python, Node/JS, Go, Rust, C++

## Quick Start

```bash
# 1. API
cd api && npm install && npm run dev

# 2. Orchestrator
cd orchestrator && go build -o bin/ ./cmd/main.go
./bin/orchestrator server --port 8080

# 3. Worker
cd worker && cargo build --release
WORKER_ID=node-1 ORCHESTRATOR_URL=http://localhost:8080 ./target/release/codehive-worker

# 4. Dashboard
cd dashboard && npm install && npm run dev
```

Open `http://localhost:5173` — Vite proxies `/api` and `/ws` to API at `:3001`.

## Test

| Component | Command |
|-----------|---------|
| API | `cd api && npm test` |
| Orchestrator | `cd orchestrator && go test ./...` |
| Worker | `cd worker && cargo test` |
| Dashboard | `cd dashboard && npx vitest` |

## Docs

| File | Contents |
|------|----------|
| `docs/CODEHIVE_WIKI.md` | Architecture, data flow, component details, env vars |
| `docs/API_SPEC.md` | OpenAPI 3.1 spec + TypeScript client types |
| `docs/MIGRATION_PATHS.md` | Migration history and future plans |
| `docs/PROMPTS.md` | Dev commands quick reference |
| `shared/TYPES.md` | Canonical cross-language type definitions |
| `docs/MEGA_ENGENHARIA_REPORT.md` | Full consolidation of all 24 applied skills |

## Environment

| Variable | Default | Component |
|----------|---------|-----------|
| `PORT` | 3001 | API |
| `PGHOST` | localhost | API |
| `REDIS_HOST` | localhost | API |
| `ORCHESTRATOR_URL` | http://localhost:8080 | Worker |
| `WORKER_ID` | auto-uuid | Worker |
| `USE_DOCKER` | false | Worker |
| `MAX_CONCURRENT_JOBS` | 4 | Worker |

## License

MIT
