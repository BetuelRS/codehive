# Migration Paths

## Express→Fastify (Done)
API migrated from Express to Fastify v5 for perf + native WebSocket.

## JS→Rust (Perf-Critical Paths)
### Current Rust
- Worker sandbox (code execution, subprocess mgmt, Docker orchestration)
- Already handles heartbeat + job polling

### Future Candidates for Rust
| Component | Why | Priority |
|-----------|-----|----------|
| Dispatcher/job router | Schedule + dispatch >1M jobs/min | Medium |
| Result aggregation | Streaming aggregation from N workers | Low |
| WS event relay | Fan-out execution events to dashboard | Low |

### Migration Strategy
1. Extract Go orchestrator's dispatch core as gRPC service
2. Rust worker connects via gRPC (replace HTTP polling)
3. Go orchestrator → Rust once dispatch logic validated

## Go→Rust (Full Unification)
Not recommended until dispatcher proves bottleneck.

## SQLite→PostgreSQL (Done)
Production DB already PostgreSQL via `lib/pq`.

## Svelte 4→5 (Done)
Dashboard uses Svelte 5 runes (`$derived`, `$state`).

## Vite 5→6 (Done)
Dashboard already on Vite 6.x.
