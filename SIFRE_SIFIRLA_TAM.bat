@echo off
setlocal enabledelayedexpansion
title SQL Server Sifre Sifirlama (TAM)
color 0C
cls

echo.
echo ================================================
echo   SQL SERVER SIFRE SIFIRLAMA (TAM)
echo ================================================
echo.
echo BU ISLEM TUM VERILERI SILECEK!
echo Container ve volume'ler tamamen silinecek.
echo.
pause

cd /d "%~dp0"

echo.
echo [1/5] Backend durduruluyor...
taskkill /F /IM dotnet.exe 2>nul
timeout /t 2 /nobreak >nul
echo [OK] Backend durduruldu

echo.
echo [2/5] Container'lar durduruluyor ve siliniyor...
cd ops\docker
docker compose down -v
cd ..\..

echo.
echo [3/5] Volume'ler siliniyor...
docker volume rm ops_docker_sqlserver_data 2>nul
docker volume rm src-sqlserver_data 2>nul
docker volume rm docker_sqlserver_data 2>nul
docker volume ls | findstr sqlserver
if errorlevel 1 (
    echo [OK] Tum volume'ler silindi
) else (
    echo UYARI: Bazi volume'ler hala mevcut, manuel silinebilir
)

echo.
echo [4/5] Container'lar tamamen temizleniyor...
docker rm -f src-sqlserver 2>nul
docker rm -f src-minio 2>nul
echo [OK] Container'lar silindi

echo.
echo [5/5] Yeni sifre ile container'lar baslatiliyor...
cd ops\docker
docker compose up -d
cd ..\..

echo.
echo ================================================
echo   Container'lar baslatildi
echo ================================================
echo.
echo SQL Server hazir olana kadar bekleniyor...
echo Bu 60-90 saniye surebilir.
echo.

set /a RETRY=0
set /a MAX_RETRY=30
:WAIT_LOOP
set /a RETRY+=1
echo [!RETRY!/!MAX_RETRY!] SQL Server bekleniyor...
docker exec src-sqlserver /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P "Salih-123" -C -Q "SELECT 1" >nul 2>&1
if errorlevel 1 (
    if !RETRY! LSS !MAX_RETRY! (
        timeout /t 3 /nobreak >nul
        goto WAIT_LOOP
    )
    echo.
    echo HATA: SQL Server baglantisi basarisiz!
    echo Container loglarini kontrol ediyorum...
    docker logs src-sqlserver --tail 20
    echo.
    pause
    exit /b 1
)

echo.
echo [OK] SQL Server hazir! (Deneme: !RETRY!)
echo.
echo Veritabani olusturuluyor...
docker exec src-sqlserver /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P "Salih-123" -C -Q "IF NOT EXISTS (SELECT * FROM sys.databases WHERE name = 'srcdb') CREATE DATABASE srcdb" >nul 2>&1

echo.
echo ================================================
echo   TAMAMLANDI!
echo ================================================
echo.
echo Yeni sifre: Salih-123
echo.
echo Simdi YENIDEN_BASLAT.bat veya BASLA.bat
echo dosyasini calistirabilirsiniz.
echo.
pause

