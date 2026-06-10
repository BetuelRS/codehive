package api

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/codehive/orchestrator/internal/runner"
	"github.com/codehive/orchestrator/internal/types"
)

func setupTestServer() *Server {
	d := runner.NewDispatcher(2)
	d.Start()
	s := NewServer(":0", d, nil)
	return s
}

func TestNewServer(t *testing.T) {
	d := runner.NewDispatcher(1)
	s := NewServer(":8080", d, nil)
	if s == nil {
		t.Fatal("expected non-nil server")
	}
	if s.addr != ":8080" {
		t.Errorf("addr = %s, want :8080", s.addr)
	}
}

func TestHealthEndpoint(t *testing.T) {
	s := setupTestServer()
	defer s.runner.Stop()

	req := httptest.NewRequest(http.MethodGet, "/api/health", nil)
	w := httptest.NewRecorder()

	s.handleHealth(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("status = %d, want %d", w.Code, http.StatusOK)
	}

	var body map[string]interface{}
	if err := json.NewDecoder(w.Body).Decode(&body); err != nil {
		t.Fatal("failed to decode response")
	}
	if body["status"] != "ok" {
		t.Errorf("status = %v, want ok", body["status"])
	}
}

func TestExecuteEndpoint(t *testing.T) {
	s := setupTestServer()
	defer s.runner.Stop()

	reqBody := types.ExecutionRequest{
		ID:       "test-exec",
		Language: types.LanguagePython,
		Code:     "print('hi')",
		Timeout:  30,
	}
	body, _ := json.Marshal(reqBody)

	req := httptest.NewRequest(http.MethodPost, "/api/execute", bytes.NewReader(body))
	w := httptest.NewRecorder()

	s.handleExecute(w, req)

	if w.Code != http.StatusAccepted {
		t.Errorf("status = %d, want %d", w.Code, http.StatusAccepted)
	}

	var resp map[string]string
	json.NewDecoder(w.Body).Decode(&resp)
	if resp["status"] != "queued" {
		t.Errorf("status = %s, want queued", resp["status"])
	}
}

func TestExecuteEndpointInvalidMethod(t *testing.T) {
	s := setupTestServer()
	defer s.runner.Stop()

	req := httptest.NewRequest(http.MethodGet, "/api/execute", nil)
	w := httptest.NewRecorder()

	s.handleExecute(w, req)

	if w.Code != http.StatusMethodNotAllowed {
		t.Errorf("status = %d, want %d", w.Code, http.StatusMethodNotAllowed)
	}
}

func TestExecuteEndpointBadBody(t *testing.T) {
	s := setupTestServer()
	defer s.runner.Stop()

	req := httptest.NewRequest(http.MethodPost, "/api/execute", bytes.NewReader([]byte("{bad json")))
	w := httptest.NewRecorder()

	s.handleExecute(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("status = %d, want %d", w.Code, http.StatusBadRequest)
	}
}

func TestStatusEndpointNotFound(t *testing.T) {
	s := setupTestServer()
	defer s.runner.Stop()

	req := httptest.NewRequest(http.MethodGet, "/api/status/nonexistent", nil)
	w := httptest.NewRecorder()

	s.handleStatus(w, req)

	if w.Code != http.StatusNotFound {
		t.Errorf("status = %d, want %d", w.Code, http.StatusNotFound)
	}
}

func TestStatusEndpointMissingID(t *testing.T) {
	s := setupTestServer()
	defer s.runner.Stop()

	req := httptest.NewRequest(http.MethodGet, "/api/status/", nil)
	w := httptest.NewRecorder()

	s.handleStatus(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("status = %d, want %d", w.Code, http.StatusBadRequest)
	}
}

func TestWorkersEndpoint(t *testing.T) {
	s := setupTestServer()
	defer s.runner.Stop()

	req := httptest.NewRequest(http.MethodGet, "/api/workers", nil)
	w := httptest.NewRecorder()

	s.handleWorkers(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("status = %d, want %d", w.Code, http.StatusOK)
	}
}

func TestCORSHeaders(t *testing.T) {
	s := setupTestServer()
	defer s.runner.Stop()

	mux := http.NewServeMux()
	mux.HandleFunc("/api/health", s.handleHealth)
	handler := corsMiddleware(mux)

	req := httptest.NewRequest(http.MethodOptions, "/api/health", nil)
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	if w.Code != http.StatusNoContent {
		t.Errorf("status = %d, want %d", w.Code, http.StatusNoContent)
	}
	if w.Header().Get("Access-Control-Allow-Origin") != "*" {
		t.Error("missing CORS header")
	}
}

func BenchmarkExecuteHandler(b *testing.B) {
	s := setupTestServer()
	defer s.runner.Stop()

	reqBody := types.ExecutionRequest{
		ID:       "bench",
		Language: types.LanguagePython,
		Code:     "print(1)",
		Timeout:  30,
	}
	body, _ := json.Marshal(reqBody)

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		req := httptest.NewRequest(http.MethodPost, "/api/execute", bytes.NewReader(body))
		w := httptest.NewRecorder()
		s.handleExecute(w, req)
	}
}
