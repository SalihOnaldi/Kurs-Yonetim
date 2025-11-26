# ✅ Azure Deployment Checklist

## 📋 Ön Hazırlık

- [ ] Azure hesabı oluşturuldu (https://azure.microsoft.com/free)
- [ ] Azure CLI kuruldu (opsiyonel, ama önerilir)
- [ ] GitHub repository hazır
- [ ] Local'de proje çalışıyor ve testler geçiyor

---

## 🗄️ 1. Azure SQL Database Oluştur

### Adımlar:
- [ ] Azure Portal'a git: https://portal.azure.com
- [ ] "Create a resource" → "SQL Database"
- [ ] **Basics**:
  - [ ] Subscription: Seç
  - [ ] Resource group: Yeni oluştur (`src-rg`)
  - [ ] Database name: `srcdb`
  - [ ] Server: Yeni oluştur
    - [ ] Server name: `src-server-[rastgele]` (benzersiz olmalı)
    - [ ] Location: `West Europe` veya `East US`
    - [ ] Authentication: SQL authentication
    - [ ] Admin username: `srcadmin` (veya istediğin)
    - [ ] Password: Güçlü şifre oluştur ve **KAYDET!**
  - [ ] Elastic pool: **No**
- [ ] **Compute + storage**:
  - [ ] Service tier: **Free** (veya Basic - $5/ay)
  - [ ] Compute tier: Serverless (Free tier için)
- [ ] **Review + create** → **Create**

### Firewall Ayarları:
- [ ] Database oluştuktan sonra: "Set server firewall"
- [ ] "Add client IPv4 address" → Ekle
- [ ] "Allow Azure services and resources to access this server" → **ON**
- [ ] **Save**

### Connection String Al:
- [ ] Database'e git → "Connection strings"
- [ ] ADO.NET connection string'i kopyala
- [ ] Format:
  ```
  Server=tcp:src-server-xxx.database.windows.net,1433;Initial Catalog=srcdb;Persist Security Info=False;User ID=srcadmin;Password=YourPassword;MultipleActiveResultSets=False;Encrypt=True;TrustServerCertificate=False;Connection Timeout=30;
  ```
- [ ] **NOT**: `Encrypt=True` ve `TrustServerCertificate=False` olmalı!

---

## 🚀 2. Azure App Service Oluştur

### Adımlar:
- [ ] "Create a resource" → "Web App"
- [ ] **Basics**:
  - [ ] Subscription: Aynı subscription
  - [ ] Resource group: Aynı resource group (`src-rg`)
  - [ ] Name: `src-backend-[rastgele]` (benzersiz olmalı)
  - [ ] Publish: **Code**
  - [ ] Runtime stack: **.NET 8**
  - [ ] Operating System: **Windows** (veya Linux)
  - [ ] Region: `West Europe` (SQL Database ile aynı)
- [ ] **App Service Plan**:
  - [ ] Plan: **Free F1** (veya Basic B1 - paralı)
- [ ] **Review + create** → **Create**

### GitHub Deployment:
- [ ] App Service oluştuktan sonra: "Deployment Center"
- [ ] Source: **GitHub**
- [ ] GitHub hesabını bağla
- [ ] Repository seç
- [ ] Branch: `main` (veya `master`)
- [ ] **Build provider**: GitHub Actions
- [ ] **Root directory**: `V1/src/SRC.Presentation.Api`
- [ ] **Save**

### Publish Profile Al (GitHub Actions için):
- [ ] App Service → "Get publish profile"
- [ ] Dosyayı indir
- [ ] GitHub → Repository → Settings → Secrets → Actions
- [ ] "New repository secret" → Name: `AZURE_WEBAPP_PUBLISH_PROFILE`
- [ ] Value: İndirdiğin publish profile dosyasının içeriğini yapıştır
- [ ] **Add secret**

### GitHub Actions Workflow Güncelle:
- [ ] `.github/workflows/azure-deploy.yml` dosyasını aç
- [ ] `AZURE_WEBAPP_NAME` değerini Azure App Service adınla değiştir
- [ ] Commit ve push

---

## ⚙️ 3. Environment Variables (App Service)

### Azure Portal'dan:
- [ ] App Service → "Configuration" → "Application settings"
- [ ] **New application setting** ekle:

#### Connection String:
- [ ] Name: `ConnectionStrings__DefaultConnection`
- [ ] Value: Azure SQL connection string (yukarıda aldığın)
- [ ] Type: **Custom**

#### JWT Secret:
- [ ] Name: `JWT_SECRET`
- [ ] Value: 32 karakterlik güçlü secret (örnek: `MySuperSecretKey123456789012`)
- [ ] Type: **Custom**

#### Environment:
- [ ] Name: `ASPNETCORE_ENVIRONMENT`
- [ ] Value: `Production`
- [ ] Type: **Custom**

#### CORS (Frontend URL'i):
- [ ] Name: `CORS__AllowedOrigins__0`
- [ ] Value: `https://your-frontend.vercel.app` (Frontend deploy edince güncelle)
- [ ] Type: **Custom**

#### S3/MinIO (Dosya Depolama):
- [ ] Name: `S3_ENDPOINT`
- [ ] Value: Azure Storage veya MinIO endpoint (şimdilik boş bırakabilirsin)
- [ ] Type: **Custom**

- [ ] Name: `S3_BUCKET`
- [ ] Value: `files`
- [ ] Type: **Custom**

- [ ] Name: `S3_ACCESS_KEY`
- [ ] Value: Azure Storage access key (şimdilik boş bırakabilirsin)
- [ ] Type: **Custom**

- [ ] Name: `S3_SECRET_KEY`
- [ ] Value: Azure Storage secret key (şimdilik boş bırakabilirsin)
- [ ] Type: **Custom**

#### Diğer Ayarlar:
- [ ] Name: `OCR_ENABLED`
- [ ] Value: `false` (Production'da genelde kapalı)
- [ ] Type: **Custom**

- [ ] Name: `MEBBIS_ADAPTER`
- [ ] Value: `mock` (veya gerçek adapter)
- [ ] Type: **Custom**

- [ ] **Save** → App Service yeniden başlatılacak

---

## 🗄️ 4. Database Migration

### Yöntem A: EF Core Migration (Önerilen)

- [ ] Local'de Azure SQL'e bağlan:
  ```bash
  cd V1/src/SRC.Presentation.Api
  dotnet ef database update --project ../SRC.Infrastructure --connection "<Azure SQL connection string>"
  ```

### Yöntem B: Azure Portal Query Editor

- [ ] Azure Portal → SQL Database → "Query editor"
- [ ] Login: `srcadmin` / Password
- [ ] Migration SQL dosyalarını çalıştır:
  - [ ] `V1/src/SRC.Infrastructure/Migrations/` klasöründeki tüm migration dosyalarını sırayla çalıştır

### Yöntem C: SQL Server Management Studio (SSMS)

- [ ] SSMS'i aç
- [ ] Azure SQL Server'a bağlan:
  - [ ] Server: `src-server-xxx.database.windows.net`
  - [ ] Authentication: SQL Server Authentication
  - [ ] Login: `srcadmin`
  - [ ] Password: `<şifre>`
- [ ] Migration scriptlerini çalıştır

### Migration Sonrası Kontrol:
- [ ] Tablolar oluşturuldu mu? (`Students`, `Enrollments`, `Payments`, vb.)
- [ ] Seed data var mı? (İlk admin kullanıcı oluşturuldu mu?)

---

## 🌐 5. Frontend Deploy (Vercel)

### Vercel Setup:
- [ ] https://vercel.com → GitHub ile giriş
- [ ] "Add New Project"
- [ ] Repository seç
- [ ] **Root Directory**: `V1/frontend`
- [ ] Framework: Next.js (otomatik algılanır)

### Environment Variables:
- [ ] Name: `NEXT_PUBLIC_API_URL`
- [ ] Value: `https://src-backend-xxx.azurewebsites.net/api`
- [ ] **Save**

### Deploy:
- [ ] "Deploy" → Otomatik deploy başlar
- [ ] URL: `https://your-app.vercel.app`

### Backend CORS Güncelle:
- [ ] Azure Portal → App Service → Configuration
- [ ] `CORS__AllowedOrigins__0` değerini Vercel URL'i ile güncelle
- [ ] **Save**

---

## ✅ 6. Test ve Doğrulama

### Backend Test:
- [ ] Backend URL'i aç: `https://src-backend-xxx.azurewebsites.net`
- [ ] Swagger açılmalı: `https://src-backend-xxx.azurewebsites.net/swagger`
- [ ] Health check: `https://src-backend-xxx.azurewebsites.net/api/health` (varsa)

### Database Bağlantı Test:
- [ ] Login endpoint'i test et:
  ```bash
  curl -X POST https://src-backend-xxx.azurewebsites.net/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"username":"admin","password":"Admin123!"}'
  ```
- [ ] Token dönmeli

### Frontend Test:
- [ ] Frontend URL'i aç: `https://your-app.vercel.app`
- [ ] Login sayfası açılmalı
- [ ] Backend'e bağlanabilmeli
- [ ] Login yapabilmeli

### CORS Test:
- [ ] Frontend'den API çağrısı yap
- [ ] CORS hatası olmamalı

---

## 🔧 7. Son Ayarlar

### Logging:
- [ ] Azure Portal → App Service → "Log stream"
- [ ] Loglar görünüyor mu?

### Monitoring:
- [ ] Azure Portal → App Service → "Metrics"
- [ ] CPU, Memory kullanımını kontrol et

### Backup (Paralı Plan):
- [ ] Azure Portal → SQL Database → "Backups"
- [ ] Otomatik backup açık mı?

### Custom Domain (Opsiyonel):
- [ ] App Service → "Custom domains"
- [ ] Domain ekle ve SSL sertifikası yapılandır

---

## 🆘 Sorun Giderme

### Database Bağlantı Hatası:
- [ ] Firewall ayarlarını kontrol et
- [ ] Connection string'i kontrol et (`Encrypt=True` olmalı)
- [ ] App Service'in IP'sini SQL Database firewall'a ekle

### Deployment Hatası:
- [ ] GitHub Actions loglarını kontrol et
- [ ] Build hatası varsa local'de test et
- [ ] Root directory doğru mu? (`V1/src/SRC.Presentation.Api`)

### CORS Hatası:
- [ ] `CORS__AllowedOrigins__0` değerini kontrol et
- [ ] Frontend URL'i doğru mu?
- [ ] App Service yeniden başlatıldı mı?

### Performance Sorunları:
- [ ] Free tier limitlerini kontrol et
- [ ] Basic plana geçiş yapabilirsin

---

## 📊 Maliyet Takibi

### İlk Ay (Ücretsiz):
- [ ] SQL Database Free: $0
- [ ] App Service Free: $0
- [ ] **Toplam**: $0

### Büyüme Sonrası:
- [ ] SQL Database Basic: ~$5-15/ay
- [ ] App Service Basic: ~$13/ay
- [ ] **Toplam**: ~$20-30/ay

---

## ✅ Deployment Tamamlandı!

Artık sisteminiz Azure'da çalışıyor! 🎉

**Backend**: `https://src-backend-xxx.azurewebsites.net`  
**Frontend**: `https://your-app.vercel.app`  
**Database**: Azure SQL Database

---

## 📚 Kaynaklar

- Azure Portal: https://portal.azure.com
- Azure SQL Database Docs: https://docs.microsoft.com/azure/sql-database
- Azure App Service Docs: https://docs.microsoft.com/azure/app-service
- Vercel Docs: https://vercel.com/docs

