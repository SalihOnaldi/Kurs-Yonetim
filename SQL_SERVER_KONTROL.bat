@echo off
setlocal enabledelayedexpansion
title SQL Server Kontrol
color 0E
cls

echo.
echo ================================================
echo   SQL SERVER DURUM KONTROLU
echo ================================================
echo.

cd /d "%~dp0"

echo [1] Docker Desktop kontrol ediliyor...
docker info >nul 2>&1
if errorlevel 1 (
    echo HATA: Docker Desktop calismiyor!
    pause
    exit /b 1
)
echo [OK] Docker Desktop calisiyor

echo.
echo [2] Container durumu kontrol ediliyor...
docker ps --filter name=src-sqlserver --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
if errorlevel 1 (
    echo Container bulunamadi!
    pause
    exit /b 1
)

echo.
echo [3] SQL Server baglantisi test ediliyor...
docker exec src-sqlserver /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P "Salih-123" -C -Q "SELECT @@VERSION" 2>&1
if errorlevel 1 (
    echo.
    echo HATA: SQL Server baglantisi basarisiz!
    echo.
    echo Container loglari:
    docker logs src-sqlserver --tail 20
) else (
    echo.
    echo [OK] SQL Server baglantisi basarili!
)

echo.
echo [4] Veritabani kontrol ediliyor...
docker exec src-sqlserver /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P "Salih-123" -C -Q "SELECT name FROM sys.databases WHERE name = 'srcdb'" 2>&1 | findstr srcdb >nul
if errorlevel 1 (
    echo Veritabani 'srcdb' bulunamadi.
) else (
    echo [OK] Veritabani 'srcdb' mevcut.
    echo.
    echo Tablo sayisi:
    docker exec src-sqlserver /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P "Salih-123" -C -d srcdb -Q "SELECT COUNT(*) as TableCount FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE'" -h -1
)

echo.
echo ================================================
pause

