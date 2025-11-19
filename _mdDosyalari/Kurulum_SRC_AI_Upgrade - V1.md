SRC & Ehliyet Kursu Otomasyon Sistemi — Akıllı Özellikler Genişletme Dokümanı

## 🎯 Amaç
Mevcut sistem iskeletine zarar vermeden, SRC & Ehliyet Kursu Otomasyon Projesine yapay zekâ, otomatik belge hatırlatma, yüz tanıma yoklama ve analitik özellikleri ekle.

> ⚠️ Not: Bu doküman *extend* prensibiyle çalışmalıdır.  
> Hiçbir mevcut dosya veya endpoint silinmeyecek.  
> Var olan dosyalar sadece güncellenecek veya genişletilecektir.  
> Yeni dosyalar oluşturulacaksa varlık kontrolü yapılmalı.  


## 🧱 Temel Altyapı Bilgileri (Değişmeden Kalmalı)
- **Frontend:** Next.js 15 + React 18 + TypeScript + Tailwind + shadcn/ui  
- **Backend:** .NET 8 (ASP.NET Core Web API) + EF Core (Code-First)  
- **Depolama:** MinIO  
- **Kimlik Doğrulama:** JWT  
- **Zamanlanmış Görevler:** Hangfire  
- **Veritabanı:** EF Core + PostgreSQL  
- **Çoklu Şube (Multi-Tenant):** `X-TenantId` header’ı zorunlu

---

## 🚀 Yeni Özellikler (Non-Destructive Upgrade)

### 1. 🧠 Yapay Zekâ Asistanlı Kurs Yönetimi
**Yeni Eklenecek Dosyalar:**
backend/Controllers/AiController.cs
backend/Services/Ai/IAiService.cs
backend/Services/Ai/OpenAiService.cs
frontend/app/(dashboard)/ai-assistant/page.tsx
frontend/components/ai/AssistantPanel.tsx
frontend/components/ai/WeeklyDigestCard.tsx

markdown
Copy code

**Backend İşlevi:**
- `/api/ai/ask` → Soru-cevap endpointi.  
- `/api/ai/weekly-digest` → Haftalık rapor (yoklama eksikleri, bitecek kurslar, bekleyen belgeler).  
- `AI_PROVIDER` env değişkenine göre mock veya OpenAI yanıtı verir.  
- Yanıtlar `AiQuery` tablosuna kaydedilir.

**Frontend İşlevi:**
- Dashboard menüsüne “🧠 Yapay Zekâ Asistanı” sekmesi eklenecek.  
- Chat penceresi + haftalık özet kutuları (`WeeklyDigestCard`) gösterilecek.  

---

### 2. 🪪 Otomatik Belge Hatırlatma (Hangfire ile)
**Yeni Dosyalar:**
backend/Controllers/RemindersController.cs
backend/Services/Notifications/IEmailSender.cs
backend/Services/Notifications/ISmsSender.cs
backend/Services/Notifications/EmailSender.cs
backend/Jobs/DocumentExpiryScanJob.cs
backend/Jobs/ReminderDispatchJob.cs
frontend/app/(dashboard)/documents/expiries/page.tsx
frontend/components/reminders/ScheduleModal.tsx

yaml
Copy code

**Açıklama:**
- Hangfire job’ları her sabah belge bitiş tarihlerini kontrol eder.  
- 30 gün kalan belgeler için otomatik `Reminder` kaydı oluşturur.  
- `ReminderDispatchJob` queued kayıtları e-posta/SMS ile gönderir.  
- UI’da tablo olarak gösterilir, kullanıcı manuel “Hatırlatma Planla” diyebilir.

---

### 3. 📸 AI Tabanlı Yoklama (Face + GPS)
**Yeni Dosyalar:**
backend/Controllers/AttendanceController.cs
backend/Services/Attendance/IFaceService.cs
backend/Services/Attendance/MockFaceService.cs
frontend/app/(dashboard)/attendance/check-in/page.tsx
frontend/components/attendance/PhotoCapture.tsx
frontend/components/attendance/GpsConsent.tsx

yaml
Copy code

