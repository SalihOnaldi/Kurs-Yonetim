# 🎯 Azure Deployment Rehberi (SQL Server ile - ÖNERİLEN)

## 💡 Neden Azure?

✅ **SQL Server kullanmaya devam edersin** (PostgreSQL geçişi yok)  
✅ **Ücretsiz başla**, paralı plana kolay geçiş  
✅ **Aynı teknoloji stack** (SQL Server → SQL Server)  
✅ **Geçiş zorluğu yok** - sadece plan değişikliği  
✅ **Microsoft ekosistemi** - .NET ile mükemmel entegrasyon  

### ⚠️ PostgreSQL'den SQL Server'a Geçiş Zor mu?

**Evet, orta-zor seviyede!** (4/5)

- 🔄 **Veri migration** gerekir (4-8 saat)
- 📝 **EF Core migration'ları** yeniden oluşturulmalı
- 🔧 **Kod değişiklikleri** gerekir
- ⚠️ **Downtime** riski var
- 🧪 **Test** şart

**Detaylı bilgi için**: `POSTGRESQL_TO_SQLSERVER_MIGRATION.md` dosyasına bak.

**Öneri**: Eğer SQL Server kullanmaya devam edeceksen, baştan Azure SQL Database kullan. PostgreSQL'e geçip sonra SQL Server'a dönmek yerine direkt SQL Server ile başla.  

---

## 📊 Maliyet Karşılaştırması

### Ücretsiz Tier (Başlangıç)
- **Azure SQL Database**: Free tier (32 GB, 1 yıl ücretsiz)
- **Azure App Service**: Free tier (F1 - 1 GB RAM, 1 GB storage)
- **Azure Storage**: 5 GB ücretsiz (dosyalar için)
- **Toplam**: $0/ay (ilk yıl)

### Paralı Plan (Büyüme)
- **Azure SQL Database**: Basic ($5-15/ay)
- **Azure App Service**: Basic B1 ($13/ay)
- **Azure Storage**: Standart ($0.02/GB)
- **Toplam**: ~$20-30/ay (küçük-orta ölçek)

---

## 🚀 Adım Adım Deployment

### 1️⃣ Azure Hesabı Oluştur

1. **Azure'a Kayıt**
   - https://azure.microsoft.com/free adresine git
   - Microsoft hesabınla kayıt ol
   - Kredi kartı gerekir (ücret alınmaz, sadece doğrulama)

2. **Ücretsiz Kredi**
   - İlk 30 gün $200 kredi verilir
   - 12 ay ücretsiz servisler

---

### 2️⃣ SQL Server Database Oluştur

1. **Azure Portal'a Git**
   - https://portal.azure.com

