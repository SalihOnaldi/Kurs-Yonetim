@echo off
REM ============================================
REM PENCEREYI KAPATMAMAK ICIN WRAPPER
REM ============================================
if "%1"=="INTERNAL_RUN" goto MAIN
cmd /k "%~f0" INTERNAL_RUN
exit /b

:MAIN
setlocal enabledelayedexpansion
title SRC KURS YONETIM SISTEMI
color 0B
cls

REM ============================================
REM SQL SERVER AYARLARI - TEK YERDEN YONETIM
REM ============================================
set "SQL_PASSWORD=S8P2prTO3d6ySTPiQnCt"
set "SQL_USER=sa"
set "SQL_DATABASE=srcdb"
set "SQL_SERVER=localhost,1433"

REM Connection String'i olustur
set "CONN_STR=Server=%SQL_SERVER%;Database=%SQL_DATABASE%;User Id=%SQL_USER%;Password=%SQL_PASSWORD%;TrustServerCertificate=true;Encrypt=false;Connection Timeout=60;MultipleActiveResultSets=true;"

echo.
echo ================================================
echo   SRC KURS YONETIM SISTEMI
echo ================================================
echo.

REM Dizin degistirme
cd /d "%~dp0" 2>nul
if errorlevel 1 (
    echo [HATA] Dizin degistirilemedi!
    pause
    exit /b 1
)

echo Aktif Dizin: %CD%
echo.

REM ============================================
REM [1/5] Docker Kontrolu
REM ============================================
echo [1/5] Docker kontrol ediliyor...
docker --version >nul 2>&1
if errorlevel 1 (
    echo [HATA] Docker bulunamadi!
    echo Docker Desktop'in yuklu ve calisir durumda oldugundan emin olun.
    echo.
    pause
    exit /b 1
)

docker info >nul 2>&1
if errorlevel 1 (
    echo [HATA] Docker Desktop calismiyor!
    echo Docker Desktop'i baslatin ve tekrar deneyin.
    echo.
    pause
    exit /b 1
)

echo [OK] Docker bulundu

REM Docker container'larini kontrol et
echo Docker servisleri kontrol ediliyor...
set NEED_START=0
set NEED_RECREATE=0

REM src-sqlserver kontrolu - format kullanmadan, sadece findstr ile
docker ps --filter name=src-sqlserver 2>nul | findstr /C:"src-sqlserver" >nul 2>&1
if errorlevel 1 (
    set NEED_START=1
    set NEED_RECREATE=1
) else (
    REM Container calisiyor, sifre kontrolu
    docker exec src-sqlserver /opt/mssql-tools18/bin/sqlcmd -S localhost -U %SQL_USER% -P "%SQL_PASSWORD%" -Q "SELECT 1" -C >nul 2>&1
    if errorlevel 1 (
        echo [UYARI] SQL Server sifresi uyumsuz, container yeniden olusturuluyor...
        docker stop src-sqlserver >nul 2>&1
        docker rm src-sqlserver >nul 2>&1
        set NEED_RECREATE=1
        set NEED_START=1
    )
)

REM src-minio kontrolu
docker ps --filter name=src-minio 2>nul | findstr /C:"src-minio" >nul 2>&1
if errorlevel 1 (
    set NEED_START=1
)

REM Container durumuna gore islem yap
if "!NEED_RECREATE!"=="1" (
    echo Docker container'lar yeniden olusturuluyor...
    pushd ops\docker
    if errorlevel 1 (
        echo [HATA] ops\docker dizini bulunamadi!
        pause
        exit /b 1
    )
    docker compose down -v
    docker compose up -d
    if errorlevel 1 (
        echo [HATA] Docker container'lar baslatilamadi!
        popd
        pause
        exit /b 1
    )
    popd
    echo Servislerin hazir olmasi icin 60 saniye bekleniyor...
    timeout /t 60 /nobreak >nul
) else (
    if "!NEED_START!"=="1" (
        echo Docker container'lar baslatiliyor...
        pushd ops\docker
        if errorlevel 1 (
            echo [HATA] ops\docker dizini bulunamadi!
            pause
            exit /b 1
        )
        docker compose up -d
        if errorlevel 1 (
            echo [HATA] Docker container'lar baslatilamadi!
            popd
            pause
            exit /b 1
        )
        popd
        echo Servislerin hazir olmasi icin 60 saniye bekleniyor...
        timeout /t 60 /nobreak >nul
    ) else (
        echo [OK] Docker container'lar calisiyor
    )
)

