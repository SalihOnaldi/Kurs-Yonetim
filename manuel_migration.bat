@echo off
chcp 65001 >nul
echo ============================================
echo MANUEL MIGRATION UYGULAMA
echo ============================================
echo.

REM SQL Server bağlantısını test et
echo SQL Server baglantisi test ediliyor...
sqlcmd -S localhost,1433 -U sa -P "Salih-123" -Q "SELECT @@VERSION" -C >nul 2>&1
if errorlevel 1 (
    echo.
    echo HATA: SQL Server'a baglanilamadi!
    echo Docker container'inin calistigindan emin olun: docker ps
    echo.
    pause
    exit /b 1
)

echo [OK] SQL Server baglantisi basarili
echo.

REM SQL script'ini çalıştır
echo APPLY_MIGRATION.sql script'i uygulaniyor...
sqlcmd -S localhost,1433 -U sa -P "Salih-123" -d srcdb -i "%~dp0APPLY_MIGRATION.sql" -C

if errorlevel 1 (
    echo.
    echo HATA: SQL script'i calistirilamadi!
    echo.
    pause
    exit /b 1
)

echo.
echo [OK] Migration basarili!
echo.
pause

