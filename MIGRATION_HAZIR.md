# Migration Hazır - Yeni Özellikler

## ✅ Eklenen Özellikler

### 1. Kurs Sona Erme Tarihi
- `Course` entity'sine `ExpireDate` alanı eklendi
- HQ Dashboard'dan kurs eklerken sona erme tarihi belirlenebilir

### 2. Cari Hesap Modülü
- `AccountTransaction` entity'si oluşturuldu
- Gelir/Gider işlemleri takip edilebilir
- `/hq/accounts` sayfası eklendi

## 📋 Migration Dosyası

Migration dosyası oluşturuldu:
- `20251114120000_Add_CourseExpireDate_And_AccountTransaction.cs`

## 🚀 Uygulama

### Otomatik (Önerilen)
`basla.bat` dosyasını çalıştırın. Migration otomatik uygulanacak.

### Manuel
Backend terminalinde:
```powershell
cd "C:\Users\0000K04-ULPC-01\Desktop\SRC Projesi\ProjeDosyasi\V1"
dotnet ef database update --project src\SRC.Infrastructure\SRC.Infrastructure.csproj --startup-project src\SRC.Presentation.Api\SRC.Presentation.Api.csproj
```

## 📝 Yeni Sayfalar ve Endpoint'ler

### Frontend
- `/hq/accounts` - Cari Hesap sayfası
- HQ Dashboard'da "Yeni Kurs Ekle" butonu

### Backend API
- `POST /api/hq/courses` - HQ kurs ekleme
- `GET /api/hq/accounts` - Cari hesap listesi
- `POST /api/hq/accounts` - Yeni işlem ekleme
- `PUT /api/hq/accounts/{id}` - İşlem güncelleme
- `DELETE /api/hq/accounts/{id}` - İşlem silme

## 🎯 Kullanım

1. **Kurs Ekleme (HQ Dashboard)**
   - HQ Dashboard'a gidin
   - "Yeni Kurs Ekle" butonuna tıklayın
   - Şube seçin, kurs bilgilerini girin
   - "Kurs Sona Erme Tarihi" alanını doldurun
   - Kaydedin

2. **Cari Hesap**
   - Menu'den "Cari Hesap" sayfasına gidin
   - "Yeni İşlem" butonuna tıklayın
   - Gelir veya Gider işlemi ekleyin
   - Filtreleme ve özet bilgileri görüntüleyin

## ✅ Hazır!

Tüm özellikler eklenmiş ve migration hazır. `basla.bat` çalıştırarak sistemi başlatabilirsiniz.

