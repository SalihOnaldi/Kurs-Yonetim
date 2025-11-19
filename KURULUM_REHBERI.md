# 📚 SRC KURS YÖNETİM SİSTEMİ - KURULUM VE ÇALIŞTIRMA REHBERİ

## 🎯 HIZLI BAŞLANGIÇ (Önerilen)

### Tek Tık Kurulum

1. **BASLA.bat** dosyasına çift tıklayın
2. Script otomatik olarak:
   - Docker container'larını başlatır (SQL Server + MinIO)
   - Veritabanı migration'larını uygular
   - Backend'i başlatır (http://localhost:5000)
   - Frontend'i başlatır (http://localhost:3000)

3. Tarayıcıda açın:
   - **Frontend:** http://localhost:3000
   - **Backend API:** http://localhost:5000
   - **Swagger UI:** http://localhost:5000/swagger
   - **Hangfire Dashboard:** http://localhost:5000/hangfire

4. **Giriş Bilgileri:**
   - Kullanıcı Adı: `admin`
   - Şifre: `admin123`

---

## 📋 MANUEL KURULUM (Adım Adım)

### 1. Gereksinimler

- ✅ .NET 8 SDK ([İndir](https://dotnet.microsoft.com/download/dotnet/8.0))
- ✅ Node.js 18+ ve npm ([İndir](https://nodejs.org/))
- ✅ Docker Desktop ([İndir](https://www.docker.com/products/docker-desktop))
- ✅ Git (opsiyonel)

### 2. Docker Servislerini Başlatma

```bash
# Terminal'de proje kök dizinine gidin
cd "C:\Users\0000K04-ULPC-01\Desktop\SRC Projesi\ProjeDosyasi\V1"

# Docker Compose ile servisleri başlatın
cd ops\docker
docker compose up -d

# VEYA docker-compose kullanıyorsanız:
docker-compose up -d
```

**Kontrol:**
- SQL Server: http://localhost:1433
- MinIO Console: http://localhost:9001 (minioadmin/minioadmin)

**Durdurma:**
```bash
docker compose down
```

### 3. Backend Kurulumu

```bash
# Proje kök dizinine dönün
cd ..\..

# NuGet paketlerini geri yükle
dotnet restore

# Veritabanı migration'larını oluştur (ilk kez)
dotnet ef migrations add InitialCreate --project src\SRC.Infrastructure\SRC.Infrastructure.csproj --startup-project src\SRC.Presentation.Api\SRC.Presentation.Api.csproj

# Veritabanını oluştur ve migration'ları uygula
dotnet ef database update --project src\SRC.Infrastructure\SRC.Infrastructure.csproj --startup-project src\SRC.Presentation.Api\SRC.Presentation.Api.csproj

# Backend'i çalıştır
cd src\SRC.Presentation.Api
dotnet run --urls http://localhost:5000
```

**Backend başarıyla çalışıyorsa:**
- ✅ http://localhost:5000/swagger - Swagger UI açılır
- ✅ Console'da "Now listening on: http://localhost:5000" mesajı görünür

### 4. Frontend Kurulumu

**YENİ Terminal açın** (Backend çalışırken):

```bash
# Proje kök dizinine gidin
cd "C:\Users\0000K04-ULPC-01\Desktop\SRC Projesi\ProjeDosyasi\V1"

# Frontend dizinine gidin
cd frontend

# Node modüllerini yükleyin (ilk kez)
npm install

# Frontend'i çalıştır
npm run dev
```

**Frontend başarıyla çalışıyorsa:**
- ✅ http://localhost:3000 - Web uygulaması açılır
- ✅ Console'da "Ready on http://localhost:3000" mesajı görünür

---

## 🔍 PROJE YAPISI

```
V1/
├── src/                          # Backend (.NET 8)
│   ├── SRC.Domain/              # Domain katmanı (Entities)
│   │   └── Entities/            # Veritabanı tabloları
│   ├── SRC.Application/         # Application katmanı
│   │   ├── DTOs/                # Veri transfer nesneleri
│   │   └── Interfaces/          # Servis interface'leri
│   ├── SRC.Infrastructure/      # Infrastructure katmanı
│   │   ├── Data/                # EF Core DbContext
│   │   └── Services/            # Servis implementasyonları
│   └── SRC.Presentation.Api/    # API katmanı
│       ├── Controllers/         # API endpoint'leri
│       ├── Program.cs           # Uygulama başlangıç noktası
│       └── appsettings.json     # Yapılandırma dosyası
├── frontend/                     # Frontend (Next.js 15)
│   ├── app/                     # Next.js App Router
│   │   ├── login/               # Login sayfası
│   │   ├── dashboard/           # Dashboard sayfası
│   │   └── students/            # Kursiyer listesi
│   ├── lib/                     # Yardımcı kütüphaneler
│   └── package.json             # NPM bağımlılıkları
├── ops/
│   └── docker/
│       └── docker-compose.yml   # Docker servisleri
├── BASLA.bat                     # Otomatik başlatma scripti
└── README.md                     # Proje dokümantasyonu
```

---

## ⚙️ YAPILANDIRMA

### Backend Yapılandırması

**Dosya:** `src/SRC.Presentation.Api/appsettings.json`

```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Server=localhost,1433;Database=srcdb;User Id=sa;Password=YourStrong@Passw0rd;TrustServerCertificate=true;"
  },
  "JWT_SECRET": "replace-with-32char-secret-key-min",
  "S3_ENDPOINT": "http://localhost:9000",
  "S3_BUCKET": "files",
  "S3_ACCESS_KEY": "minioadmin",
  "S3_SECRET_KEY": "minioadmin",
  "OCR_ENABLED": "true",
  "MEBBIS_ADAPTER": "mock"
}
```

**Önemli Notlar:**
- `JWT_SECRET`: Production'da mutlaka değiştirin (min 32 karakter)
- `ConnectionStrings`: SQL Server bağlantı bilgileri
- `S3_*`: MinIO dosya depolama ayarları

### Frontend Yapılandırması

**Dosya:** `frontend/.env.local` (oluşturmanız gerekebilir)

```env
NEXT_PUBLIC_API_URL=http://localhost:5000/api
```

---

## 🚀 ÇALIŞTIRMA SIRASI

### Senaryo 1: Otomatik (Önerilen)

1. `BASLA.bat` çalıştır
2. Bekle (1-2 dakika)
3. Tarayıcıda http://localhost:3000 aç

### Senaryo 2: Manuel

**Terminal 1 - Docker:**
```bash
cd ops\docker
docker compose up -d
```

**Terminal 2 - Backend:**
```bash
cd src\SRC.Presentation.Api
dotnet run --urls http://localhost:5000
```

**Terminal 3 - Frontend:**
```bash
cd frontend
npm run dev
```

---

## 🔧 SORUN GİDERME

### Problem: Docker container'ları başlamıyor

**Çözüm:**
```bash
# Docker Desktop'ın çalıştığından emin olun
docker ps

# Eğer hata varsa, logları kontrol edin
docker compose logs
```

### Problem: Backend başlamıyor - "Cannot connect to SQL Server"

**Çözüm:**
1. Docker container'ın çalıştığını kontrol edin:
   ```bash
   docker ps | findstr sqlserver
   ```

2. SQL Server'ın hazır olmasını bekleyin (30-60 saniye)

3. Connection string'i kontrol edin (`appsettings.json`)

### Problem: Frontend başlamıyor - "Cannot find module"

**Çözüm:**
```bash
cd frontend
rm -rf node_modules
npm install
```

### Problem: Migration hatası

**Çözüm:**
```bash
# Migration'ları sıfırla (DİKKAT: Veriler silinir!)
dotnet ef database drop --project src\SRC.Infrastructure\SRC.Infrastructure.csproj --startup-project src\SRC.Presentation.Api\SRC.Presentation.Api.csproj

# Migration'ları tekrar oluştur
dotnet ef migrations add InitialCreate --project src\SRC.Infrastructure\SRC.Infrastructure.csproj --startup-project src\SRC.Presentation.Api\SRC.Presentation.Api.csproj

# Uygula
dotnet ef database update --project src\SRC.Infrastructure\SRC.Infrastructure.csproj --startup-project src\SRC.Presentation.Api\SRC.Presentation.Api.csproj
```

### Problem: CORS hatası

**Çözüm:** `Program.cs` dosyasında CORS ayarlarını kontrol edin:
```csharp
policy.WithOrigins("http://localhost:3000")
```

Frontend'iniz farklı bir portta çalışıyorsa, burayı güncelleyin.

---

## 📝 ÖNEMLİ DOSYALAR

### Backend Dosyaları

| Dosya | Açıklama |
|-------|----------|
| `src/SRC.Presentation.Api/Program.cs` | Ana uygulama başlangıç noktası, DI container, middleware |
| `src/SRC.Presentation.Api/appsettings.json` | Yapılandırma ayarları |
| `src/SRC.Infrastructure/Data/SrcDbContext.cs` | EF Core veritabanı bağlamı |
| `src/SRC.Infrastructure/Data/SeedData.cs` | İlk kullanıcı (admin/admin123) |
| `src/SRC.Presentation.Api/Controllers/*.cs` | API endpoint'leri |

### Frontend Dosyaları

| Dosya | Açıklama |
|-------|----------|
| `frontend/app/login/page.tsx` | Giriş sayfası |
| `frontend/app/dashboard/page.tsx` | Ana dashboard |
| `frontend/app/students/page.tsx` | Kursiyer listesi |
| `frontend/lib/api.ts` | API client yapılandırması |

---

## 🧪 TEST ETME

### 1. Backend API Testi

**Swagger UI üzerinden:**
1. http://localhost:5000/swagger açın
2. `POST /api/auth/login` endpoint'ini deneyin:
   ```json
   {
     "username": "admin",
     "password": "admin123"
   }
   ```
3. Dönen token'ı kopyalayın
4. Sağ üstteki "Authorize" butonuna tıklayın
5. Token'ı `Bearer <token>` formatında girin
6. Diğer endpoint'leri test edin

### 2. Frontend Testi

1. http://localhost:3000 açın
2. Login sayfasında:
   - Kullanıcı: `admin`
   - Şifre: `admin123`
3. Giriş yaptıktan sonra Dashboard görünür
4. "Kursiyer Yönetimi" linkine tıklayın

---

## 🛑 DURDURMA

### Tüm Servisleri Durdurma

**Terminal'de:**
```bash
# Docker container'ları durdur
cd ops\docker
docker compose down

# Backend ve Frontend'i durdurmak için ilgili terminal pencerelerinde Ctrl+C
```

**Veya BASLA.bat ile başlattıysanız:**
- Backend ve Frontend pencerelerini kapatın
- Docker container'ları kapatmak için:
  ```bash
  docker compose -f ops\docker\docker-compose.yml down
  ```

---

## 📞 DESTEK

Sorun yaşarsanız:
1. Bu rehberi tekrar okuyun
2. Console loglarını kontrol edin
3. Docker loglarını kontrol edin: `docker compose logs`

---

## ✅ KONTROL LİSTESİ

Kurulum başarılı mı kontrol edin:

- [ ] Docker Desktop çalışıyor
- [ ] SQL Server container çalışıyor (`docker ps`)
- [ ] MinIO container çalışıyor (`docker ps`)
- [ ] Backend http://localhost:5000 adresinde çalışıyor
- [ ] Swagger UI açılıyor
- [ ] Frontend http://localhost:3000 adresinde çalışıyor
- [ ] Login sayfası açılıyor
- [ ] Admin kullanıcısı ile giriş yapılabiliyor

---

**İyi çalışmalar! 🚀**

