# Changelog

## [0.1.0] - 2026-06-10

### Added
- API server (Fastify 5): execute, status, workers, health endpoints
- WebSocket support for real-time execution logs
- Redis-backed job queue with enqueue/dequeue/get/update
- PostgreSQL connection pool with health check
- Orchestrator (Go): HTTP server, worker dispatcher, language executors
- Orchestrator CLI modes: server, worker, run
- Orchestrator PostgreSQL storage + auto-migrations
- Worker (Rust): tokio async, heartbeat + job poll loops
- Worker sandbox: temp dir, source write, compilation, cleanup
- Worker direct execution (subprocess) + Docker execution
- Worker language support: Python, Node, Go, Rust, C++
- Dashboard (Svelte 5): metrics, live feed, code editor, execution history
- Dashboard stores with WebSocket auto-reconnect
- Dashboard components: ExecutionCard, StatusBadge, CodeEditor
- Database schemas: execution_requests, execution_results, workers
- TypeScript types: Job, ExecutionRequest, ExecutionResult, WorkerInfo, HealthStatus
- Go types: Language, JobStatus, ExecutionRequest, ExecutionResult, WorkerStatus, Config
- CORS and WebSocket Fastify plugins
