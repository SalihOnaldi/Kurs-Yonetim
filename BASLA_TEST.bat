@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul 2>nul
title SRC - TEST MODU
color 0E
cls

echo.
echo ================================================
echo   TEST MODU - Hata Ayiklama
echo ================================================
echo.

cd /d "%~dp0"
if errorlevel 1 (
    echo HATA: Dizin degistirilemedi!
    pause
    exit /b 1
)

echo Aktif Dizin: %CD%
echo.
echo Her adimda bir tusa basinarak ilerleyin...
echo.
pause

echo.
echo [TEST 1] Docker kontrolu...
docker --version
if errorlevel 1 (
    echo !!! HATA: Docker bulunamadi!
    pause
) else (
    echo [OK] Docker bulundu
    pause
)

echo.
echo [TEST 2] Docker servisleri...
docker ps --filter "name=src-"
echo.
pause

echo.
echo [TEST 3] Proje yapisi...
if exist "src\SRC.Presentation.Api\SRC.Presentation.Api.csproj" (
    echo [OK] Backend projesi bulundu
) else (
    echo !!! HATA: Backend projesi bulunamadi!
)
if exist "frontend\package.json" (
    echo [OK] Frontend projesi bulundu
) else (
    echo !!! HATA: Frontend projesi bulunamadi!
)
if exist "ops\docker\docker-compose.yml" (
    echo [OK] Docker compose dosyasi bulundu
) else (
    echo !!! HATA: Docker compose dosyasi bulunamadi!
)
echo.
pause

echo.
echo [TEST 4] .NET SDK...
dotnet --version
if errorlevel 1 (
    echo !!! HATA: .NET SDK bulunamadi!
) else (
    echo [OK] .NET SDK bulundu
)
echo.
pause

echo.
echo [TEST 5] Node.js...
node --version
if errorlevel 1 (
    echo !!! HATA: Node.js bulunamadi!
) else (
    echo [OK] Node.js bulundu
)
echo.
pause

echo.
echo [TEST 6] Backend build testi...
cd "src\SRC.Presentation.Api"
dotnet build
cd ..\..
echo.
pause

echo.
echo ================================================
echo Test tamamlandi!
echo.
echo Eger hatalar varsa, lutfen once bunlari cozun.
echo.
pause

