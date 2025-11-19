# Lisans Sistemi - Hazır! ✅

## 🎯 Yapılan Değişiklikler

### 1. Tenant (Lisans) Entity Güncellemeleri
- ✅ `Tenant` entity'sine `Username` eklendi (kurs için özel kullanıcı adı)
- ✅ `Tenant` entity'sine `PasswordHash` eklendi (kurs için özel şifre - BCrypt)
- ✅ `Tenant` entity'sine `ExpireDate` eklendi (lisans son kullanma tarihi)
- ✅ `Course` entity'sinden `ExpireDate` kaldırıldı (yanlış yere eklenmişti)

### 2. Tenant (Lisans) Login Sistemi
- ✅ `AuthController` güncellendi
- ✅ Normal kullanıcı girişi denenir, bulunamazsa tenant (lisans) girişi denenir
- ✅ Tenant şifresi ile giriş yapıldığında otomatik `BranchAdmin` kullanıcısı oluşturulur
- ✅ Lisans süresi kontrolü yapılır (süresi dolmuşsa giriş engellenir)

### 3. HQ Dashboard - Lisans Yönetimi
- ✅ "Yeni Kurs Ekle" yerine "Yeni Lisans Ekle" butonu
- ✅ Lisans ekleme modal'ı:
  - Kurs adı
  - Şehir (opsiyonel)
  - Kullanıcı adı (benzersiz)
  - Şifre
  - Lisans süresi (1, 2, 3, 5 yıl)
- ✅ Lisans listesi:
  - Kurs adı
  - Kullanıcı adı
  - Toplam/Aktif öğrenci sayısı
  - Son kullanma tarihi
  - Durum (Aktif, Süresi Dolmuş, Yakında Dolacak)

### 4. Cari Hesap Modülü
- ✅ `AccountTransaction` entity'si oluşturuldu
- ✅ Cari hesap sayfası (`/hq/accounts`)
- ✅ Lisans ödemeleri için "Lisans Ödemesi" kategorisi eklendi
- ✅ Gelir/Gider işlemleri takip edilebilir
- ✅ Özet kartlar (Toplam Gelir, Toplam Gider, Bakiye)

### 5. Migration
- ✅ `20251114120000_Add_CourseExpireDate_And_AccountTransaction.cs` düzenlendi
- ✅ `Tenants` tablosuna `Username`, `PasswordHash`, `ExpireDate` kolonları eklendi
- ✅ `AccountTransactions` tablosu oluşturuldu
- ✅ Gerekli index'ler eklendi

## 📋 Kullanım Senaryosu

### 1. Lisans Oluşturma (HQ - PlatformOwner)
1. `admin / Admin123!` ile giriş yapın
2. HQ Dashboard'a gidin
3. "Yeni Lisans Ekle" butonuna tıklayın
4. Formu doldurun:
   - Kurs adı: "Mavi-Beyaz Akademi"
   - Kullanıcı adı: "mavi-beyaz" (benzersiz olmalı)
   - Şifre: "Kurs123!"
   - Lisans süresi: 1 Yıl
5. "Lisans Oluştur" butonuna tıklayın

### 2. Kurs Girişi (Lisans Sahibi)
1. Login sayfasına gidin
2. Lisans kullanıcı adı ve şifresi ile giriş yapın:
   - Kullanıcı adı: "mavi-beyaz"
   - Şifre: "Kurs123!"
3. Otomatik olarak kurs dashboard'una yönlendirilirsiniz

### 3. Lisans Ödemesi Takibi (HQ)
1. Menu'den "Cari Hesap" sayfasına gidin
2. "Yeni İşlem" butonuna tıklayın
3. İşlem bilgilerini girin:
   - Tip: Gelir
   - Kategori: Lisans Ödemesi
   - Şube: İlgili kurs
   - Tutar: Ödenen miktar
   - Açıklama: "Mavi-Beyaz Akademi - 1 Yıllık Lisans"
4. Kaydedin

## 🔧 Migration Uygulama

### Otomatik (Önerilen)
`basla.bat` dosyasını çalıştırın. Migration otomatik uygulanacak.

### Manuel
```powershell
cd "C:\Users\0000K04-ULPC-01\Desktop\SRC Projesi\ProjeDosyasi\V1"
dotnet ef database update --project src\SRC.Infrastructure\SRC.Infrastructure.csproj --startup-project src\SRC.Presentation.Api\SRC.Presentation.Api.csproj
```

## 📝 API Endpoint'leri

### Lisans Yönetimi
- `GET /api/hq/tenants/usage` - Tüm lisansların kullanım özeti
- `POST /api/hq/tenants` - Yeni lisans oluştur

### Cari Hesap
- `GET /api/hq/accounts` - İşlem listesi (filtreleme ile)
- `POST /api/hq/accounts` - Yeni işlem ekle
- `PUT /api/hq/accounts/{id}` - İşlem güncelle
- `DELETE /api/hq/accounts/{id}` - İşlem sil

### Giriş
- `POST /api/auth/login` - Normal kullanıcı veya lisans girişi

## ✅ Hazır!

Tüm özellikler lisans modeline göre düzenlendi. `basla.bat` çalıştırarak sistemi başlatabilirsiniz.

