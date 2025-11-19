@echo off
chcp 65001 >nul
title TEST - SRC KURS YONETIM SISTEMI
color 0E
cls

echo.
echo ╔═══════════════════════════════════════════════╗
echo ║  TEST MODU - Hata Kontrolu                   ║
echo ╚═══════════════════════════════════════════════╝
echo.

cd /d %~dp0
echo Aktif Dizin: %CD%
echo.

echo [TEST 1] Docker kontrolu...
docker --version
if errorlevel 1 (
    echo !!! HATA: Docker bulunamadi!
) else (
    echo ✓ Docker bulundu
)
echo.

echo [TEST 2] Docker servisleri...
docker ps
echo.

echo [TEST 3] Proje yapisi...
if exist "src\SRC.Presentation.Api\SRC.Presentation.Api.csproj" (
    echo ✓ Backend projesi bulundu
) else (
    echo !!! HATA: Backend projesi bulunamadi!
)
echo.

if exist "frontend\package.json" (
    echo ✓ Frontend projesi bulundu
) else (
    echo !!! HATA: Frontend projesi bulunamadi!
)
echo.

if exist "ops\docker\docker-compose.yml" (
    echo ✓ Docker compose dosyasi bulundu
) else (
    echo !!! HATA: Docker compose dosyasi bulunamadi!
)
echo.

echo [TEST 4] .NET SDK...
dotnet --version
if errorlevel 1 (
    echo !!! HATA: .NET SDK bulunamadi!
) else (
    echo ✓ .NET SDK bulundu
)
echo.

echo [TEST 5] Node.js...
node --version
if errorlevel 1 (
    echo !!! HATA: Node.js bulunamadi!
) else (
    echo ✓ Node.js bulundu
)
echo.

echo [TEST 6] npm...
npm --version
if errorlevel 1 (
    echo !!! HATA: npm bulunamadi!
) else (
    echo ✓ npm bulundu
)
echo.

echo ════════════════════════════════════════════════
echo Test tamamlandi!
echo.
echo Eger hatalar varsa, lutfen once bunlari cozun.
echo.
pause

