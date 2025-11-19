# 🔧 SORUN GİDERME REHBERİ

## ❌ TypeLoadException: Method 'get_LockReleaseBehavior' Hatası

### Sorun
```
System.TypeLoadException: Method 'get_LockReleaseBehavior' in type 'Microsoft.EntityFrameworkCore.SqlServer.Migrations.Internal.SqlServerHistoryRepository'...
```

### Neden
EF Core paket versiyonları uyumsuz. Farklı projelerde farklı EF Core versiyonları kullanılıyor.

### Çözüm ✅

**1. Presentation.Api projesindeki EF Core Design paketini güncelle:**
```xml
<!-- ÖNCE (YANLIŞ) -->
<PackageReference Include="Microsoft.EntityFrameworkCore.Design" Version="9.0.10" />

<!-- SONRA (DOĞRU) -->
<PackageReference Include="Microsoft.EntityFrameworkCore.Design" Version="8.0.0" />
```

**2. Temizlik ve yeniden derleme:**
```bash
cd "C:\Users\0000K04-ULPC-01\Desktop\SRC Projesi\ProjeDosyasi\V1"

# Temizle
dotnet clean SRC.CourseManagement.sln

# Yeniden yükle
dotnet restore SRC.CourseManagement.sln

# Derle
dotnet build SRC.CourseManagement.sln
```

**3. Backend'i tekrar başlat:**
```bash
cd src\SRC.Presentation.Api
dotnet run --urls http://localhost:5000
```

---

## ✅ DÜZELTME YAPILDI

**Değişiklikler:**
- ✅ `src/SRC.Presentation.Api/SRC.Presentation.Api.csproj` - EF Core Design 9.0.10 → 8.0.0
- ✅ `src/SRC.Infrastructure/SRC.Infrastructure.csproj` - Configuration.Abstractions 9.0.10 → 8.0.0

**Tüm EF Core paketleri artık 8.0.0 versiyonunda:**
- Microsoft.EntityFrameworkCore: 8.0.0
- Microsoft.EntityFrameworkCore.SqlServer: 8.0.0
- Microsoft.EntityFrameworkCore.Design: 8.0.0
- Microsoft.EntityFrameworkCore.Tools: 8.0.0

---

## 🚀 ŞİMDİ DENEYİN

1. **Backend'i başlatın:**
   ```bash
   cd src\SRC.Presentation.Api
   dotnet run --urls http://localhost:5000
   ```

2. **Frontend'i başlatın** (yeni terminal):
   ```bash
   cd frontend
   npm run dev
   ```

3. **Tarayıcıda test edin:**
   - http://localhost:5000/swagger
   - http://localhost:3000

---

## 📝 ÖNEMLİ NOTLAR

**Paket Versiyon Uyumluluğu:**
- Tüm EF Core paketleri aynı major versiyonda olmalı (8.0.x)
- .NET 8.0 kullanıyorsanız, EF Core 8.0.x kullanın
- Farklı versiyonlar TypeLoadException'a neden olur

**Gelecekte Paket Eklerken:**
- Yeni paket eklerken versiyonları kontrol edin
- Mümkünse aynı major versiyonu kullanın
- Örnek: EF Core 8.0.0, EF Core Design 8.0.0, EF Core SqlServer 8.0.0

---

**Sorun devam ederse:**
1. `bin` ve `obj` klasörlerini silin
2. `dotnet clean` ve `dotnet restore` çalıştırın
3. Visual Studio/Cursor'ı kapatıp tekrar açın

