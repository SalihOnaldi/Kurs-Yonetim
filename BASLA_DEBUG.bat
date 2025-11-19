@echo off
setlocal enabledelayedexpansion
title SRC - DEBUG
color 0E
cls

echo.
echo ================================================
echo   DEBUG MODU - Her adimda pause
echo ================================================
echo.

cd /d "%~dp0"
echo Aktif Dizin: %CD%
echo.
pause

echo [1] Docker kontrolu...
docker --version
if errorlevel 1 (
    echo HATA!
    pause
    exit /b 1
)
echo [OK]
pause

echo [2] Docker servisleri...
docker ps --filter name=src-sqlserver
pause

echo [3] Veritabani...
cd src\SRC.Presentation.Api
dotnet ef database update --project "..\SRC.Infrastructure\SRC.Infrastructure.csproj" --startup-project "SRC.Presentation.Api.csproj"
cd ..\..
pause

echo [4] Backend build...
cd src\SRC.Presentation.Api
dotnet build
cd ..\..
pause

echo [5] Backend baslatiliyor...
cd src\SRC.Presentation.Api
start "SRC_BACKEND" cmd /k "cd /d %CD% && dotnet run --urls http://localhost:5000"
cd ..\..
timeout /t 10 /nobreak >nul
pause

echo [6] Frontend baslatiliyor...
cd frontend
start "SRC_FRONTEND" cmd /k "cd /d %CD% && npm run dev"
cd ..
pause

echo.
echo TAMAMLANDI!
pause
