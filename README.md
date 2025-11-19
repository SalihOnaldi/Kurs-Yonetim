# SRC Kurs Yönetim Sistemi

Modern web tabanlı SRC kurs yönetim ve otomasyon sistemi.

## 🚀 Hızlı Başlangıç

### Gereksinimler

- .NET 8 SDK
- Node.js 18+ ve npm
- Docker Desktop (SQL Server ve MinIO için)

### Kurulum

1. Projeyi klonlayın veya indirin
2. `BASLA.bat` dosyasını çalıştırın

Bu script otomatik olarak:
- Docker container'larını başlatır (SQL Server + MinIO)
- Veritabanı migration'larını uygular
- Backend'i başlatır (http://localhost:5000)
- Frontend'i başlatır (http://localhost:3000)

### Giriş Bilgileri

- **Kullanıcı Adı:** admin
- **Şifre:** admin123

## 📁 Proje Yapısı

```
├── src/
│   ├── SRC.Domain/              # Domain katmanı (Entities)
│   ├── SRC.Application/         # Application katmanı (DTOs, Interfaces)
│   ├── SRC.Infrastructure/       # Infrastructure katmanı (EF Core, Services)
│   └── SRC.Presentation.Api/     # API katmanı (Controllers)
├── frontend/                     # Next.js 15 frontend
├── ops/
│   └── docker/
│       └── docker-compose.yml   # Docker servisleri
└── BASLA.bat                     # Tek tık kurulum scripti
```

## 🛠️ Teknoloji Stack

### Backend
- .NET 8
- Entity Framework Core 8
- SQL Server
- Hangfire (Background Jobs)
- MinIO (File Storage)
- JWT Authentication
- Serilog

### Frontend
- Next.js 15
- TypeScript
- Tailwind CSS
- React Query
- Axios

## 🔧 Manuel Kurulum

### Backend

```bash
cd src/SRC.Presentation.Api
dotnet restore
dotnet ef migrations add InitialCreate --project ../SRC.Infrastructure/SRC.Infrastructure.csproj
dotnet ef database update --project ../SRC.Infrastructure/SRC.Infrastructure.csproj
dotnet run --urls http://localhost:5000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

### Docker Servisleri

```bash
cd ops/docker
docker compose up -d
```

## 📚 API Dokümantasyonu

Swagger UI: http://localhost:5000/swagger

## 🧪 Test Endpoints

### Authentication
- `POST /api/auth/login` - Giriş yap
- `GET /api/auth/me` - Kullanıcı bilgisi

### Students
- `GET /api/students` - Tüm kursiyerleri listele
- `GET /api/students/{id}` - Kursiyer detayı
- `POST /api/students` - Yeni kursiyer ekle
- `PUT /api/students/{id}` - Kursiyer güncelle
- `DELETE /api/students/{id}` - Kursiyer sil
- `GET /api/students/{id}/documents` - Kursiyer evrakları
- `POST /api/students/{id}/documents` - Evrak yükle

## 📝 Özellikler

- ✅ Kursiyer (öğrenci) kayıt ve takip
- ✅ Evrak yükleme ve OCR işleme
- ✅ SRC kurs/grup yönetimi
- ✅ Ders programı ve yoklama
- ✅ Sınav yönetimi (yazılı/uygulama)
- ✅ MEBBIS aktarım (mock adapter)
- ✅ Ödeme ve bakiye takibi
- ✅ MEB formatlı raporlar

## 🔐 Güvenlik

- JWT tabanlı authentication
- BCrypt ile şifre hashleme
- CORS yapılandırması
- Role-based authorization (gelecek)

## 📄 Lisans

Bu proje özel bir projedir.