REM ============================================
REM [2/5] SQL Server Hazirlik Kontrolu
REM ============================================
echo.
echo [2/5] Veritabani hazirlaniyor...
set "SQL_WAIT_INTERVAL=2"
set "SQL_MAX_ATTEMPTS=90"
set "SQL_WAIT_COUNT=0"
set "SQL_CHECK_LOG=%TEMP%\\sql_check.log"

echo SQL Server hazir olana kadar bekleniyor (max !SQL_MAX_ATTEMPTS! deneme)...
:SQL_WAIT_LOOP
set /a SQL_WAIT_COUNT+=1
if !SQL_WAIT_COUNT! GTR !SQL_MAX_ATTEMPTS! (
    echo [HATA] SQL Server bekleme suresi icinde hazir olmadi!
    echo Lütfen docker ps ve docker logs src-sqlserver komutlarini kontrol edin.
    if exist "!SQL_CHECK_LOG!" (
        echo Son komut ciktisi:
        type "!SQL_CHECK_LOG!"
    )
    pause
    exit /b 1
)

call docker exec src-sqlserver /opt/mssql-tools18/bin/sqlcmd -S localhost -U %SQL_USER% -P "%SQL_PASSWORD%" -Q "SELECT 1" -C >"!SQL_CHECK_LOG!" 2>&1
if not errorlevel 1 goto SQL_READY

set "SQL_ERR=!ERRORLEVEL!"
echo    Deneme !SQL_WAIT_COUNT!/!SQL_MAX_ATTEMPTS! -> SQL henuz hazir degil (hata kodu !SQL_ERR!)
if exist "!SQL_CHECK_LOG!" (
    type "!SQL_CHECK_LOG!"
)
timeout /t %SQL_WAIT_INTERVAL% /nobreak >nul
goto SQL_WAIT_LOOP

:SQL_READY
if exist "!SQL_CHECK_LOG!" del "!SQL_CHECK_LOG!" >nul 2>&1
echo [OK] SQL Server hazir (!SQL_WAIT_COUNT!. deneme)

REM ============================================
REM [2.5/5] EF Core Tools Kontrolu
REM ============================================
echo.
echo [2.5/5] EF Core Tools kontrol ediliyor...
dotnet tool list -g | findstr dotnet-ef >nul 2>&1
if errorlevel 1 (
    echo EF Core Tools yukleniyor...
    dotnet tool install --global dotnet-ef >nul 2>&1
    if errorlevel 1 (
        echo [HATA] EF Core Tools yuklenemedi!
        pause
        exit /b 1
    )
    echo [OK] EF Core Tools yuklendi
) else (
    echo [OK] EF Core Tools mevcut
)

REM ============================================
REM [2.6/5] Migration Uygulama
REM ============================================
echo.
echo [2.6/5] Migration uygulaniyor...
cd src\SRC.Presentation.Api
if errorlevel 1 (
    echo [HATA] src\SRC.Presentation.Api dizini bulunamadi!
    pause
    cd ..\..
    exit /b 1
)

if not exist "appsettings.json" (
    echo [HATA] appsettings.json bulunamadi!
    pause
    cd ..\..
    exit /b 1
)

if not exist "..\SRC.Infrastructure\SRC.Infrastructure.csproj" (
    echo [HATA] SRC.Infrastructure.csproj bulunamadi!
    pause
    cd ..\..
    exit /b 1
)

