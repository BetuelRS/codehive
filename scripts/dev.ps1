<#
.SYNOPSIS
  Start CodeHive development environment (infra + all components in dev mode).
.DESCRIPTION
  Starts PostgreSQL + Redis via Docker, then starts API, Orchestrator,
  Dashboard, and Worker in dev/hot-reload mode.
.EXAMPLE
  .\scripts\dev.ps1
  .\scripts\dev.ps1 -SkipWorker
#>

param(
  [switch]$SkipWorker,
  [switch]$SkipOrchestrator
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot

function Step($msg) { Write-Host "==> $msg" -ForegroundColor Cyan }
function Die($msg) { Write-Host "FAIL: $msg" -ForegroundColor Red; exit 1 }

# --- Validate ---
$tools = @("node", "npm", "docker")
foreach ($t in $tools) {
  try { Get-Command $t -ErrorAction Stop | Out-Null }
  catch { Die "$t not found" }
}

# --- Start infra ---
Step "Start PostgreSQL + Redis..."
Push-Location "$root/docker"
try {
  docker compose up -d postgres redis
  if ($LASTEXITCODE -ne 0) { Die "Infra start failed" }

  # Wait for PG
  Write-Host "  Wait for PostgreSQL..."
  do {
    $ready = docker compose exec postgres pg_isready -U codehive 2>$null
    Start-Sleep -Seconds 1
  } while ($LASTEXITCODE -ne 0)
  Write-Host "  PostgreSQL ready"
} finally { Pop-Location }

# --- Start API ---
Step "Start API (dev mode)..."
$apiJob = Start-Job -ScriptBlock {
  param($root)
  Push-Location "$root/api"
  npm run dev
} -ArgumentList $root

# --- Start Orchestrator ---
if (-not $SkipOrchestrator) {
  Step "Start Orchestrator (dev mode)..."
  $orchJob = Start-Job -ScriptBlock {
    param($root)
    Push-Location "$root/orchestrator"
    go run ./cmd/main.go server --port 8080
  } -ArgumentList $root
}

# --- Start Dashboard ---
Step "Start Dashboard (dev mode)..."
$dashJob = Start-Job -ScriptBlock {
  param($root)
  Push-Location "$root/dashboard"
  npm run dev
} -ArgumentList $root

# --- Start Worker ---
if (-not $SkipWorker) {
  Step "Start Worker (dev mode)..."
  $wrkJob = Start-Job -ScriptBlock {
    param($root)
    Push-Location "$root/worker"
    cargo run --release -- worker --orchestrator-url http://localhost:8080 --worker-id dev-1
  } -ArgumentList $root
}

Write-Host "`nAll components starting in background jobs." -ForegroundColor Green
Write-Host "  Dashboard: http://localhost:5173" -ForegroundColor Cyan
Write-Host "  API:       http://localhost:3001" -ForegroundColor Cyan
Write-Host "  Orch:      http://localhost:8080" -ForegroundColor Cyan
Write-Host "`nMonitor with: Get-Job | Receive-Job -Keep" -ForegroundColor Yellow
Write-Host "Stop with :   Get-Job | Stop-Job" -ForegroundColor Yellow
