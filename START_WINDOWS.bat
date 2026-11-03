@echo off
chcp 65001 > nul
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Chua cai Node.js. Tai Node.js 20+ truoc khi chay.
  pause
  exit /b 1
)
if not exist .env (
  echo Ban can sao chep .env.example thanh .env va nhap thong tin JSONBin/ADMIN truoc.
  pause
  exit /b 1
)
echo Dang khoi dong BACH PREMIUM tai http://localhost:3000
node server.js
pause
