# CodeHive Dev Prompts

Quick commands for common tasks.

## Workspace

```
# Start API dev server
cd api && npm run dev

# Start dashboard
cd dashboard && npm run dev

# Check types
cd api && npm run typecheck

# Run API tests
cd api && npm test
```

## Rust Worker

```
# Build
cd worker && cargo build

# Run
cd worker && cargo run

# Check
cd worker && cargo check

# Test
cd worker && cargo test
```

## Go Orchestrator

```
# Build
cd orchestrator && go build -o bin/ ./cmd/main.go

# Run server
cd orchestrator && go run ./cmd/main.go server --port 8080

# Check
cd orchestrator && go vet ./...
```

## Docker

```
# Start all services
docker compose up -d

# Build single service
docker compose build api

# View logs
docker compose logs -f api

# Clean
docker compose down -v
```

## DB

```
# Apply migration
psql -U codehive -d codehive -f db/migrations/001_init.sql

# Quick console
psql -U codehive -d codehive

# Reset
dropdb codehive && createdb codehive && psql -U codehive -d codehive -f db/migrations/001_init.sql
```
