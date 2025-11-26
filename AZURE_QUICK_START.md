# 🚀 Azure Quick Start Guide

## ⚡ Hızlı Başlangıç (30 Dakika)

### 1. Azure SQL Database Oluştur (10 dk)

```bash
# Azure Portal: https://portal.azure.com
# 1. "Create a resource" → "SQL Database"
# 2. Database name: srcdb
# 3. Server: Yeni oluştur (src-server-xxx)
# 4. Admin: srcadmin / Güçlü şifre
# 5. Service tier: Free
# 6. Firewall: "Allow Azure services" → ON
```

**Connection String Al:**
```
Server=tcp:src-server-xxx.database.windows.net,1433;Initial Catalog=srcdb;User ID=srcadmin;Password=YourPassword;Encrypt=True;TrustServerCertificate=False;Connection Timeout=30;
```

---

### 2. Azure App Service Oluştur (10 dk)

```bash
# Azure Portal
# 1. "Create a resource" → "Web App"
# 2. Name: src-backend-xxx
# 3. Runtime: .NET 8
# 4. Plan: Free F1
# 5. Region: West Europe
```

**GitHub Deployment:**
- Deployment Center → GitHub → Repository seç
- Branch: `main`
- Root directory: `V1/src/SRC.Presentation.Api`
- Build provider: GitHub Actions

**Publish Profile:**
- App Service → "Get publish profile" → İndir
- GitHub → Secrets → `AZURE_WEBAPP_PUBLISH_PROFILE` → Yapıştır

---

### 3. Environment Variables (5 dk)

Azure Portal → App Service → Configuration → Application settings:

```env
ConnectionStrings__DefaultConnection = <Azure SQL connection string>
JWT_SECRET = MySuperSecretKey12345678901234567890
ASPNETCORE_ENVIRONMENT = Production
CORS__AllowedOrigins__0 = https://your-frontend.vercel.app
```

**Save** → App Service yeniden başlar

---

### 4. Database Migration (5 dk)

**Yöntem A: EF Core (Önerilen)**
```bash
cd V1/src/SRC.Presentation.Api
dotnet ef database update --project ../SRC.Infrastructure --connection "<Azure SQL connection string>"
```

**Yöntem B: Azure Portal Query Editor**
- SQL Database → Query editor → Login
- Migration SQL dosyalarını çalıştır

---

### 5. Frontend Deploy (Vercel) (5 dk)

```bash
# Vercel: https://vercel.com
# 1. GitHub ile giriş
# 2. "Add New Project"
# 3. Repository seç
# 4. Root Directory: V1/frontend
# 5. Environment Variable:
#    NEXT_PUBLIC_API_URL = https://src-backend-xxx.azurewebsites.net/api
```

---

## ✅ Test

### Backend:
```bash
# Swagger
https://src-backend-xxx.azurewebsites.net/swagger

# Login Test
curl -X POST https://src-backend-xxx.azurewebsites.net/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"Admin123!"}'
```

### Frontend:
```
https://your-app.vercel.app
```

---

## 🔧 GitHub Actions Workflow

`.github/workflows/azure-deploy.yml` dosyasını oluştur ve `AZURE_WEBAPP_NAME` değerini güncelle:

```yaml
env:
  AZURE_WEBAPP_NAME: src-backend-xxx  # Buraya Azure App Service adını yaz
```

---

## 📋 Detaylı Checklist

Tüm adımlar için: `AZURE_DEPLOYMENT_CHECKLIST.md` dosyasına bak.

---

## 🆘 Hızlı Sorun Giderme

### Database Bağlantı Hatası:
- Firewall ayarlarını kontrol et
- `Encrypt=True` olduğundan emin ol

### Deployment Hatası:
- GitHub Actions loglarını kontrol et
- Root directory: `V1/src/SRC.Presentation.Api`

### CORS Hatası:
- `CORS__AllowedOrigins__0` değerini kontrol et
- App Service yeniden başlat

---

## 💰 Maliyet

**İlk Ay (Ücretsiz):**
- SQL Database Free: $0
- App Service Free: $0
- **Toplam**: $0

**Büyüme Sonrası:**
- SQL Database Basic: ~$5-15/ay
- App Service Basic: ~$13/ay
- **Toplam**: ~$20-30/ay

---

**Hazırsın! 🚀**

