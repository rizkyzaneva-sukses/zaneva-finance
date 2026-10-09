@echo off
setlocal
cd /d "%~dp0"
title Zaneva Finance

where node >nul 2>&1
if errorlevel 1 (
  echo Node.js tidak ditemukan.
  echo Pasang Node.js dulu, lalu double-klik file ini lagi.
  pause
  exit /b 1
)

if not exist ".env" (
  echo File .env belum ada.
  echo Salin .env.example menjadi .env, isi DATABASE_URL, lalu jalankan lagi.
  pause
  exit /b 1
)

if not exist "node_modules\" (
  echo Pertama kali: menginstal dependency. Tunggu sampai selesai...
  call npm install
  if errorlevel 1 (
    echo npm install gagal. Server tidak dijalankan.
    pause
    exit /b 1
  )
)

rem Kalau server sudah jalan, cukup buka browser.
netstat -ano | findstr /C:":3000 " | findstr /C:"LISTENING" >nul
if not errorlevel 1 (
  echo Server sudah berjalan. Membuka http://localhost:3000
  start "" http://localhost:3000
  exit /b 0
)

echo Menjalankan Zaneva Finance...
echo Alamat: http://localhost:3000
echo Tutup jendela ini untuk menghentikan server.
echo PostgreSQL harus sudah jalan, kalau tidak login dan data akan gagal.
echo.

rem Tunggu sebentar supaya server sempat siap, lalu buka browser.
rem Jangan pakai tanda pipe di dalam perintah start — cmd bisa salah baca.
start "" /min cmd /c "ping -n 4 127.0.0.1 >nul & start http://localhost:3000"

call npm run dev
echo.
echo Server berhenti.
pause
