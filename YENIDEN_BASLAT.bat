@echo off
setlocal enabledelayedexpansion
title SQL Server Yeniden Baslatma
color 0A
cls

echo.
echo ================================================
echo   SQL SERVER YENIDEN BASLATMA
echo ================================================
echo.
echo Bu script:
echo 1. Docker Desktop'in calistigini kontrol eder
echo 2. Eski container'lari durdurur
echo 3. Volume'leri siler (TUM VERILER SILINIR!)
echo 4. Yeni sifre ile container'i baslatir
echo 5. Migration'lari uygular
echo.
pause

cd /d "%~dp0"

echo.
echo [1/6] Docker Desktop kontrol ediliyor...
docker --version >nul 2>&1
if errorlevel 1 (
    echo HATA: Docker bulunamadi!
    echo Docker Desktop'i baslatin ve tekrar deneyin.
    pause
    exit /b 1
)

docker info >nul 2>&1
if errorlevel 1 (
    echo HATA: Docker Desktop calismiyor!
    echo Docker Desktop'i baslatin ve tekrar deneyin.
    pause
    exit /b 1
)
echo [OK] Docker Desktop calisiyor

echo.
echo [2/6] Backend durduruluyor...
taskkill /F /IM dotnet.exe 2>nul
timeout /t 2 /nobreak >nul
echo [OK] Backend durduruldu

echo.
echo [3/6] Eski container'lar durduruluyor...
cd ops\docker
docker compose down 2>nul
cd ..\..

echo.
echo [4/6] Volume'ler siliniyor...
docker volume rm ops_docker_sqlserver_data 2>nul
docker volume rm src-sqlserver_data 2>nul
echo [OK] Volume'ler silindi

echo.
echo [5/6] SQL Server yeni sifre ile baslatiliyor...
cd ops\docker
docker compose up -d sqlserver
cd ..\..

echo.
echo SQL Server container baslatildi.
echo Container durumu kontrol ediliyor...
timeout /t 5 /nobreak >nul

:CHECK_CONTAINER
docker ps --filter name=src-sqlserver --format "{{.Status}}" | findstr /C:"Up" >nul 2>&1
if errorlevel 1 (
    echo Container henuz baslamadi, bekleniyor...
    timeout /t 5 /nobreak >nul
    goto CHECK_CONTAINER
)
echo [OK] Container calisiyor

echo.
echo SQL Server hazir olana kadar bekleniyor (max 2 dakika)...
set /a RETRY=0
set /a MAX_RETRY=24
:RETRY_TEST
set /a RETRY+=1
echo [!RETRY!/!MAX_RETRY!] SQL Server baglantisi test ediliyor...
docker exec src-sqlserver /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P "Salih-123" -C -Q "SELECT 1" >nul 2>&1
if errorlevel 1 (
    if !RETRY! LSS !MAX_RETRY! (
        echo SQL Server henuz hazir degil, 5 saniye sonra tekrar deneniyor...
        timeout /t 5 /nobreak >nul
        goto RETRY_TEST
    )
    echo.
    echo HATA: SQL Server baglantisi basarisiz!
    echo.
    echo SQL Server container loglarini kontrol ediyorum...
    docker logs src-sqlserver --tail 30
    echo.
    echo.
    echo COZUM ONERILERI:
    echo 1. Docker Desktop'i yeniden baslatin
    echo 2. Bu scripti tekrar calistirin
    echo 3. Eger sorun devam ederse, Docker Desktop Settings'den
    echo    "Use WSL 2 based engine" secenegini acip kapatin
    echo.
    pause
    exit /b 1
)

echo.
echo [OK] SQL Server hazir! (Deneme: !RETRY!/!MAX_RETRY!)

echo.
echo Veritabani olusturuluyor...
docker exec src-sqlserver /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P "Salih-123" -C -Q "IF NOT EXISTS (SELECT * FROM sys.databases WHERE name = 'srcdb') CREATE DATABASE srcdb"

echo.
echo [6/6] Migration'lar uygulaniyor...
cd src\SRC.Presentation.Api
dotnet ef database update --project "..\SRC.Infrastructure\SRC.Infrastructure.csproj" --startup-project "SRC.Presentation.Api.csproj"
if errorlevel 1 (
    echo.
    echo UYARI: Migration uygulanamadi!
    echo Backend baslatilirken otomatik uygulanacak.
    cd ..\..
    goto START_BACKEND
)

echo [OK] Migration'lar uygulandi!

cd ..\..

:START_BACKEND
echo.
echo Backend baslatiliyor...
cd src\SRC.Presentation.Api
start "SRC_BACKEND" cmd /k "cd /d %CD% && echo ======================================== && echo   SRC BACKEND - http://localhost:5000 && echo   Swagger: http://localhost:5000/swagger && echo ======================================== && echo. && echo Migration'lar kontrol ediliyor... && echo. && dotnet run --urls http://localhost:5000"
cd ..\..

timeout /t 5 /nobreak >nul

echo.
echo Frontend baslatiliyor...
cd frontend
if not exist "node_modules" (
    echo Node modulleri yukleniyor...
    call npm install
)
start "SRC_FRONTEND" cmd /k "cd /d %CD% && echo ======================================== && echo   SRC FRONTEND - http://localhost:3000 && echo ======================================== && echo. && npm run dev"
cd ..

cls
echo.
echo ================================================
echo.
echo            TAMAMLANDI!
echo.
echo ================================================
echo.
echo Yeni sifre: Salih-123
echo.
echo Frontend:  http://localhost:3000
echo Backend:   http://localhost:5000
echo Swagger:   http://localhost:5000/swagger
echo.
echo Login: admin / admin123
echo.
echo ================================================
echo.
pause

