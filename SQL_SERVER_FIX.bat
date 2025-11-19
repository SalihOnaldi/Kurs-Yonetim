@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul 2>nul
title SQL Server Container Fix
color 0C
cls

echo.
echo ================================================
echo   SQL Server Container Fix
echo ================================================
echo.

cd /d "%~dp0"

echo [1] Mevcut container'lari kontrol ediliyor...
docker ps -a --filter "name=src-"
echo.

echo [2] Eski container'lar durduruluyor...
cd ops\docker
docker compose down 2>nul
docker-compose down 2>nul

echo.
echo [3] Container'lar temizleniyor...
docker rm -f src-sqlserver src-minio 2>nul

echo.
echo [4] Volume'ler temizleniyor (DIKKAT: Veriler silinecek!)...
docker volume rm docker_sqlserver_data docker_minio_data 2>nul
docker volume rm ops_docker_sqlserver_data ops_docker_minio_data 2>nul

echo.
echo [5] Yeni container'lar baslatiliyor...
docker compose up -d
if errorlevel 1 (
    docker-compose up -d
    if errorlevel 1 (
        echo !!! HATA: Container'lar baslatilamadi!
        pause
        exit /b 1
    )
)

echo.
echo [6] Container'larin baslatildigi kontrol ediliyor...
timeout /t 10 /nobreak >nul
docker ps --filter "name=src-"
echo.

echo [7] SQL Server'in tamamen hazir olmasi bekleniyor...
echo SQL Server ilk baslatmada 2-3 dakika surebilir.
echo Lutfen sabirla bekleyin...
echo.

REM Daha uzun bekleme ve daha iyi test
set /a MAX_RETRIES=60
set /a RETRY_COUNT=0
set /a WAIT_SECONDS=5

:TEST_LOOP
set /a RETRY_COUNT+=1

REM Container'in calisip calismadigini kontrol et
docker ps --filter "name=src-sqlserver" --format "{{.Status}}" | findstr /C:"Up" >nul 2>&1
if errorlevel 1 (
    echo !!! Container calismiyor!
    docker logs src-sqlserver --tail 10
    pause
    exit /b 1
)

REM SQL Server'in hazir olup olmadigini test et
docker exec src-sqlserver /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P "YourStrong@Passw0rd" -C -Q "SELECT 1" >nul 2>&1
if errorlevel 1 (
    docker exec src-sqlserver /opt/mssql-tools/bin/sqlcmd -S localhost -U sa -P "YourStrong@Passw0rd" -C -Q "SELECT 1" >nul 2>&1
    if errorlevel 1 (
        if !RETRY_COUNT! LSS !MAX_RETRIES! (
            echo SQL Server hazir degil, bekleniyor... [!RETRY_COUNT!/!MAX_RETRIES!]
            timeout /t !WAIT_SECONDS! /nobreak >nul
            goto TEST_LOOP
        ) else (
            echo.
            echo !!! HATA: SQL Server 5 dakika sonra bile hazir olmadi!
            echo.
            echo Container durumu:
            docker ps --filter "name=src-sqlserver"
            echo.
            echo Container loglari (son 30 satir):
            docker logs src-sqlserver --tail 30
            echo.
            echo SQL Server hala baslatiliyor olabilir. Biraz bekleyip tekrar deneyin.
            echo.
            pause
            exit /b 1
        )
    )
)

echo.
echo [OK] SQL Server hazir ve baglanti basarili!
echo.

REM Hangi path calistiysa onu kullan
docker exec src-sqlserver /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P "YourStrong@Passw0rd" -C -Q "SELECT @@VERSION AS Version" 2>nul
if errorlevel 1 (
    docker exec src-sqlserver /opt/mssql-tools/bin/sqlcmd -S localhost -U sa -P "YourStrong@Passw0rd" -C -Q "SELECT @@VERSION AS Version"
)

echo.
echo ================================================
echo SQL Server container'lari basariyla hazir!
echo.
echo Container durumu:
docker ps --filter "name=src-"
echo.
echo Simdi BASLA.bat dosyasini calistirabilirsiniz.
echo.
cd ..\..
pause
