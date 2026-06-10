package types

import (
	"testing"
	"time"
)

func TestJobStatusValues(t *testing.T) {
	tests := []struct {
		status JobStatus
		want   string
	}{
		{JobStatusQueued, "queued"},
		{JobStatusRunning, "running"},
		{JobStatusCompleted, "completed"},
		{JobStatusFailed, "failed"},
	}
	for _, tt := range tests {
		if string(tt.status) != tt.want {
			t.Errorf("JobStatus %s != %s", tt.status, tt.want)
		}
	}
}

func TestLanguageValues(t *testing.T) {
	tests := []struct {
		lang Language
		want string
	}{
		{LanguagePython, "python"},
		{LanguageJavaScript, "javascript"},
		{LanguageGo, "go"},
		{LanguageRust, "rust"},
		{LanguageRuby, "ruby"},
		{LanguageJava, "java"},
	}
	for _, tt := range tests {
		if string(tt.lang) != tt.want {
			t.Errorf("Language %s != %s", tt.lang, tt.want)
		}
	}
}

func TestExecutionRequestDefaults(t *testing.T) {
	req := ExecutionRequest{
		ID:       "test-1",
		Language: LanguagePython,
		Code:     "print(1)",
		CreatedAt: time.Now(),
	}
	if req.Timeout != 0 {
		t.Errorf("expected 0 timeout, got %d", req.Timeout)
	}
}

func TestExecutionResultStatus(t *testing.T) {
	r := ExecutionResult{
		ID:     "r1",
		Status: JobStatusCompleted,
	}
	if r.Status != JobStatusCompleted {
		t.Errorf("expected completed, got %s", r.Status)
	}
	r.Status = JobStatusFailed
	if r.Status != JobStatusFailed {
		t.Errorf("expected failed, got %s", r.Status)
	}
}

func TestWorkerStatusFields(t *testing.T) {
	ws := WorkerStatus{
		ID:          "w1",
		Load:        0.5,
		RunningJobs: 3,
		MaxJobs:     5,
		Status:      "busy",
	}
	if ws.Load != 0.5 {
		t.Errorf("Load = %f, want 0.5", ws.Load)
	}
	if ws.RunningJobs != 3 {
		t.Errorf("RunningJobs = %d, want 3", ws.RunningJobs)
	}
	if ws.Status != "busy" {
		t.Errorf("Status = %s, want busy", ws.Status)
	}
}

func TestJobChannel(t *testing.T) {
	ch := make(chan ExecutionResult, 1)
	job := &Job{
		Request: ExecutionRequest{
			ID:       "job-1",
			Language: LanguagePython,
			Code:     "print(1)",
		},
		ResultCh: ch,
		Priority: 1,
	}
	job.ResultCh <- ExecutionResult{ID: "job-1", Status: JobStatusCompleted}
	result := <-ch
	if result.ID != "job-1" {
		t.Errorf("result ID = %s, want job-1", result.ID)
	}
}

func TestConfigDefaults(t *testing.T) {
	cfg := Config{
		Port:       8080,
		MaxWorkers: 4,
	}
	if cfg.Port != 8080 {
		t.Errorf("Port = %d, want 8080", cfg.Port)
	}
	if cfg.MaxWorkers != 4 {
		t.Errorf("MaxWorkers = %d, want 4", cfg.MaxWorkers)
	}
}
