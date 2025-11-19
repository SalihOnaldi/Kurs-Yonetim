@echo off
echo ============================================
echo MIGRATION UYGULAMA
echo ============================================
echo.

cd /d "%~dp0"

echo [1/2] Migration uygulanıyor...
set "CONN=Server=localhost,1433;Database=srcdb;User Id=sa;Password=S8P2prTO3d6ySTPiQnCt;TrustServerCertificate=true;Encrypt=false;Connection Timeout=60;MultipleActiveResultSets=true;"
dotnet ef database update --project src\SRC.Infrastructure\SRC.Infrastructure.csproj --startup-project src\SRC.Presentation.Api\SRC.Presentation.Api.csproj --connection "%CONN%"

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ============================================
    echo MIGRATION BASARILI!
    echo ============================================
    echo.
    echo Backend'i yeniden baslatin ve test edin.
) else (
    echo.
    echo ============================================
    echo MIGRATION HATASI!
    echo ============================================
    echo.
    echo Alternatif cozum: SQL Server Management Studio'da
    echo APPLY_MIGRATION.sql dosyasini calistirin.
    echo.
)

pause

