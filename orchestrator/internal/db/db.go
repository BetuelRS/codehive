// Package db provides PostgreSQL storage for execution results and workers.
package db

import (
	"database/sql"
	"fmt"
	"log"
	"time"

	_ "github.com/lib/pq"

	"github.com/codehive/orchestrator/internal/types"
)

// DB wraps PostgreSQL connection pool.
type DB struct {
	conn *sql.DB
}

// New opens PostgreSQL connection with pool settings.
func New(databaseURL string) (*DB, error) {
	conn, err := sql.Open("postgres", databaseURL)
	if err != nil {
		return nil, fmt.Errorf("failed to open database: %w", err)
	}

	conn.SetMaxOpenConns(25)
	conn.SetMaxIdleConns(5)
	conn.SetConnMaxLifetime(5 * time.Minute)

	if err := conn.Ping(); err != nil {
		log.Printf("warning: database ping failed: %v", err)
	}

	return &DB{conn: conn}, nil
}

// Ping checks database connectivity.
func (db *DB) Ping() error {
	if db.conn == nil {
		return fmt.Errorf("database not connected")
	}
	return db.conn.Ping()
}

// Close closes database connection.
func (db *DB) Close() error {
	if db.conn != nil {
		return db.conn.Close()
	}
	return nil
}

// SaveResult inserts or updates execution result row.
func (db *DB) SaveResult(result *types.ExecutionResult) error {
	if db.conn == nil {
		return fmt.Errorf("database not connected")
	}

	query := `
		INSERT INTO execution_results (id, stdout, stderr, exit_code, duration, error, status, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		ON CONFLICT (id) DO UPDATE SET
			stdout = EXCLUDED.stdout,
			stderr = EXCLUDED.stderr,
			exit_code = EXCLUDED.exit_code,
			duration = EXCLUDED.duration,
			error = EXCLUDED.error,
			status = EXCLUDED.status,
			updated_at = EXCLUDED.updated_at`

	_, err := db.conn.Exec(query,
		result.ID,
		result.Stdout,
		result.Stderr,
		result.ExitCode,
		result.Duration.String(),
		result.Error,
		string(result.Status),
		result.CreatedAt,
		result.UpdatedAt,
	)
	if err != nil {
		return fmt.Errorf("failed to save result: %w", err)
	}

	return nil
}

// GetResult retrieves execution result by job ID.
func (db *DB) GetResult(id string) (*types.ExecutionResult, error) {
	if db.conn == nil {
		return nil, fmt.Errorf("database not connected")
	}

	query := `SELECT id, stdout, stderr, exit_code, duration, error, status, created_at, updated_at
		FROM execution_results WHERE id = $1`

	var result types.ExecutionResult
	var durationStr string
	var statusStr string

	err := db.conn.QueryRow(query, id).Scan(
		&result.ID,
		&result.Stdout,
		&result.Stderr,
		&result.ExitCode,
		&durationStr,
		&result.Error,
		&statusStr,
		&result.CreatedAt,
		&result.UpdatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("result not found")
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get result: %w", err)
	}

	result.Duration, _ = time.ParseDuration(durationStr)
	result.Status = types.JobStatus(statusStr)

	return &result, nil
}

// SaveRequest inserts execution request record.
func (db *DB) SaveRequest(req *types.ExecutionRequest) error {
	if db.conn == nil {
		return fmt.Errorf("database not connected")
	}

	query := `INSERT INTO execution_requests (id, language, code, stdin, timeout, memory_limit, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7)`

	_, err := db.conn.Exec(query,
		req.ID,
		string(req.Language),
		req.Code,
		req.Stdin,
		req.Timeout,
		req.MemoryLimit,
		req.CreatedAt,
	)
	if err != nil {
		return fmt.Errorf("failed to save request: %w", err)
	}

	return nil
}

// ListWorkers returns all worker status rows.
func (db *DB) ListWorkers() ([]types.WorkerStatus, error) {
	if db.conn == nil {
		return nil, fmt.Errorf("database not connected")
	}

	query := `SELECT id, load, running_jobs, max_jobs, uptime, last_seen, status FROM workers`
	rows, err := db.conn.Query(query)
	if err != nil {
		return nil, fmt.Errorf("failed to list workers: %w", err)
	}
	defer rows.Close()

	var workers []types.WorkerStatus
	for rows.Next() {
		var w types.WorkerStatus
		if err := rows.Scan(&w.ID, &w.Load, &w.RunningJobs, &w.MaxJobs, &w.Uptime, &w.LastSeen, &w.Status); err != nil {
			return nil, fmt.Errorf("failed to scan worker: %w", err)
		}
		workers = append(workers, w)
	}

	return workers, rows.Err()
}

// UpsertWorker creates or updates worker status row.
func (db *DB) UpsertWorker(w *types.WorkerStatus) error {
	if db.conn == nil {
		return fmt.Errorf("database not connected")
	}

	query := `INSERT INTO workers (id, load, running_jobs, max_jobs, uptime, last_seen, status)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		ON CONFLICT (id) DO UPDATE SET
			load = EXCLUDED.load,
			running_jobs = EXCLUDED.running_jobs,
			max_jobs = EXCLUDED.max_jobs,
			uptime = EXCLUDED.uptime,
			last_seen = EXCLUDED.last_seen,
			status = EXCLUDED.status`

	_, err := db.conn.Exec(query,
		w.ID, w.Load, w.RunningJobs, w.MaxJobs, w.Uptime, w.LastSeen, w.Status,
	)
	if err != nil {
		return fmt.Errorf("failed to upsert worker: %w", err)
	}

	return nil
}

// RunMigrations creates required tables if they don't exist.
func (db *DB) RunMigrations() error {
	if db.conn == nil {
		return fmt.Errorf("database not connected")
	}

	migrations := []string{
		`CREATE TABLE IF NOT EXISTS execution_requests (
			id TEXT PRIMARY KEY,
			language TEXT NOT NULL,
			code TEXT NOT NULL,
			stdin TEXT DEFAULT '',
			timeout INTEGER DEFAULT 30,
			memory_limit INTEGER DEFAULT 256,
			created_at TIMESTAMP DEFAULT NOW()
		)`,
		`CREATE TABLE IF NOT EXISTS execution_results (
			id TEXT PRIMARY KEY,
			stdout TEXT DEFAULT '',
			stderr TEXT DEFAULT '',
			exit_code INTEGER DEFAULT 0,
			duration TEXT DEFAULT '',
			error TEXT DEFAULT '',
			status TEXT DEFAULT 'queued',
			created_at TIMESTAMP DEFAULT NOW(),
			updated_at TIMESTAMP DEFAULT NOW()
		)`,
		`CREATE TABLE IF NOT EXISTS workers (
			id TEXT PRIMARY KEY,
			load FLOAT DEFAULT 0,
			running_jobs INTEGER DEFAULT 0,
			max_jobs INTEGER DEFAULT 5,
			uptime TEXT DEFAULT '',
			last_seen TIMESTAMP DEFAULT NOW(),
			status TEXT DEFAULT 'idle'
		)`,
	}

	for _, m := range migrations {
		if _, err := db.conn.Exec(m); err != nil {
			return fmt.Errorf("migration failed: %w", err)
		}
	}

	log.Println("database migrations completed")
	return nil
}
