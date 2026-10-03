@echo off
setlocal
cd /d "%~dp0"

set "NODE_EXE="
where node >nul 2>nul
if not errorlevel 1 (
  for /f "delims=" %%N in ('where node') do if not defined NODE_EXE set "NODE_EXE=%%N"
)
if not defined NODE_EXE set "NODE_EXE=%LOCALAPPDATA%\faculty-demo-node\node-v22.23.3-win-x64\node.exe"

if not exist "%NODE_EXE%" (
  echo Node.js is not installed. Install Node.js LTS from https://nodejs.org
  exit /b 1
)
if not exist "node_modules\express" (
  echo Project packages are not installed. Run npm install first.
  exit /b 1
)

"%NODE_EXE%" server.js
