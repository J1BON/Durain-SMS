# One-click launcher (PowerShell) — right-click → Run with PowerShell
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

if (-not (Test-Path "node_modules")) {
  Write-Host "Installing dependencies..." -ForegroundColor Cyan
  npm install
}

if (-not (Test-Path ".env.local")) {
  Write-Host ""
  Write-Host "WARNING: .env.local not found." -ForegroundColor Yellow
  Write-Host "Add DURIAN_USERNAME and DURIAN_API_KEY, then run again."
  Write-Host ""
  Read-Host "Press Enter to continue anyway"
}

Write-Host "Starting Durain SMS at http://localhost:3000" -ForegroundColor Green
Start-Process "http://localhost:3000"
npm run dev
