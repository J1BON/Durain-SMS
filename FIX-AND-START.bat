@echo off
title Durain SMS - Fix, Sync, and Start
cd /d "%~dp0"
setlocal EnableDelayedExpansion

echo.
echo  ============================================
echo   Durain SMS - One-Click Fix and Auto-Sync
echo  ============================================
echo.

if not exist "node_modules\" (
  echo [1/4] Installing dependencies...
  call npm install
  if errorlevel 1 (
    echo Install failed.
    pause
    exit /b 1
  )
) else (
  echo [1/4] Dependencies OK
)

if not exist ".env.local" (
  echo.
  echo ERROR: .env.local not found.
  echo Copy .env.example to .env.local and set:
  echo   DURIAN_USERNAME, DURIAN_API_KEY, DURIAN_WEB_PASSWORD
  echo.
  pause
  exit /b 1
)

echo [2/4] Syncing all services from DurianRCS panel...
call node scripts/durian-auto-sync.mjs --fix
if errorlevel 1 (
  echo.
  echo Sync failed. Fix .env.local or run: npm run panel-login
  pause
  exit /b 1
)

echo [3/4] Starting background auto-sync (new Durian services every 30 min)...
start "Durain Auto-Sync" /MIN cmd /c "cd /d "%~dp0" && node scripts/durian-auto-sync.mjs --daemon"

echo [4/4] Starting website at http://localhost:3000
if exist ".next\" (
  echo      Clearing stale Next.js cache...
  rmdir /s /q ".next" 2>nul
)
echo.
echo  - Site stays synced with Durian while this window runs
echo  - Minimized "Durain Auto-Sync" window updates the catalog in background
echo  - Close both windows to stop
echo.

timeout /t 2 /nobreak >nul
start "" "http://localhost:3000"
call npm run dev

pause
