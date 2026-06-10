package runner

import (
	"testing"
	"time"

	"github.com/codehive/orchestrator/internal/types"
)

func TestNewDispatcher(t *testing.T) {
	d := NewDispatcher(3)
	if d == nil {
		t.Fatal("expected non-nil dispatcher")
	}
	if len(d.workers) != 3 {
		t.Errorf("expected 3 workers, got %d", len(d.workers))
	}
}

func TestDispatcherSubmitAndGetWorkers(t *testing.T) {
	d := NewDispatcher(2)
	d.Start()
	defer d.Stop()

	workers := d.GetWorkers()
	if len(workers) != 2 {
		t.Errorf("expected 2 workers, got %d", len(workers))
	}
	for _, w := range workers {
		if w.ID == "" {
			t.Error("worker ID should not be empty")
		}
	}
}

func TestDispatcherSubmitJob(t *testing.T) {
	d := NewDispatcher(2)
	d.Start()
	defer d.Stop()

	resultCh := make(chan types.ExecutionResult, 1)
	d.Submit(&types.Job{
		Request: types.ExecutionRequest{
			ID:       "test-job",
			Language: types.LanguagePython,
			Code:     "print('hello')",
			Timeout:  5,
			CreatedAt: time.Now(),
		},
		ResultCh: resultCh,
	})

	select {
	case result := <-resultCh:
		if result.ID != "test-job" {
			t.Errorf("expected result ID 'test-job', got '%s'", result.ID)
		}
	case <-time.After(2 * time.Second):
		t.Fatal("timeout waiting for job result")
	}
}

func TestDispatcherStop(t *testing.T) {
	d := NewDispatcher(1)
	d.Start()
	d.Stop()
	d.Stop()
}

func TestGetWorkersConcurrentSafety(t *testing.T) {
	d := NewDispatcher(4)
	d.Start()
	defer d.Stop()

	done := make(chan struct{})
	go func() {
		for i := 0; i < 50; i++ {
			d.GetWorkers()
		}
		close(done)
	}()

	for i := 0; i < 50; i++ {
		d.Submit(&types.Job{
			Request: types.ExecutionRequest{
				ID:       "job",
				Language: types.LanguagePython,
				Code:     "x=1",
				Timeout:  1,
			},
			ResultCh: make(chan types.ExecutionResult, 1),
		})
	}

	<-done
}

func TestWorkerStatusAfterJob(t *testing.T) {
	d := NewDispatcher(1)
	d.Start()
	defer d.Stop()

	resultCh := make(chan types.ExecutionResult, 1)
	d.Submit(&types.Job{
		Request: types.ExecutionRequest{
			ID:       "status-test",
			Language: types.LanguagePython,
			Code:     "x=1",
			Timeout:  1,
		},
		ResultCh: resultCh,
	})

	<-resultCh

	workers := d.GetWorkers()
	if len(workers) > 0 {
		if workers[0].RunningJobs > 0 {
			t.Errorf("expected running jobs 0, got %d", workers[0].RunningJobs)
		}
	}
}

func TestWorkerIDFormat(t *testing.T) {
	d := NewDispatcher(5)
	workers := d.GetWorkers()
	for i, w := range workers {
		if w.ID == "" {
			t.Errorf("worker %d ID should not be empty", i)
		}
	}
}

func TestExecuteCommand(t *testing.T) {
	stdout, stderr, exitCode, err := executeCommand("cmd", []string{"/c", "echo", "hello"}, "", 5)
	if err != nil {
		t.Errorf("unexpected error: %v", err)
	}
	if exitCode != 0 {
		t.Errorf("exit code = %d, want 0", exitCode)
	}
	if stderr != "" {
		t.Errorf("stderr = '%s', want ''", stderr)
	}
	_ = stdout
}

func TestExecuteCommandWithStdin(t *testing.T) {
	py := "python"
	stdout, stderr, exitCode, err := executeCommand(py, []string{"-c", "import sys; print(sys.stdin.read().upper())"}, "hello world", 5)
	if err != nil {
		t.Errorf("unexpected error: %v", err)
	}
	if exitCode != 0 {
		t.Errorf("exit code = %d, want 0", exitCode)
	}
	_ = stdout
	_ = stderr
}

func TestExecuteCommandNonZeroExit(t *testing.T) {
	stdout, stderr, exitCode, err := executeCommand("cmd", []string{"/c", "exit", "42"}, "", 5)
	if err != nil {
		t.Errorf("unexpected error: %v", err)
	}
	if exitCode != 42 {
		t.Errorf("exit code = %d, want 42", exitCode)
	}
	_ = stdout
	_ = stderr
}

func TestExecuteCommandTimeout(t *testing.T) {
	py := "python"
	stdout, stderr, exitCode, err := executeCommand(py, []string{"-c", "import time; time.sleep(10)"}, "", 1)
	if err == nil {
		t.Errorf("expected timeout error")
	}
	if exitCode != -1 {
		t.Errorf("exit code = %d, want -1", exitCode)
	}
	if stderr != "Process killed: timeout exceeded" {
		t.Errorf("stderr = '%s', want timeout message", stderr)
	}
	_ = stdout
}

func TestExecuteCommandNotFound(t *testing.T) {
	stdout, _, exitCode, err := executeCommand("nonexistent_cmd_xyz", []string{}, "", 5)
	if err == nil {
		t.Errorf("expected error for missing command")
	}
	if exitCode != 1 {
		t.Errorf("exit code = %d, want 1", exitCode)
	}
	_ = stdout
}

func TestGetExecutor(t *testing.T) {
	executors := []types.Language{
		types.LanguagePython,
		types.LanguageJavaScript,
		types.LanguageGo,
		types.LanguageRust,
		types.LanguageRuby,
		types.LanguageJava,
	}
	for _, lang := range executors {
		e := GetExecutor(lang)
		if e == nil {
			t.Errorf("GetExecutor(%s) returned nil", lang)
		}
	}
}

func TestGetExecutorDefault(t *testing.T) {
	e := GetExecutor(types.Language("unknown"))
	if e == nil {
		t.Error("GetExecutor(unknown) returned nil")
	}
}

func BenchmarkDispatcherSubmit(b *testing.B) {
	d := NewDispatcher(4)
	d.Start()
	defer d.Stop()

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		ch := make(chan types.ExecutionResult, 1)
		d.Submit(&types.Job{
			Request: types.ExecutionRequest{
				ID:       "bench",
				Language: types.LanguagePython,
				Code:     "print(1)",
				Timeout:  30,
			},
			ResultCh: ch,
		})
		<-ch
	}
}
