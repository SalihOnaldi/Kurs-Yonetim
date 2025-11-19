@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul 2>nul
title SRC - HIZLI BASLATMA
color 0A
cls

echo.
echo ================================================
echo   HIZLI BASLATMA (Docker hazirsa)
echo ================================================
echo.

cd /d "%~dp0"

REM Docker container'larin calistigini kontrol et
echo Docker container'lar kontrol ediliyor...
docker ps --filter "name=src-sqlserver" --format "{{.Names}}" | findstr /C:"src-sqlserver" >nul 2>&1
if errorlevel 1 (
    echo !!! Docker container'lar calismiyor!
    echo Lutfen once SQL_SERVER_FIX.bat veya BASLA.bat calistirin.
    pause
    exit /b 1
)

echo [OK] Docker container'lar calisiyor

REM SQL Server baglantisi test et
echo SQL Server baglantisi test ediliyor...
docker exec src-sqlserver /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P "YourStrong@Passw0rd" -C -Q "SELECT 1" >nul 2>&1
if errorlevel 1 (
    docker exec src-sqlserver /opt/mssql-tools/bin/sqlcmd -S localhost -U sa -P "YourStrong@Passw0rd" -C -Q "SELECT 1" >nul 2>&1
    if errorlevel 1 (
        echo !!! SQL Server henuz hazir degil!
        echo Biraz bekleyip tekrar deneyin veya BASLA.bat kullanin.
        pause
        exit /b 1
    )
)
echo [OK] SQL Server hazir

REM Temizlik
echo.
echo Eski process'ler temizleniyor...
taskkill /F /IM dotnet.exe 2>nul >nul
taskkill /F /IM node.exe 2>nul >nul
timeout /t 2 /nobreak >nul

REM Backend
echo.
echo Backend baslatiliyor...
cd "src\SRC.Presentation.Api"
start "SRC_BACKEND" cmd /k "cd /d %CD% && echo ======================================== && echo   SRC BACKEND - http://localhost:5000 && echo   Swagger: http://localhost:5000/swagger && echo ======================================== && echo. && dotnet run --urls http://localhost:5000"
cd ..\..
timeout /t 15 /nobreak >nul

REM Frontend
echo Frontend baslatiliyor...
cd frontend
start "SRC_FRONTEND" cmd /k "cd /d %CD% && echo ======================================== && echo   SRC FRONTEND - http://localhost:3000 && echo ======================================== && echo. && npm run dev"
cd ..

cls
echo.
echo ================================================
echo            HAZIR!
echo ================================================
echo.
echo Frontend:  http://localhost:3000
echo Backend:   http://localhost:5000/swagger
echo.
echo Login: admin / admin123
echo.
pause