**Açıklama:**
- Kursiyer yoklama esnasında kamera ile foto çeker, GPS konumu paylaşır.  
- Foto MinIO’ya kaydedilir (`EvidenceUrl`).  
- Yüz doğrulama mock olarak çalışır (`IFaceService.Verify → true`).  
- Öğrenci profilinde `FaceProfileId` tutulur.

---

### 4. 📱 Kursiyer Portalı (Mobil Dostu)
**Yeni Dosyalar:**
backend/Controllers/PortalController.cs
frontend/app/portal/login/page.tsx
frontend/app/portal/dashboard/page.tsx
frontend/components/portal/StatCard.tsx
frontend/components/portal/Timeline.tsx

yaml
Copy code

**İşlev:**
- Öğrenciler TCKN/email ile giriş yapar.  
- Kendi ders ilerlemesini, son yoklamalarını, belge durumlarını görür.  
- API uçları: `/api/portal/summary`, `/api/portal/attendance/recent`, `/api/portal/documents`.

---

### 5. 🔗 MEBBİS + e-Devlet Mock Entegrasyonu
**Yeni Dosyalar:**
backend/Controllers/MebbisController.cs
backend/Services/Mebbis/IMebbisClient.cs
backend/Services/Mebbis/FakeMebbisClient.cs
frontend/app/(dashboard)/integrations/mebbis/page.tsx

yaml
Copy code

**İşlev:**
- Gerçek API gelene kadar `FakeMebbisClient` success yanıt döner.  
- UI’da “Öğrenciyi Gönder”, “Kursu Gönder”, “Belgeyi Onayla” butonları.  
- Tüm çağrılar `MebbisSyncLog` tablosuna kaydedilir.

---

### 6. 📊 Yönetici Analitik Paneli
**Yeni Dosyalar:**
backend/Controllers/AnalyticsController.cs
frontend/app/(dashboard)/analytics/page.tsx
frontend/components/analytics/KpiCards.tsx
frontend/components/analytics/Chart.tsx

yaml
Copy code

**İşlev:**
- Toplam kursiyer, aktif kurs, doluluk oranı, belge süresi yaklaşanlar, devamsız kursiyer sayısı.  
- 2 grafik: Aylık gelir (dummy) ve doluluk oranı.  
- Veriler `AnalyticsController` üzerinden gelir.

---

### 7. 🌍 Çok Şubeli Yönetim (Multi-Tenant Switcher)
**Yeni Dosyalar:**
frontend/components/tenant/TenantSwitcher.tsx
backend/Middleware/TenantMiddleware.cs
backend/Services/Tenancy/ITenantProvider.cs
backend/Services/Tenancy/TenantProvider.cs

markdown
Copy code

**İşlev:**
- UI’da üst bar’da şube seçimi.  
- Seçilen şube `localStorage.tenantId` olarak saklanır.  
- Backend’de `TenantMiddleware` gelen `X-TenantId` header’ını doğrular.  
- Tüm sorgular sadece aktif tenant’ta filtrelenir.

---

## 🧩 Geliştirme Kuralları (Non-Destructive)
1. **Var olan dosya ve sınıflar asla silinmeyecek.**
2. Yeni dosya eklemeden önce varlığı kontrol et (`if exists → extend`).
3. EF Migrations mevcutsa yeni migration oluştur (`Add_VentechSmartModules`).
4. `Program.cs` içinde mevcut `AddControllers()` ve `AddSwaggerGen()` çağrılarına dokunma.
5. Yeni servisler `builder.Services.AddScoped<...>` şeklinde eklenecek.
6. Yeni Hangfire job’ları `RecurringJob.AddOrUpdate` ile kaydedilecek.
7. UI tarafında mevcut menüye zarar vermeden yeni route’lar eklenecek.

---

## 🗂️ Sayfa Haritası (Frontend)

app/
├─ (auth)/login/page.tsx
├─ (dashboard)/
│ ├─ layout.tsx
│ ├─ page.tsx
│ ├─ ai-assistant/page.tsx
│ ├─ documents/expiries/page.tsx
│ ├─ attendance/check-in/page.tsx
│ ├─ analytics/page.tsx
│ └─ integrations/mebbis/page.tsx
└─ portal/
├─ login/page.tsx
└─ dashboard/page.tsx

