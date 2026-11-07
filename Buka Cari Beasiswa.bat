@echo off
title Cari Beasiswa
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js belum terpasang. Download di https://nodejs.org lalu jalankan file ini lagi.
  pause
  exit /b 1
)

if not exist node_modules (
  echo Menginstal dependensi pertama kali...
  call npm install
)

rem API key disimpan di file .apikey (lokal, hanya di komputer ini)
if "%ANTHROPIC_API_KEY%"=="" if exist .apikey set /p ANTHROPIC_API_KEY=<.apikey
if "%ANTHROPIC_API_KEY%"=="" (
  echo.
  echo Masukkan API key Anthropic kamu ^(dari https://platform.claude.com^).
  echo Kosongkan lalu tekan Enter untuk membuka MODE DEMO saja.
  set /p ANTHROPIC_API_KEY=API key:
)
if "%ANTHROPIC_API_KEY%"=="" (
  set DEMO=1
  echo Membuka mode demo ^(jawaban contoh, bukan data asli^)...
) else (
  if not exist .apikey (echo %ANTHROPIC_API_KEY%>.apikey)
)

echo.
echo Membuka http://localhost:3000 ...  ^(tutup jendela ini untuk mematikan server^)
start "" http://localhost:3000
node server.js
pause
