<#
.SYNOPSIS
  Build all CodeHive components and deploy via Docker Compose.
.DESCRIPTION
  Validates build tools, builds each component, then runs docker compose up.
  Use -SkipBuild to skip build step (use pre-built images).
  Use -Profile to include optional services (e.g. worker).
.EXAMPLE
  .\scripts\deploy.ps1
  .\scripts\deploy.ps1 -SkipBuild
  .\scripts\deploy.ps1 -Profile worker
#>

param(
  [switch]$SkipBuild,
  [string]$Profile = ""
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot

function Step($msg) { Write-Host "==> $msg" -ForegroundColor Cyan }
function Die($msg) { Write-Host "FAIL: $msg" -ForegroundColor Red; exit 1 }

# --- Validate tools ---
Step "Check toolchain..."

$tools = @(
  @{ Name = "node"; Cmd = "node --version" }
  @{ Name = "npm"; Cmd = "npm --version" }
  @{ Name = "docker compose"; Cmd = "docker compose version" }
  @{ Name = "go"; Cmd = "go version" }
)

foreach ($t in $tools) {
  try { Invoke-Expression $t.Cmd | Out-Null }
  catch { Die "$($t.Name) not found. Install it first." }
}

if (-not $SkipBuild) {

  # --- Build API ---
  Step "Build API..."
  Push-Location "$root/api"
  try {
    npm ci --legacy-peer-deps
    npm run build
    if ($LASTEXITCODE -ne 0) { Die "API build failed" }
  } finally { Pop-Location }

  # --- Build Dashboard ---
  Step "Build Dashboard..."
  Push-Location "$root/dashboard"
  try {
    npm ci --legacy-peer-deps
    npm run build
    if ($LASTEXITCODE -ne 0) { Die "Dashboard build failed" }
  } finally { Pop-Location }

  # --- Build Orchestrator ---
  Step "Build Orchestrator..."
  Push-Location "$root/orchestrator"
  try {
    go build -o bin/orchestrator ./cmd/main.go
    if ($LASTEXITCODE -ne 0) { Die "Orchestrator build failed" }
  } finally { Pop-Location }

  # --- Build Worker ---
  if (Get-Command "cargo" -ErrorAction SilentlyContinue) {
    Step "Build Worker..."
    Push-Location "$root/worker"
    try {
      cargo build --release
      if ($LASTEXITCODE -ne 0) { Die "Worker build failed" }
    } finally { Pop-Location }
  } else {
    Write-Host "  [SKIP] cargo not found — skip worker build" -ForegroundColor Yellow
  }
}

# --- Docker compose up ---
Step "Deploy with Docker Compose..."
Push-Location "$root/docker"
try {
  $composeArgs = @("-f", "docker-compose.yml", "up", "-d")
  if ($Profile) { $composeArgs = @("-f", "docker-compose.yml", "--profile", $Profile) + $composeArgs[2..$composeArgs.Count] }
  & "docker" "compose" $composeArgs
  if ($LASTEXITCODE -ne 0) { Die "Docker Compose failed" }
} finally { Pop-Location }

Step "Deploy complete. Check status: docker compose -f docker/docker-compose.yml ps"