2. **SQL Database Oluştur**
   - "Create a resource" → "SQL Database"
   - **Basics**:
     - Subscription: Free Trial (veya kendi subscription'ın)
     - Resource group: Yeni oluştur (örn: `src-rg`)
     - Database name: `srcdb`
     - Server: Yeni oluştur
       - Server name: `src-server-[rastgele]` (benzersiz olmalı)
       - Location: `West Europe` (Türkiye'ye yakın)
       - Authentication: SQL authentication
       - Admin username: `srcadmin`
       - Password: Güçlü bir şifre (kaydet!)
     - Want to use SQL elastic pool: **No**
   - **Compute + storage**:
     - Service tier: **Free** (veya Basic - $5/ay)
     - Compute tier: Serverless (Free tier için)
   - **Review + create** → **Create**

3. **Firewall Ayarları**
   - Database oluştuktan sonra:
   - "Set server firewall" → "Add client IPv4 address"
   - "Allow Azure services and resources to access this server" → **ON**
   - **Save**

4. **Connection String Al**
   - Database'e git → "Connection strings"
   - ADO.NET connection string'i kopyala
   - Format:
     ```
     Server=tcp:src-server-xxx.database.windows.net,1433;Initial Catalog=srcdb;Persist Security Info=False;User ID=srcadmin;Password=YourPassword;MultipleActiveResultSets=False;Encrypt=True;TrustServerCertificate=False;Connection Timeout=30;
     ```

---

### 3️⃣ Backend Deploy (Azure App Service)

#### Yöntem A: Azure Portal (Kolay)

1. **App Service Oluştur**
   - "Create a resource" → "Web App"
   - **Basics**:
     - Subscription: Aynı subscription
     - Resource group: Aynı resource group (`src-rg`)
     - Name: `src-backend-[rastgele]` (benzersiz)
     - Publish: **Code**
     - Runtime stack: **.NET 8**
     - Operating System: **Windows** (veya Linux)
     - Region: `West Europe`
   - **App Service Plan**:
     - Plan: **Free F1** (veya Basic B1 - paralı)
   - **Review + create** → **Create**

2. **GitHub Deployment**
   - App Service oluştuktan sonra:
   - "Deployment Center" → "GitHub"
   - GitHub hesabını bağla
   - Repository seç
   - Branch: `main` (veya `master`)
   - **Build provider**: GitHub Actions
   - **Root directory**: `V1/src/SRC.Presentation.Api`
   - **Save**

3. **Environment Variables**
   - "Configuration" → "Application settings"
   - **New application setting** ekle:
     ```
     Name: ConnectionStrings__DefaultConnection
     Value: <Azure SQL connection string>
     ```
     ```
     Name: ASPNETCORE_ENVIRONMENT
     Value: Production
     ```
     ```
     Name: JWT_SECRET
     Value: <32 karakterlik güçlü secret>
     ```
     ```
     Name: CORS__AllowedOrigins__0
     Value: https://your-frontend.vercel.app
     ```

#### Yöntem B: Azure CLI (Gelişmiş)

```bash
# Azure CLI kurulum (Windows)
winget install -e --id Microsoft.AzureCLI

# Login
az login

# Resource group oluştur
az group create --name src-rg --location westeurope

# App Service plan oluştur (Free)
az appservice plan create --name src-plan --resource-group src-rg --sku FREE --is-linux

# Web App oluştur
az webapp create --resource-group src-rg --plan src-plan --name src-backend-xxx --runtime "DOTNET|8.0"

# GitHub deployment
az webapp deployment source config --name src-backend-xxx --resource-group src-rg --repo-url https://github.com/yourusername/yourrepo --branch main --manual-integration

# Environment variables
az webapp config appsettings set --resource-group src-rg --name src-backend-xxx --settings ConnectionStrings__DefaultConnection="<connection-string>" ASPNETCORE_ENVIRONMENT="Production"
```

---

### 4️⃣ Frontend Deploy (Vercel - Ücretsiz)

1. **Vercel'a Git**
   - https://vercel.com → GitHub ile giriş

2. **Project Import**
   - "Add New Project"
   - Repository seç
   - **Root Directory**: `V1/frontend`
   - Framework: Next.js (otomatik)

3. **Environment Variables**
   ```
   NEXT_PUBLIC_API_URL=https://src-backend-xxx.azurewebsites.net
   ```

4. **Deploy**
   - Otomatik deploy başlar
   - URL: `https://your-app.vercel.app`

---

### 5️⃣ Database Migration

Azure SQL Database'e migration uygula:

**Yöntem A: Azure Portal (SQL Query)**

1. Azure Portal → SQL Database → "Query editor"
2. Login: `srcadmin` / Password
3. Migration SQL dosyalarını çalıştır

**Yöntem B: EF Core Migration**

```bash
cd V1/src/SRC.Presentation.Api
dotnet ef database update --project ../SRC.Infrastructure --connection "<Azure SQL connection string>"
```

**Yöntem C: SQL Server Management Studio**

1. SSMS'i aç
2. Azure SQL Server'a bağlan:
   - Server: `src-server-xxx.database.windows.net`
   - Authentication: SQL Server Authentication
   - Login: `srcadmin`
   - Password: `<şifre>`
3. Migration scriptlerini çalıştır

---

## 🔄 Paralı Plana Geçiş (Büyüme)

### SQL Database Upgrade

1. Azure Portal → SQL Database → "Scale"
2. **Service tier**: Basic → Standard → Premium
3. **Compute tier**: DTU veya vCore seç
4. **Apply** → Otomatik geçiş (downtime yok)

### App Service Upgrade

1. Azure Portal → App Service → "Scale up"
2. **Pricing tier**: Free → Basic → Standard
3. **Apply** → Yeniden başlatma gerekir (1-2 dakika)

**Geçiş Zorluğu**: ⭐⭐⭐⭐⭐ (5/5 - Çok Kolay)
- Sadece plan değişikliği
- Kod değişikliği yok
- SQL Server → SQL Server (aynı teknoloji)

---

## 📊 Maliyet Özeti

### Başlangıç (Ücretsiz)
- SQL Database Free: $0/ay (1 yıl)
- App Service Free: $0/ay
- Storage: $0/ay (5 GB dahil)
- **Toplam**: $0/ay

### Küçük Ölçek (~100 kullanıcı)
- SQL Database Basic: $5/ay
- App Service Basic: $13/ay
- Storage: $1/ay
- **Toplam**: ~$19/ay

### Orta Ölçek (~1000 kullanıcı)
- SQL Database Standard S2: $75/ay
- App Service Standard S1: $55/ay
- Storage: $5/ay
- **Toplam**: ~$135/ay

---

## ✅ Avantajlar

1. **SQL Server Kullanmaya Devam**: PostgreSQL geçişi yok
2. **Kolay Geçiş**: Plan değişikliği ile büyüme
3. **Microsoft Ekosistemi**: .NET ile mükemmel entegrasyon
4. **Güvenlik**: Azure'un güvenlik özellikleri
5. **Backup**: Otomatik backup (paralı planlarda)
6. **Monitoring**: Azure Monitor ile izleme

---

## ⚠️ Dikkat Edilmesi Gerekenler

1. **Free Tier Limitleri**:
   - SQL Database: 32 GB max, 1 yıl ücretsiz
   - App Service: 1 GB RAM, CPU limitleri var
   - İlk yıl sonrası ücret alınabilir

2. **Connection String**:
   - `Encrypt=True` olmalı (Azure zorunlu)
   - `TrustServerCertificate=False` olmalı

3. **CORS Ayarları**:
   - Frontend URL'ini eklemeyi unutma

4. **Environment Variables**:
   - Production'da güçlü JWT secret kullan

---

## 🆘 Sorun Giderme

### Database Bağlantı Hatası
- Firewall ayarlarını kontrol et
- Connection string'i kontrol et
- `Encrypt=True` olduğundan emin ol

### Deployment Hatası
- GitHub Actions loglarını kontrol et
- Build hatası varsa `V1/src/SRC.Presentation.Api` root directory'yi kontrol et

### Performance Sorunları
- Free tier limitlerini kontrol et
- Basic plana geçiş yap

---

## 📚 Kaynaklar

- Azure Free Account: https://azure.microsoft.com/free
- Azure SQL Database Docs: https://docs.microsoft.com/azure/sql-database
- Azure App Service Docs: https://docs.microsoft.com/azure/app-service

---

**Sonuç**: Azure, SQL Server kullanmaya devam etmek ve kolay geçiş için en iyi seçenek! 🚀

