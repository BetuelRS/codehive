package db

import (
	"testing"

	"github.com/codehive/orchestrator/internal/types"
)

func TestNewWithEmptyURL(t *testing.T) {
	// sql.Open with empty URL won't error
	db, err := New("postgres://localhost:5432/test?sslmode=disable")
	if err == nil && db != nil {
		db.Close()
	}
}

func TestPingNoConn(t *testing.T) {
	db := &DB{conn: nil}
	err := db.Ping()
	if err == nil {
		t.Error("expected error for nil connection")
	}
}

func TestCloseNoConn(t *testing.T) {
	db := &DB{conn: nil}
	err := db.Close()
	if err != nil {
		t.Errorf("unexpected error: %v", err)
	}
}

func TestSaveResultNoConn(t *testing.T) {
	db := &DB{conn: nil}
	err := db.SaveResult(&types.ExecutionResult{ID: "test"})
	if err == nil {
		t.Error("expected error for nil connection")
	}
}

func TestGetResultNoConn(t *testing.T) {
	db := &DB{conn: nil}
	_, err := db.GetResult("test")
	if err == nil {
		t.Error("expected error for nil connection")
	}
}

func TestSaveRequestNoConn(t *testing.T) {
	db := &DB{conn: nil}
	err := db.SaveRequest(&types.ExecutionRequest{ID: "test"})
	if err == nil {
		t.Error("expected error for nil connection")
	}
}

func TestListWorkersNoConn(t *testing.T) {
	db := &DB{conn: nil}
	_, err := db.ListWorkers()
	if err == nil {
		t.Error("expected error for nil connection")
	}
}

func TestUpsertWorkerNoConn(t *testing.T) {
	db := &DB{conn: nil}
	err := db.UpsertWorker(&types.WorkerStatus{ID: "w1"})
	if err == nil {
		t.Error("expected error for nil connection")
	}
}

func TestRunMigrationsNoConn(t *testing.T) {
	db := &DB{conn: nil}
	err := db.RunMigrations()
	if err == nil {
		t.Error("expected error for nil connection")
	}
}
