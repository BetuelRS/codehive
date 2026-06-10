// Package types defines shared data structures for orchestrator.
package types

import "time"

// Language enumerates supported code execution languages.
type Language string

const (
	LanguagePython   Language = "python"
	LanguageJavaScript Language = "javascript"
	LanguageGo       Language = "go"
	LanguageRust     Language = "rust"
	LanguageRuby     Language = "ruby"
	LanguageJava     Language = "java"
)

// JobStatus tracks execution lifecycle stage.
type JobStatus string

const (
	JobStatusQueued   JobStatus = "queued"
	JobStatusRunning  JobStatus = "running"
	JobStatusCompleted JobStatus = "completed"
	JobStatusFailed   JobStatus = "failed"
)

// ExecutionRequest describes code execution parameters.
type ExecutionRequest struct {
	ID          string    `json:"id"`
	Language    Language  `json:"language"`
	Code        string    `json:"code"`
	Stdin       string    `json:"stdin,omitempty"`
	Timeout     int       `json:"timeout"`
	MemoryLimit int       `json:"memory_limit"`
	CreatedAt   time.Time `json:"created_at"`
}

// ExecutionResult holds output and metadata from code execution.
type ExecutionResult struct {
	ID        string        `json:"id"`
	Stdout    string        `json:"stdout"`
	Stderr    string        `json:"stderr"`
	ExitCode  int           `json:"exit_code"`
	Duration  time.Duration `json:"duration"`
	Error     string        `json:"error,omitempty"`
	Status    JobStatus     `json:"status"`
	CreatedAt time.Time     `json:"created_at"`
	UpdatedAt time.Time     `json:"updated_at"`
}

// WorkerStatus reports worker health and load metrics.
type WorkerStatus struct {
	ID          string    `json:"id"`
	Load        float64   `json:"load"`
	RunningJobs int       `json:"running_jobs"`
	MaxJobs     int       `json:"max_jobs"`
	Uptime      string    `json:"uptime"`
	LastSeen    time.Time `json:"last_seen"`
	Status      string    `json:"status"`
}

// Job wraps execution request with dispatch metadata.
type Job struct {
	Request   ExecutionRequest
	ResultCh  chan<- ExecutionResult
	CreatedAt time.Time
	Priority  int
}

// Heartbeat represents worker liveness signal.
type Heartbeat struct {
	WorkerID  string    `json:"worker_id"`
	Timestamp time.Time `json:"timestamp"`
	Status    string    `json:"status"`
}

// Config defines orchestrator server settings.
type Config struct {
	Port          int    `json:"port"`
	DatabaseURL   string `json:"database_url"`
	MaxWorkers    int    `json:"max_workers"`
	DefaultTimeout int   `json:"default_timeout"`
	LogLevel      string `json:"log_level"`
}
