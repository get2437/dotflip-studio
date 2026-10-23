@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>&1
if errorlevel 1 (
  echo Node.js 22 or later is required. Install it from https://nodejs.org/
  pause
  exit /b 1
)
if exist "dist\index.html" goto serve
if not exist "node_modules\gifenc\package.json" call npm ci
if errorlevel 1 exit /b 1
call npm run build
if errorlevel 1 exit /b 1
:serve
echo Open http://127.0.0.1:4173 in your browser.
echo Keep this window open. Press Ctrl+C to stop.
node scripts\serve.mjs
