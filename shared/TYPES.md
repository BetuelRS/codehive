# CodeHive Shared Types Reference

Canonical type definitions. Each language owns its impl; this doc is source of truth.

## ExecutionRequest
| Field        | Type            | Notes                    |
|-------------|----------------|--------------------------|
| id          | string         | UUID                     |
| language    | Language enum  | python/node/go/rust/cpp  |
| code        | string         | Source code              |
| stdin       | string?        |                          |
| timeout_ms  | u64            | Default 30000            |
| memory_mb   | u64?           | Max mem, default 512     |
| env_vars    | map<string,string>? |                    |

## ExecutionResult
| Field         | Type     | Notes                |
|--------------|----------|----------------------|
| id           | string   |                      |
| success      | bool     | exit 0 + no error    |
| stdout       | string   |                      |
| stderr       | string   |                      |
| exit_code    | i32?     |                      |
| duration_ms  | u64      |                      |
| memory_used_mb| f64?    |                      |
| error        | string?  |                      |
| timed_out    | bool     |                      |

## WorkerStatus
| Field           | Type     | Notes             |
|----------------|----------|-------------------|
| worker_id      | string   | UUID              |
| hostname       | string   |                   |
| version        | string   | Semver            |
| uptime_seconds | u64      |                   |
| active_jobs    | u32      |                   |
| completed_jobs | u64      |                   |
| failed_jobs    | u64      |                   |
| avg_duration_ms| f64      |                   |
| docker_available| bool     |                   |
| languages      | string[] | Supported langs   |

## Language Enum
python, node, go, rust, cpp

## JobStatus Enum
queued, running, completed, failed

## Schema Notes
- All timestamps: ISO 8601 UTC
- All durations: milliseconds u64
- Exit codes: null if process killed/timed out
