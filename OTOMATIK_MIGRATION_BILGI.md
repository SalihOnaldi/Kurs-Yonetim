# ✅ Otomatik Migration Sistemi

## 🎯 Ne Değişti?

`basla.bat` dosyası artık **migration'ı otomatik olarak uyguluyor**!

### Yapılan Değişiklikler:

1. ✅ **EF Core Tools Kontrolü**: Script başlangıçta `dotnet-ef` tool'unun yüklü olup olmadığını kontrol ediyor, yoksa otomatik yüklüyor.

2. ✅ **Otomatik Migration**: Backend başlatılmadan önce migration otomatik olarak uygulanıyor.

3. ✅ **Retry Mekanizması**: SQL Server hazır olana kadar otomatik olarak tekrar deniyor (max 60 saniye).

4. ✅ **Hata Yönetimi**: Migration başarısız olursa alternatif çözümler gösteriliyor.

---

## 🚀 Kullanım

Artık sadece `basla.bat` çalıştırmanız yeterli:

```batch
basla.bat
```

Script şunları otomatik yapacak:

1. ✅ Docker container'ları kontrol eder/başlatır
2. ✅ EF Core Tools'u kontrol eder/yükler
3. ✅ **Migration'ı otomatik uygular** ⭐
4. ✅ Backend'i başlatır
5. ✅ Frontend'i başlatır

---

## 📋 Migration Süreci

Script çalıştığında şu adımlar gerçekleşir:

```
[2/5] Veritabani hazirlaniyor...
[2.5/5] EF Core Tools kontrol ediliyor...
[OK] EF Core Tools mevcut
[2.6/5] Migration uygulaniyor...
Migration deneniyor... (1/12)
[OK] Migration basarili
```

---

## ⚠️ Sorun Giderme

### Migration Başarısız Olursa:

1. **SQL Server Çalışıyor mu?**
   ```powershell
   docker ps | findstr sql
   ```

2. **Manuel Migration Uygulama:**
   - `apply_migration.bat` çalıştırın
   - VEYA `APPLY_MIGRATION.sql` dosyasını SQL Server Management Studio'da çalıştırın

3. **EF Core Tools Yüklü mü?**
   ```powershell
   dotnet tool list -g
   ```
   Yüklü değilse:
   ```powershell
   dotnet tool install --global dotnet-ef
   ```

---

## 🔍 Kontrol

Migration başarılı olduysa, SQL Server Management Studio'da:

```sql
SELECT COLUMN_NAME, DATA_TYPE 
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_NAME = 'Tenants' 
AND COLUMN_NAME IN ('Username', 'PasswordHash', 'ExpireDate');
```

**Beklenen Sonuç:** 3 satır (Username, PasswordHash, ExpireDate)

---

## 📝 Notlar

- Migration **idempotent** (güvenli) - Birden fazla kez çalıştırabilirsiniz
- Mevcut veriler **korunur** - Hiçbir veri silinmez
- Migration sadece **yeni kolonlar** ekler
- Backend'in `Program.cs`'inde de migration var (çift koruma)

---

## 🎉 Sonuç

Artık **hiçbir şey yapmanıza gerek yok!** Sadece `basla.bat` çalıştırın ve sistem hazır! 🚀