echo Migration uygulaniyor...
dotnet ef database update --project ..\SRC.Infrastructure\SRC.Infrastructure.csproj --startup-project . --connection "%CONN_STR%" > migration_output.txt 2>&1
set MIGRATION_RESULT=%ERRORLEVEL%

if %MIGRATION_RESULT% EQU 0 (
    findstr /C:"No migrations were applied" migration_output.txt >nul 2>&1
    if errorlevel 1 (
        findstr /C:"already up to date" migration_output.txt >nul 2>&1
        if errorlevel 1 (
            echo [OK] Migration basarili
        ) else (
            echo [OK] Migration zaten uygulanmis
        )
    ) else (
        echo [OK] Migration zaten uygulanmis
    )
    del migration_output.txt >nul 2>&1
) else (
    echo [HATA] Migration uygulanamadi!
    type migration_output.txt
    del migration_output.txt >nul 2>&1
    pause
    cd ..\..
    exit /b 1
)

cd ..\..

REM ============================================
REM [3/5] Eski Process'leri Temizle
REM ============================================
echo.
echo [3/5] Eski process'ler temizleniyor...
taskkill /F /IM dotnet.exe 2>nul
taskkill /F /IM node.exe 2>nul
timeout /t 2 /nobreak >nul
echo [OK] Temizlik tamamlandi

REM ============================================
REM [4/5] Backend Baslatma
REM ============================================
echo.
echo [4/5] Backend baslatiliyor...
if not exist "src\SRC.Presentation.Api\SRC.Presentation.Api.csproj" (
    echo [HATA] Backend dizini bulunamadi!
    pause
    exit /b 1
)

cd src\SRC.Presentation.Api
if errorlevel 1 (
    echo [HATA] src\SRC.Presentation.Api dizini bulunamadi!
    pause
    cd ..\..
    exit /b 1
)

echo Build yapiliyor...
dotnet build >nul 2>&1
if errorlevel 1 (
    echo [HATA] Build basarisiz!
    dotnet build
    pause
    cd ..\..
    exit /b 1
)

echo [OK] Build basarili
echo Backend baslatiliyor...
start "SRC_BACKEND" cmd /k "cd /d %CD% && echo SRC BACKEND - http://localhost:5000 && echo Swagger: http://localhost:5000/swagger && dotnet run --urls http://localhost:5000"
cd ..\..
timeout /t 5 /nobreak >nul
echo [OK] Backend baslatildi

REM ============================================
REM [5/5] Frontend Baslatma
REM ============================================
echo.
echo [5/5] Frontend baslatiliyor...
cd frontend
if errorlevel 1 (
    echo [HATA] frontend dizini bulunamadi!
    pause
    cd ..
    exit /b 1
)

if not exist "package.json" (
    echo [HATA] package.json bulunamadi!
    pause
    cd ..
    exit /b 1
)

if not exist "node_modules" (
    echo Node modulleri yukleniyor...
    call npm install
    if errorlevel 1 (
        echo [HATA] npm install basarisiz!
        pause
        cd ..
        exit /b 1
    )
    echo [OK] Node modulleri yuklendi
)

echo Frontend baslatiliyor...
start "SRC_FRONTEND" cmd /k "cd /d %CD% && echo SRC FRONTEND - http://localhost:3000 && npm run dev"
cd ..

REM ============================================
REM BASARI MESAJI
REM ============================================
cls
echo.
echo ================================================
echo            HAZIR!
echo ================================================
echo.
echo Frontend:  http://localhost:3000
echo Backend:   http://localhost:5000
echo Swagger:   http://localhost:5000/swagger
echo.
echo ========================================
echo   GIRIS BILGILERI
echo ========================================
echo.
echo Yonetim (PlatformOwner):
echo   Kullanici: admin
echo   Sifre: Admin123!
echo.
echo Sube Yoneticisi (BranchAdmin):
echo   Kullanici: admin.kurs
echo   Sifre: Kurs123!
echo.
echo ========================================
echo.
echo Devam etmek icin bir tusa basin...
pause
