@echo off
title SQL Server Sifre Sifirlama
color 0C
cls

echo.
echo ================================================
echo   SQL SERVER SIFRE SIFIRLAMA
echo ================================================
echo.
echo Bu script:
echo 1. SQL Server container'ini durdurur
echo 2. Volume'u siler (TUM VERILER SILINIR!)
echo 3. Yeni sifre ile container'i yeniden baslatir
echo.
echo DEVAM ETMEK ISTIYOR MUSUNUZ? (E/H)
set /p CONFIRM=

if /i not "%CONFIRM%"=="E" (
    echo Iptal edildi.
    pause
    exit /b 0
)

cd /d "%~dp0"

echo.
echo [1/4] Backend durduruluyor...
taskkill /F /IM dotnet.exe 2>nul
timeout /t 2 /nobreak >nul

echo.
echo [2/4] SQL Server container durduruluyor...
cd ops\docker
docker compose down
cd ..\..

echo.
echo [3/4] Volume siliniyor...
docker volume rm src-sqlserver_data 2>nul
docker volume rm ops_docker_sqlserver_data 2>nul

echo.
echo [4/4] SQL Server yeni sifre ile baslatiliyor...
cd ops\docker
docker compose up -d sqlserver
cd ..\..

echo.
echo SQL Server baslatiliyor, 60 saniye bekleniyor...
timeout /t 60 /nobreak >nul

echo.
echo SQL Server test ediliyor...
docker exec src-sqlserver /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P "SRC2024!Pass" -C -Q "SELECT 1" >nul 2>&1
if errorlevel 1 (
    echo HATA: SQL Server baglantisi basarisiz!
    echo 30 saniye daha bekleniyor...
    timeout /t 30 /nobreak >nul
    docker exec src-sqlserver /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P "SRC2024!Pass" -C -Q "SELECT 1" >nul 2>&1
    if errorlevel 1 (
        echo HATA: SQL Server hala hazir degil!
        pause
        exit /b 1
    )
)

echo [OK] SQL Server hazir!

echo.
echo Veritabani olusturuluyor...
docker exec src-sqlserver /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P "SRC2024!Pass" -C -Q "IF NOT EXISTS (SELECT * FROM sys.databases WHERE name = 'srcdb') CREATE DATABASE srcdb"

echo.
echo ================================================
echo   TAMAMLANDI
echo ================================================
echo.
echo Yeni sifre: SRC2024!Pass
echo.
echo Simdi COZUM.bat dosyasini calistirin.
echo.
pause

