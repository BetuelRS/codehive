package workerapi

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/codehive/orchestrator/internal/runner"
	"github.com/codehive/orchestrator/internal/types"
)

type Server struct {
	addr       string
	dispatcher *runner.Dispatcher
	http       *http.Server
}

func NewServer(addr string, d *runner.Dispatcher) *Server {
	return &Server{addr: addr, dispatcher: d}
}

func (s *Server) Start() error {
	mux := http.NewServeMux()
	mux.HandleFunc("/api/workers", s.handleWorkers)
	mux.HandleFunc("/api/workers/", s.handleWorkerActions)

	s.http = &http.Server{
		Addr:         s.addr,
		Handler:      corsMiddleware(mux),
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 30 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	log.Printf("worker API server listening on %s", s.addr)
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

func (s *Server) handleWorkerActions(w http.ResponseWriter, r *http.Request) {
	parts := strings.Split(strings.TrimPrefix(r.URL.Path, "/api/workers/"), "/")
	if len(parts) < 2 || parts[0] == "" {
		writeError(w, http.StatusBadRequest, "invalid path")
		return
	}

	workerID := parts[0]
	action := parts[1]

	switch action {
	case "heartbeat":
		if r.Method != http.MethodPost {
			writeError(w, http.StatusMethodNotAllowed, "method not allowed")
			return
		}
		s.handleHeartbeat(w, r, workerID)
	case "jobs":
		if len(parts) < 3 {
			writeError(w, http.StatusBadRequest, "missing job action")
			return
		}
		subAction := parts[2]
		switch subAction {
		case "next":
			if r.Method != http.MethodGet {
				writeError(w, http.StatusMethodNotAllowed, "method not allowed")
				return
			}
			s.handleDequeue(w, r, workerID)
		default:
			if len(parts) < 4 || parts[3] != "result" {
				writeError(w, http.StatusBadRequest, "invalid job path")
				return
			}
			if r.Method != http.MethodPost {
				writeError(w, http.StatusMethodNotAllowed, "method not allowed")
				return
			}
			s.handleResult(w, r, workerID, subAction)
		}
	default:
		writeError(w, http.StatusNotFound, "unknown action")
	}
}

func (s *Server) handleDequeue(w http.ResponseWriter, r *http.Request, workerID string) {
	job := s.dispatcher.Dequeue()
	if job == nil {
		writeJSON(w, http.StatusNoContent, nil)
		return
	}
	writeJSON(w, http.StatusOK, job)
}

func (s *Server) handleResult(w http.ResponseWriter, r *http.Request, workerID, jobID string) {
	var result types.ExecutionResult
	if err := json.NewDecoder(r.Body).Decode(&result); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	result.ID = jobID
	result.UpdatedAt = time.Now()
	s.dispatcher.StoreResult(jobID, result)
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (s *Server) handleHeartbeat(w http.ResponseWriter, r *http.Request, workerID string) {
	var hb types.Heartbeat
	if err := json.NewDecoder(r.Body).Decode(&hb); err != nil {
		writeError(w, http.StatusBadRequest, "invalid heartbeat")
		return
	}
	hb.WorkerID = workerID
	hb.Timestamp = time.Now()
	s.dispatcher.RecordHeartbeat(workerID)
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (s *Server) handleWorkers(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	writeJSON(w, http.StatusOK, s.dispatcher.GetWorkers())
}

func writeJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if data != nil {
		json.NewEncoder(w).Encode(data)
	}
}

func writeError(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}

func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusOK)
			return
		}
		next.ServeHTTP(w, r)
	})
}
