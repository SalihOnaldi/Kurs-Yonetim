@echo off
setlocal enabledelayedexpansion
title Manuel Migration Uygulama
color 0B
cls

echo.
echo ================================================
echo   MANUEL MIGRATION UYGULAMA
echo ================================================
echo.
echo Bu script migration'lari manuel olarak uygular.
echo Eger otomatik migration calismazsa bunu kullanin.
echo.
pause

cd /d "%~dp0"

echo.
echo [1/3] SQL Server kontrol ediliyor...
docker exec src-sqlserver /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P "Salih-123" -C -Q "SELECT 1" >nul 2>&1
if errorlevel 1 (
    echo HATA: SQL Server baglantisi basarisiz!
    echo SQL Server container'inin calistigindan emin olun.
    pause
    exit /b 1
)
echo [OK] SQL Server hazir

echo.
echo [2/3] Veritabani olusturuluyor...
docker exec src-sqlserver /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P "Salih-123" -C -Q "IF NOT EXISTS (SELECT * FROM sys.databases WHERE name = 'srcdb') CREATE DATABASE srcdb" >nul 2>&1
echo [OK] Veritabani hazir

echo.
echo [3/3] Migration'lar uygulaniyor...
cd src\SRC.Presentation.Api

echo.
echo NOT: Migration'lar backend tarafindan otomatik uygulanacak.
echo Backend'i baslatin ve migration loglarini kontrol edin.
echo.
echo Backend'i baslatmak icin:
echo   dotnet run --urls http://localhost:5000
echo.
echo VEYA BASLA.bat dosyasini calistirin.
echo.

cd ..\..

pause

