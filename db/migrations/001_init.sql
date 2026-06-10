-- 001_init.sql: Core schema for CodeHive

BEGIN;

-- Executions: one per code submission
CREATE TABLE IF NOT EXISTS executions (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    language    TEXT NOT NULL CHECK (language IN ('python','node','go','rust','cpp')),
    code        TEXT NOT NULL,
    stdin       TEXT DEFAULT '',
    status      TEXT NOT NULL DEFAULT 'queued'
                CHECK (status IN ('queued','running','completed','failed')),
    result      JSONB,
    exit_code   INTEGER,
    duration_ms BIGINT DEFAULT 0,
    error       TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    started_at  TIMESTAMPTZ,
    finished_at TIMESTAMPTZ,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_executions_status ON executions(status);
CREATE INDEX idx_executions_created_at ON executions(created_at DESC);
CREATE INDEX idx_executions_language ON executions(language);

-- Workers: registered execution nodes
CREATE TABLE IF NOT EXISTS workers (
    id              TEXT PRIMARY KEY,
    hostname        TEXT NOT NULL DEFAULT '',
    status          TEXT NOT NULL DEFAULT 'idle'
                    CHECK (status IN ('idle','busy','offline')),
    load            REAL NOT NULL DEFAULT 0.0,
    max_jobs        INTEGER NOT NULL DEFAULT 5,
    uptime_seconds  BIGINT NOT NULL DEFAULT 0,
    last_heartbeat  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    version         TEXT NOT NULL DEFAULT '',
    docker_available BOOLEAN NOT NULL DEFAULT FALSE,
    languages       TEXT[] NOT NULL DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_workers_status ON workers(status);
CREATE INDEX idx_workers_last_heartbeat ON workers(last_heartbeat);

-- Jobs: assignments of executions to workers
CREATE TABLE IF NOT EXISTS jobs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    execution_id    UUID NOT NULL REFERENCES executions(id) ON DELETE CASCADE,
    worker_id       TEXT NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
    status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','running','completed','failed')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    started_at      TIMESTAMPTZ,
    finished_at     TIMESTAMPTZ,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_jobs_worker_id ON jobs(worker_id);
CREATE INDEX idx_jobs_execution_id ON jobs(execution_id);
CREATE INDEX idx_jobs_status ON jobs(status);
CREATE UNIQUE INDEX idx_jobs_active ON jobs(worker_id) WHERE status IN ('pending','running');

COMMIT;
