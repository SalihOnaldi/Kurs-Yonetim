@echo off
title SQL Server Sorunu Cozumu
color 0E
cls

echo.
echo ================================================
echo   SQL SERVER SORUNU COZUMU
echo ================================================
echo.
echo Bu script:
echo 1. Backend'i durdurur
echo 2. SQL Server baglantisini test eder
echo 3. Migration'lari uygular
echo 4. Backend'i yeniden baslatir
echo.
pause

cd /d "%~dp0"

echo.
echo [1/4] Backend durduruluyor...
taskkill /F /IM dotnet.exe 2>nul
timeout /t 3 /nobreak >nul
echo [OK] Backend durduruldu

echo.
echo [2/4] SQL Server kontrol ediliyor...
docker ps --filter name=src-sqlserver 2>nul | findstr src-sqlserver >nul 2>&1
if errorlevel 1 (
    echo HATA: SQL Server container calismiyor!
    echo BASLA.bat dosyasini once calistirin.
    pause
    exit /b 1
)

docker exec src-sqlserver /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P "Salih-123" -C -Q "SELECT 1" >nul 2>&1
if errorlevel 1 (
    echo HATA: SQL Server baglantisi basarisiz!
    echo SQL Server'in hazir olmasini bekleyin...
    timeout /t 30 /nobreak >nul
    docker exec src-sqlserver /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P "Salih-123" -C -Q "SELECT 1" >nul 2>&1
    if errorlevel 1 (
        echo HATA: SQL Server hala hazir degil!
        pause
        exit /b 1
    )
)
echo [OK] SQL Server hazir

echo.
echo [3/4] Migration'lar uygulaniyor...
cd src\SRC.Presentation.Api
dotnet ef database update --project "..\SRC.Infrastructure\SRC.Infrastructure.csproj" --startup-project "SRC.Presentation.Api.csproj"
if errorlevel 1 (
    echo.
    echo HATA: Migration uygulanamadi!
    echo Backend baslatilirken otomatik uygulanacak.
    cd ..\..
    goto START_BACKEND
)

echo [OK] Migration'lar uygulandi

echo.
echo [4/4] Veritabani kontrol ediliyor...
docker exec src-sqlserver /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P "Salih-123" -C -d srcdb -Q "SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE'" | findstr /C:"[0-9]"
if errorlevel 1 (
    echo UYARI: Tablolar bulunamadi, ama backend migration yapacak.
) else (
    echo [OK] Veritabani tablolari mevcut
)

cd ..\..

:START_BACKEND
echo.
echo Backend baslatiliyor...
cd src\SRC.Presentation.Api
start "SRC_BACKEND" cmd /k "cd /d %CD% && echo ======================================== && echo   SRC BACKEND - http://localhost:5000 && echo   Swagger: http://localhost:5000/swagger && echo ======================================== && echo. && echo Migration'lar kontrol ediliyor... && echo. && dotnet run --urls http://localhost:5000"
cd ..\..

echo.
echo ================================================
echo   TAMAMLANDI
echo ================================================
echo.
echo Backend yeni pencerede baslatildi.
echo Migration'lar backend tarafindan kontrol edilecek.
echo.
echo Eger migration hatasi gorurseniz:
echo - Backend penceresini kapatmayin
echo - Backend otomatik tekrar deneyecek (max 60 saniye)
echo - 1-2 dakika bekleyin
echo.
pause