yaml
Copy code

---

## 🧾 Ortam Değişkenleri

AI_PROVIDER=mock
OPENAI_API_KEY=
MINIO_ENDPOINT=http://localhost:9000
MINIO_ACCESS_KEY=miniokey
MINIO_SECRET_KEY=miniosecret
MINIO_BUCKET=uploads
JWT_SECRET=dev_secret
HANGFIRE_DASHBOARD_USER=admin
HANGFIRE_DASHBOARD_PASS=admin123

yaml
Copy code

---

## 🧠 Test / Kabul Kriterleri

| Modül | Test Senaryosu | Beklenen Sonuç |
|--------|----------------|----------------|
| Yapay Zekâ Asistanı | `/api/ai/ask` çağrısı | 3 sn içinde anlamlı yanıt |
| Belge Hatırlatma | Belge bitiş ≤30 gün | Reminder kaydı oluşur |
| Yoklama | Foto + GPS gönder | Attendance kaydı eklenir |
| Portal | Öğrenci login | Kendi verilerini görür |
| MEBBİS | Push işlemleri | SyncLog success döner |
| Analytics | Dashboard | 4 KPI + 2 grafik görünür |
| Tenant | Şube değiştir | Liste verisi değişir |

---

## 🧱 Mevcut Projeyi Koruma Talimatı

> ⚙️ **Cursor’a özel talimat:**  
> Aşağıdaki kurallara harfiyen uy:
> 1. Var olan dosyaları **asla silme veya ezme.**
> 2. Yeni özellikleri `Add*`, `Extend*`, `Smart*` isimli yeni dosyalarla ekle.
> 3. Eğer bir controller zaten varsa → sadece yeni endpointleri partial class olarak yaz (`partial class ControllerName`).
> 4. Frontend tarafında mevcut route veya layout’u bozmadan yeni route dizinleri aç.
> 5. Mevcut veritabanı modellerini değiştirme, sadece yeni kolonlar veya entity’ler ekle.
> 6. Her eklenen modül için `commit: "feat(module): added <modül adı>"` mesajı oluştur.
> 7. Proje build ederken hata çıkarsa eski dosyalara rollback yapma, sadece yeni modül kodlarını disable et (komentle).

---

## ✅ Çıktı Sonunda Cursor’un Yazması Gereken Özet Log
Cursor bu işlemleri tamamladıktan sonra şu şekilde bir özet döndürmeli:

✅ Yeni dosyalar: 18 adet eklendi
✅ 3 migration oluşturuldu: Add_VentechSmartModules
✅ Mevcut 0 dosya değiştirildi
✅ Hangfire job’ları kaydedildi
✅ Yeni UI sayfaları oluşturuldu: ai-assistant, analytics, portal, integrations/mebbis
✅ Tenant sistemi aktif
🌐 Demo URL’ler:
Backend: http://localhost:5000
Frontend: http://localhost:3000
Hangfire Dashboard: http://localhost:5000/hangfire

yaml
Copy code

---

**Cursor Komut Satırı Prompt:**
> “Bu dokümandaki tüm modülleri mevcut SRC & Ehliyet Otomasyon projesine **non-destructive** şekilde uygula.  
> Var olan dosyalara zarar verme, sadece genişlet.  
> Tüm klasör ve dosya yapısını bu dokümandaki gibi oluştur.  
> Kurulum tamamlanınca yukarıdaki özet log’u döndür.”

---

**Dosya adı:** `Ventech_SRC_AI_Upgrade.md`  
Bu dosyayı Cursor’a yükleyip şu komutu ver:

> **Prompt:**  
> “Bu md dokümanındaki talimatlara göre mevcut SRC projemi akıllı özelliklerle genişlet, var olan iskelete zarar verme.”

---

İstersen bu `.md` dosyasını senin adına oluşturup indirilebilir hale getireyim (örneğin `Ventech_SRC_AI_Upgrade.md`).