@echo off
title Pendataan Personel
cd /d "%~dp0"

set "PHP=C:\xampp\php\php.exe"
if not exist "%PHP%" (
    where php >nul 2>nul
    if errorlevel 1 (
        echo [ERROR] PHP tidak ditemukan.
        echo   1. Instal XAMPP dari https://www.apachefriends.org ^(folder default C:\xampp^)
        echo   2. Jalankan ulang skrip ini.
        pause
        exit /b 1
    )
    set "PHP=php"
)

if not exist "public\index.html" (
    echo [ERROR] Frontend belum di-build.
    echo   Jalankan:  cd frontend ^&^& npm install ^&^& npm run build
    pause
    exit /b 1
)

rem Cek apakah server sudah berjalan
netstat -an | findstr /C:":8081 " | findstr "LISTENING" >nul
if not errorlevel 1 (
    echo Server sudah berjalan. Membuka browser...
    start "" http://127.0.0.1:8081
    pause
    exit /b 0
)

start "" http://127.0.0.1:8081
echo.
echo ============================================
echo  Pendataan Personel sedang berjalan
echo  URL: http://127.0.0.1:8081
echo  Tutup jendela ini untuk menghentikan server.
echo ============================================
echo.
"%PHP%" -d session.save_path="%TEMP%" -S 127.0.0.1:8081 -t "%~dp0public" "%~dp0router.php"
pause