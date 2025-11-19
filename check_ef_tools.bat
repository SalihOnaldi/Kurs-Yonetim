@echo off
echo EF Core Tools kontrol ediliyor...
dotnet tool list -g | findstr dotnet-ef >nul 2>&1
if errorlevel 1 (
    echo EF Core Tools bulunamadi, yukleniyor...
    dotnet tool install --global dotnet-ef
    if errorlevel 1 (
        echo HATA: EF Core Tools yuklenemedi!
        pause
        exit /b 1
    )
    echo [OK] EF Core Tools yuklendi
) else (
    echo [OK] EF Core Tools zaten yuklu
)

