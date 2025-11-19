@echo off
chcp 65001 >nul 2>nul
title SRC KURS YONETIM SISTEMI - DURDURMA
color 0C
cls

echo.
echo ================================================
echo   SRC KURS YONETIM SISTEMI - DURDURMA
echo ================================================
echo.

cd /d "%~dp0"

echo [1/3] Backend ve Frontend process'leri durduruluyor...
taskkill /F /IM dotnet.exe 2>nul
taskkill /F /IM node.exe 2>nul
echo [OK] Process'ler durduruldu

echo.
echo [2/3] Docker container'lar durduruluyor...
if exist "ops\docker\docker-compose.yml" (
    cd ops\docker
    docker compose down
    if errorlevel 1 (
        docker-compose down
    )
    cd ..\..
    echo [OK] Docker container'lar durduruldu
) else (
    echo ! docker-compose.yml bulunamadi
)

echo.
echo [3/3] Temizlik...
timeout /t 2 /nobreak >nul
echo [OK] Tamam

cls
echo.
echo ================================================
echo.
echo            DURDURULDU
echo.
echo ================================================
echo.
echo Tum servisler basariyla durduruldu.
echo.
echo Not: Veriler kaybolmadi (Docker volume'ler saklandi).
echo.
pause
