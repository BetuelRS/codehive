// Package main is orchestrator entry point — server, worker, or CLI run modes.
package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"os"
	"os/signal"
	"syscall"

	"github.com/codehive/orchestrator/internal/api"
	"github.com/codehive/orchestrator/internal/db"
	"github.com/codehive/orchestrator/internal/runner"
	"github.com/codehive/orchestrator/internal/types"
)

// main parses first arg as command and dispatches.
func main() {
	if len(os.Args) < 2 {
		fmt.Println("Usage: orchestrator <command>")
		fmt.Println("Commands:")
		fmt.Println("  server    Start HTTP API server")
		fmt.Println("  worker    Start worker node")
		fmt.Println("  run       Execute single code snippet")
		os.Exit(1)
	}

	cmd := os.Args[1]

	switch cmd {
	case "server":
		runServer()
	case "worker":
		runWorker()
	case "run":
		runExecute()
	default:
		log.Fatalf("unknown command: %s", cmd)
	}
}

// runServer starts HTTP API server with configurable port, DB, workers.
func runServer() {
	fs := flag.NewFlagSet("server", flag.ExitOnError)
	port := fs.Int("port", 8080, "HTTP server port")
	dbURL := fs.String("db", "", "PostgreSQL connection URL")
	maxWorkers := fs.Int("workers", 4, "max worker count")
	configPath := fs.String("config", "", "path to config file")
	fs.Parse(os.Args[2:])

	cfg := types.Config{
		Port:           *port,
		DatabaseURL:    *dbURL,
		MaxWorkers:     *maxWorkers,
		DefaultTimeout: 30,
		LogLevel:       "info",
	}

	if *configPath != "" {
		data, err := os.ReadFile(*configPath)
		if err != nil {
			log.Fatalf("failed to read config: %v", err)
		}
		if err := json.Unmarshal(data, &cfg); err != nil {
			log.Fatalf("failed to parse config: %v", err)
		}
	}

	var database *db.DB
	if cfg.DatabaseURL != "" {
		var err error
		database, err = db.New(cfg.DatabaseURL)
		if err != nil {
			log.Printf("warning: database connection failed: %v", err)
		} else {
			defer database.Close()
			if err := database.RunMigrations(); err != nil {
				log.Printf("warning: migrations failed: %v", err)
			}
		}
	}

	dispatcher := runner.NewDispatcher(cfg.MaxWorkers)
	dispatcher.Start()
	defer dispatcher.Stop()

	addr := fmt.Sprintf(":%d", cfg.Port)
	srv := api.NewServer(addr, dispatcher, database)

	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)

	go func() {
		<-sigCh
		log.Println("shutting down...")
		srv.Stop()
	}()

	if err := srv.Start(); err != nil {
		log.Printf("server stopped: %v", err)
	}
}

// runWorker starts worker node that connects to orchestrator server.
func runWorker() {
	fs := flag.NewFlagSet("worker", flag.ExitOnError)
	serverAddr := fs.String("server", "http://localhost:8080", "orchestrator server address")
	maxJobs := fs.Int("max-jobs", 5, "max concurrent jobs")
	fs.Parse(os.Args[2:])

	log.Printf("worker starting - server: %s, max jobs: %d", *serverAddr, *maxJobs)

	dispatcher := runner.NewDispatcher(1)
	dispatcher.Start()
	defer dispatcher.Stop()

	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)
	<-sigCh
	log.Println("worker shutting down...")
}

// runExecute runs single code snippet from CLI and prints result.
func runExecute() {
	fs := flag.NewFlagSet("run", flag.ExitOnError)
	language := fs.String("lang", "python", "language (python/javascript/go/rust/ruby/java)")
	code := fs.String("code", "", "code to execute")
	file := fs.String("file", "", "path to code file")
	stdin := fs.String("stdin", "", "stdin input")
	timeout := fs.Int("timeout", 30, "timeout in seconds")
	fs.Parse(os.Args[2:])

	if *file != "" {
		data, err := os.ReadFile(*file)
		if err != nil {
			log.Fatalf("failed to read file: %v", err)
		}
		*code = string(data)
	}

	if *code == "" {
		log.Fatal("code or file flag required")
	}

	req := types.ExecutionRequest{
		ID:       fmt.Sprintf("cli-%d", os.Getpid()),
		Language: types.Language(*language),
		Code:     *code,
		Stdin:    *stdin,
		Timeout:  *timeout,
	}

	resultCh := make(chan types.ExecutionResult, 1)
	dispatcher := runner.NewDispatcher(1)
	dispatcher.Start()

	dispatcher.Submit(&types.Job{
		Request:  req,
		ResultCh: resultCh,
	})

	result := <-resultCh
	dispatcher.Stop()

	fmt.Printf("Exit Code: %d\n", result.ExitCode)
	fmt.Printf("Duration: %s\n", result.Duration)
	if result.Stdout != "" {
		fmt.Printf("Stdout:\n%s\n", result.Stdout)
	}
	if result.Stderr != "" {
		fmt.Printf("Stderr:\n%s\n", result.Stderr)
	}
	if result.Error != "" {
		fmt.Printf("Error: %s\n", result.Error)
	}

	os.Exit(result.ExitCode)
}
