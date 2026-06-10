package api

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/codehive/orchestrator/internal/db"
	"github.com/codehive/orchestrator/internal/runner"
	"github.com/codehive/orchestrator/internal/types"
)

type Server struct {
	addr    string
	runner  *runner.Dispatcher
	db      *db.DB
	results sync.Map
	http    *http.Server
}

func NewServer(addr string, d *runner.Dispatcher, database *db.DB) *Server {
	return &Server{addr: addr, runner: d, db: database}
}

func (s *Server) Start() error {
	mux := http.NewServeMux()
	mux.HandleFunc("/api/execute", s.handleExecute)
	mux.HandleFunc("/api/status/", s.handleStatus)
	mux.HandleFunc("/api/workers", s.handleWorkers)
	mux.HandleFunc("/api/health", s.handleHealth)

	s.http = &http.Server{
		Addr:         s.addr,
		Handler:      corsMiddleware(mux),
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 30 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	log.Printf("API server listening on %s", s.addr)
	return s.http.ListenAndServe()
}

func (s *Server) Stop() error {
	if s.http != nil {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		return s.http.Shutdown(ctx)
	}
	return nil
}

func (s *Server) handleExecute(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	var req types.ExecutionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.ID == "" {
		req.ID = fmt.Sprintf("job-%d", time.Now().UnixNano())
	}
	if req.Timeout <= 0 {
		req.Timeout = 30
	}
	req.CreatedAt = time.Now()

	resultCh := make(chan types.ExecutionResult, 1)
	s.runner.Submit(&types.Job{
		Request:   req,
		ResultCh:  resultCh,
		CreatedAt: time.Now(),
	})

	go func() {
		result := <-resultCh
		s.results.Store(req.ID, result)
		if s.db != nil {
			if err := s.db.SaveResult(&result); err != nil {
				log.Printf("failed to save result: %v", err)
			}
		}
	}()

	writeJSON(w, http.StatusAccepted, map[string]string{
		"id":     req.ID,
		"status": string(types.JobStatusQueued),
	})
}

func (s *Server) handleStatus(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	id := strings.TrimPrefix(r.URL.Path, "/api/status/")
	if id == "" {
		writeError(w, http.StatusBadRequest, "missing job id")
		return
	}

	if val, ok := s.results.Load(id); ok {
		writeJSON(w, http.StatusOK, val.(types.ExecutionResult))
		return
	}

	if s.db != nil {
		result, err := s.db.GetResult(id)
		if err == nil {
			writeJSON(w, http.StatusOK, result)
			return
		}
	}

	writeError(w, http.StatusNotFound, "job not found")
}

func (s *Server) handleWorkers(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	writeJSON(w, http.StatusOK, s.runner.GetWorkers())
}

func (s *Server) handleHealth(w http.ResponseWriter, r *http.Request) {
	status := map[string]interface{}{
		"status":  "ok",
		"time":    time.Now().UTC().Format(time.RFC3339),
		"workers": len(s.runner.GetWorkers()),
	}
	if s.db != nil {
		if err := s.db.Ping(); err != nil {
			status["database"] = "unhealthy"
			status["status"] = "degraded"
		} else {
			status["database"] = "healthy"
		}
	}
	writeJSON(w, http.StatusOK, status)
}
