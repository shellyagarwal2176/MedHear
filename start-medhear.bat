@echo off
rem Starts MedHear: local database (27017), backend (8000) and website (3000), then opens the site.
cd /d "%~dp0"

set "DB_ROOT=%LOCALAPPDATA%\MedHearDB"
set "MONGOD=%DB_ROOT%\mongodb\mongodb-win32-x86_64-windows-7.0.14\bin\mongod.exe"
if exist "%MONGOD%" (
  start "MedHear database" /min "%MONGOD%" --dbpath "%DB_ROOT%\data" --bind_ip 127.0.0.1 --port 27017 --logpath "%DB_ROOT%\mongod.log"
  timeout /t 5 /nobreak >nul
)

start "MedHear backend" cmd /k "cd backend && venv\Scripts\python.exe -m uvicorn app.main:app --port 8000"
start "MedHear website" cmd /k "cd frontend && npm run dev"
timeout /t 12 /nobreak >nul
start "" http://localhost:3000
