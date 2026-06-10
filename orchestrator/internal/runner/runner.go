package runner

import (
	"bytes"
	"context"
	"fmt"
	"log"
	"os/exec"
	"sync"
	"time"

	"github.com/codehive/orchestrator/internal/types"
)

type Worker struct {
	ID          string
	RunningJobs int
	MaxJobs     int
	StartTime   time.Time
	Status      string
	mu          sync.Mutex
}

type Dispatcher struct {
	jobQueue   chan *types.Job
	workers    []*Worker
	mu         sync.RWMutex
	maxWorkers int
	stopCh     chan struct{}
	stopOnce   sync.Once
	wg         sync.WaitGroup
}

func NewDispatcher(maxWorkers int) *Dispatcher {
	d := &Dispatcher{
		jobQueue:   make(chan *types.Job, 1000),
		workers:    make([]*Worker, 0, maxWorkers),
		maxWorkers: maxWorkers,
		stopCh:     make(chan struct{}),
	}
	for i := 0; i < maxWorkers; i++ {
		d.workers = append(d.workers, &Worker{
			ID:        fmt.Sprintf("worker-%d", i+1),
			MaxJobs:   5,
			StartTime: time.Now(),
			Status:    "idle",
		})
	}
	return d
}

func (d *Dispatcher) Start() {
	for i := 0; i < d.maxWorkers; i++ {
		d.wg.Add(1)
		go d.workerLoop(d.workers[i])
	}
	log.Printf("dispatcher started with %d workers", d.maxWorkers)
}

func (d *Dispatcher) Stop() {
	d.stopOnce.Do(func() {
		close(d.stopCh)
		d.wg.Wait()
		log.Println("dispatcher stopped")
	})
}

func (d *Dispatcher) Submit(job *types.Job) {
	d.jobQueue <- job
}

func (d *Dispatcher) workerLoop(w *Worker) {
	defer d.wg.Done()
	for {
		select {
		case <-d.stopCh:
			return
		case job := <-d.jobQueue:
			w.mu.Lock()
			w.RunningJobs++
			w.Status = "running"
			w.mu.Unlock()

			d.executeJob(job)

			w.mu.Lock()
			w.RunningJobs--
			if w.RunningJobs == 0 {
				w.Status = "idle"
			}
			w.mu.Unlock()
		}
	}
}

func (d *Dispatcher) executeJob(job *types.Job) {
	start := time.Now()
	log.Printf("executing job %s [%s]", job.Request.ID, job.Request.Language)

	result := types.ExecutionResult{
		ID:        job.Request.ID,
		Status:    types.JobStatusRunning,
		CreatedAt: job.Request.CreatedAt,
	}

	executor := GetExecutor(job.Request.Language)
	stdout, stderr, exitCode, execErr := executor.Execute(context.Background(), job.Request)

	result.Duration = time.Since(start)
	result.Stdout = stdout
	result.Stderr = stderr
	result.ExitCode = exitCode
	if execErr != nil {
		result.Status = types.JobStatusFailed
		result.Error = execErr.Error()
	} else {
		result.Status = types.JobStatusCompleted
	}
	result.UpdatedAt = time.Now()
	job.ResultCh <- result
}

func executeCommand(cmd string, args []string, input string, timeoutSec int) (string, string, int, error) {
	ctx, cancel := context.WithTimeout(context.Background(), time.Duration(timeoutSec)*time.Second)
	defer cancel()

	c := exec.CommandContext(ctx, cmd, args...)
	var stdout, stderr bytes.Buffer
	c.Stdout = &stdout
	c.Stderr = &stderr
	if input != "" {
		c.Stdin = bytes.NewBufferString(input)
	}

	err := c.Run()
	stdoutStr := stdout.String()
	stderrStr := stderr.String()
	exitCode := 0

	if err != nil {
		if ctx.Err() == context.DeadlineExceeded {
			return stdoutStr, "Process killed: timeout exceeded", -1, fmt.Errorf("execution timeout")
		}
		if exitErr, ok := err.(*exec.ExitError); ok {
			exitCode = exitErr.ExitCode()
		} else {
			return stdoutStr, stderrStr, 1, err
		}
	}
	return stdoutStr, stderrStr, exitCode, nil
}

func (d *Dispatcher) GetWorkers() []types.WorkerStatus {
	d.mu.RLock()
	defer d.mu.RUnlock()

	statuses := make([]types.WorkerStatus, 0, len(d.workers))
	for _, w := range d.workers {
		w.mu.Lock()
		load := 0.0
		if w.MaxJobs > 0 {
			load = float64(w.RunningJobs) / float64(w.MaxJobs)
		}
		statuses = append(statuses, types.WorkerStatus{
			ID:          w.ID,
			Load:        load,
			RunningJobs: w.RunningJobs,
			MaxJobs:     w.MaxJobs,
			Uptime:      time.Since(w.StartTime).String(),
			LastSeen:    time.Now(),
			Status:      w.Status,
		})
		w.mu.Unlock()
	}
	return statuses
}
