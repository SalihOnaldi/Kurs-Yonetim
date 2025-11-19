@echo off
chcp 65001 >nul
title SQL Server Baglanti Testi
color 0A
cls

echo.
echo ╔═══════════════════════════════════════════════╗
echo ║  SQL Server Baglanti Testi                   ║
echo ╚═══════════════════════════════════════════════╝
echo.

echo [1] Container durumu kontrol ediliyor...
docker ps --filter "name=src-sqlserver"
echo.

echo [2] SQL Server loglarini kontrol ediliyor...
docker logs src-sqlserver --tail 5
echo.

echo [3] Baglanti testi yapiliyor...
docker exec src-sqlserver /opt/mssql-tools/bin/sqlcmd -S localhost -U sa -P "YourStrong@Passw0rd" -Q "SELECT @@VERSION" -C
if errorlevel 1 (
    echo.
    echo !!! HATA: Baglanti basarisiz!
    echo.
    echo Alternatif test deneniyor...
    docker exec src-sqlserver /opt/mssql-tools/bin/sqlcmd -S localhost -U sa -P "YourStrong@Passw0rd" -Q "SELECT 1" -C
) else (
    echo.
    echo ✓ Baglanti basarili!
)

echo.
echo [4] Container health durumu:
docker inspect src-sqlserver --format "{{.State.Health.Status}}" 2>nul
echo.

pause

