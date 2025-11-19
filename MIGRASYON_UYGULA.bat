@echo off
title Migration Uygulama
color 0A
cls

echo.
echo ================================================
echo   MIGRATION UYGULAMA
echo ================================================
echo.

cd /d "%~dp0"

echo SQL Server kontrol ediliyor...
docker ps --filter name=src-sqlserver 2>nul | findstr src-sqlserver >nul 2>&1
if errorlevel 1 (
    echo HATA: SQL Server container calismiyor!
    echo BASLA.bat dosyasini once calistirin.
    pause
    exit /b 1
)

echo [OK] SQL Server calisiyor
echo.
echo Migration'lar uygulaniyor...
echo.

cd src\SRC.Presentation.Api

set SQL_PASSWORD=YourStrong@Passw0rd
dotnet ef database update --project "..\SRC.Infrastructure\SRC.Infrastructure.csproj" --startup-project "SRC.Presentation.Api.csproj"

if errorlevel 1 (
    echo.
    echo HATA: Migration uygulanamadi!
    echo.
    echo Cozum onerileri:
    echo 1. Backend penceresini kapatip tekrar deneyin
    echo 2. SQL Server'in hazir oldugundan emin olun
    echo 3. Backend'in kendi migration mekanizmasi calisacaktir
    echo.
    pause
    exit /b 1
) else (
    echo.
    echo [OK] Migration'lar basariyla uygulandi!
    echo Veritabani hazir.
    echo.
)

pause

