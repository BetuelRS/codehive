# Contributing

## Prerequisites

- Node 22+ (API, Dashboard)
- Go 1.23+ (Orchestrator)
- Rust 1.83+ (Worker)
- Docker + Docker Compose (PG + Redis)

## Dev Setup

```bash
# start infra
docker compose -f docker/docker-compose.yml up -d postgres redis

# API
cd api && npm install && npm run dev

# Orchestrator
cd orchestrator && go build -o bin/ ./cmd/main.go
./bin/orchestrator server

# Worker
cd worker && cargo build --release
WORKER_ID=dev-1 ORCHESTRATOR_URL=http://localhost:8080 ./target/release/codehive-worker

# Dashboard
cd dashboard && npm install && npm run dev
```

## Tests

| Component | Command |
|-----------|---------|
| API | `cd api && npm test` |
| Orchestrator | `cd orchestrator && go test ./...` |
| Worker | `cd worker && cargo test` |
| Dashboard | `cd dashboard && npx vitest` |

## Code Style

- TypeScript: strict mode, no `any`
- Go: `gofmt` + `go vet`
- Rust: `cargo clippy -- -D warnings`
- Svelte: `svelte-check`

## PR Checklist

- [ ] All tests pass
- [ ] No type/compile errors
- [ ] No lint/clippy warnings
- [ ] Docs updated if API changes
- [ ] Integration test for new endpoints

## Commit Style

Conventional Commits: `feat:`, `fix:`, `chore:`, `docs:`, `test:`, `refactor:`
