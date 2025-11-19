# 🔧 Migration Uygulama Talimatları

## ⚠️ HATA: "Invalid column name 'Username', 'ExpireDate', 'PasswordHash'"

Bu hata, migration'ın henüz veritabanına uygulanmadığını gösteriyor.

---

## ✅ ÇÖZÜM 1: Otomatik Script (ÖNERİLEN)

### Adım 1: Script'i Çalıştır
`apply_migration.bat` dosyasına çift tıklayın veya PowerShell'de:

```powershell
cd "C:\Users\0000K04-ULPC-01\Desktop\SRC Projesi\ProjeDosyasi\V1"
.\apply_migration.bat
```

### Adım 2: Backend'i Yeniden Başlat
Migration uygulandıktan sonra backend'i yeniden başlatın.

---

## ✅ ÇÖZÜM 2: Manuel SQL Script (Hızlı)

### Adım 1: SQL Server Management Studio'yu Aç
1. SQL Server Management Studio'yu açın
2. Veritabanına bağlanın:
   - **Server:** `localhost,1433`
   - **Authentication:** SQL Server Authentication
   - **Login:** `sa`
   - **Password:** `Salih-123`

### Adım 2: SQL Script'i Çalıştır
1. `APPLY_MIGRATION.sql` dosyasını açın
2. Tüm içeriği seçin (Ctrl+A)
3. Execute (F5) tuşuna basın

### Adım 3: Kontrol
Script çalıştıktan sonra şu sorguyu çalıştırın:

```sql
SELECT COLUMN_NAME, DATA_TYPE 
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_NAME = 'Tenants' 
AND COLUMN_NAME IN ('Username', 'PasswordHash', 'ExpireDate');
```

**Beklenen Sonuç:** 3 satır döndürmeli:
- Username (nvarchar)
- PasswordHash (nvarchar)
- ExpireDate (datetime2)

---

## ✅ ÇÖZÜM 3: Dotnet EF CLI (Gelişmiş)

PowerShell'de:

```powershell
cd "C:\Users\0000K04-ULPC-01\Desktop\SRC Projesi\ProjeDosyasi\V1"
dotnet ef database update --project src\SRC.Infrastructure\SRC.Infrastructure.csproj --startup-project src\SRC.Presentation.Api\SRC.Presentation.Api.csproj
```

---

## 🔍 KONTROL

Migration başarılı olduysa:

1. ✅ `Tenants` tablosunda `Username`, `PasswordHash`, `ExpireDate` kolonları var
2. ✅ `AccountTransactions` tablosu oluşturuldu
3. ✅ Index'ler eklendi

---

## 🚀 SONRAKI ADIMLAR

1. ✅ Migration'ı uygulayın (yukarıdaki yöntemlerden biri)
2. ✅ Backend'i yeniden başlatın (`basla.bat` veya manuel)
3. ✅ Frontend'i yenileyin (F5)
4. ✅ HQ Dashboard'a gidin: http://localhost:3000/hq/dashboard
5. ✅ "Yeni Lisans Ekle" butonunu test edin

---

## ❓ SORUN DEVAM EDERSE

Eğer hata devam ederse:

1. **Backend loglarını kontrol edin** - Hangi migration uygulanıyor?
2. **Veritabanı bağlantısını kontrol edin** - `appsettings.json` doğru mu?
3. **SQL Server'ın çalıştığından emin olun** - Docker container'ı çalışıyor mu?

```powershell
# Docker container kontrolü
docker ps | findstr sql
```

---

## 📝 NOTLAR

- Migration **idempotent** (güvenli) - Birden fazla kez çalıştırabilirsiniz
- Mevcut veriler **korunur** - Hiçbir veri silinmez
- Migration sadece **yeni kolonlar** ekler

