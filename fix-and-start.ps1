# One-click: fix, sync with Durian, auto-sync daemon, start site
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host " Durain SMS - One-Click Fix and Auto-Sync" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

if (-not (Test-Path "node_modules")) {
  Write-Host "[1/4] Installing dependencies..." -ForegroundColor Yellow
  npm install
}

if (-not (Test-Path ".env.local")) {
  Write-Host "ERROR: .env.local not found. Copy .env.example first." -ForegroundColor Red
  exit 1
}

Write-Host "[2/4] Syncing services from DurianRCS..." -ForegroundColor Yellow
node scripts/durian-auto-sync.mjs --fix
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "[3/4] Starting background auto-sync..." -ForegroundColor Yellow
Start-Process -WindowStyle Minimized -FilePath "node" -ArgumentList "scripts/durian-auto-sync.mjs --daemon" -WorkingDirectory $PSScriptRoot

Write-Host "[4/4] Starting http://localhost:3000" -ForegroundColor Green
Start-Sleep -Seconds 2
Start-Process "http://localhost:3000"
npm run dev
