# SRC KURS YÖNETİM SİSTEMİ — SAYFA VE İŞ AKIŞI DOKÜMANTASYONU (FINAL)

Bu doküman, SRC Kurs Yönetim Sistemi’nin:

- Tüm önemli **sayfalarını**  
- Sayfalar arası **ilişkileri ve navigasyonu**  
- Eski sistem (Ventec) + MEBBİS süreçlerinin **yeni web uygulamasına nasıl karşılık geldiğini**  

detaylı ve Cursor’un anlayacağı şekilde tanımlar.

Amaç: Cursor, bu dokümanı okuyarak **Next.js 15 + .NET 8** tabanlı bir SRC otomasyon arayüzünü uçtan uca oluşturabilsin.

---

## 0. Kavramsal Özet

### 0.1 Ana Varlıklar (Entities)

- **Öğrenci / Kursiyer (Student)**  
  - TCKN, ad-soyad, iletişim, eğitim durumu, ehliyet, yabancı aday bilgisi.
- **Öğrenci Evrakları (StudentDocuments)**  
  - Kimlik, fotoğraf, diploma, adli sicil, sürücü belgesi, psikoteknik vb.
  - Tarama + OCR → belge no/tarih.
- **MEB Grup (MebGroup)**  
  - Yıl, ay, grup adı (örn: “Kasım Grup 1A”), başlangıç/bitiş tarihleri, kontenjan.
- **Kurs (Course)**  
  - SRC türü (SRC1..SRC5), karma sınıf (isMixed), planlanan ders saatleri, MEB onay durumu.
- **Ders Programı Slotu (ScheduleSlot)**  
  - Kurs, eğitmen, derslik, tarih-saat ve konu.
- **Yoklama (Attendance)**  
  - Slot + öğrenci = var/yok kaydı (opsiyonel GPS).
- **Sınav (Exam)**  
  - Yazılı / uygulama, tarih, MEB oturum kodu.
- **Sınav Sonucu (ExamResult)**  
  - Not, geçti/kaldı, hak numarası (1–4).
- **MEBBİS Aktarım Job/Item**  
  - Kurs bazlı job, her aday için item; başarı/başarısız, hata kodu.
- **Ödemeler (Payments)**  
  - Kurs ücreti, sınav harcı, ödeme tarihleri, tip, bakiye.

### 0.2 Temel Ventec → Yeni Sistem Mantığı

- Ventec: Kurs merkezi için **günlük işlerin yönetildiği** ön otomasyon.
- MEBBİS: Milli Eğitim’in **resmi kayıt ve onay** sistemi.
- Yeni sistem: Ventec’in yaptığı işlemleri **web tabanlı** hale getirir, MEBBİS’e giden verileri hazırlar; MEBBİS arayüzüyle entegrasyon (headless/yarı otomatik) sağlar.

---

## 1. Sayfa Haritası (Yeni Web Uygulaması)

### 1.1 Ana Sayfalar ve URL’ler

- `/login` — Giriş
- `/dashboard` — Anasayfa / Özet
- `/students` — Kursiyer listesi
- `/students/[id]` — Kursiyer detay
- `/groups` — MEB grupları (MebGroup)
- `/courses` — Kurs listesi
- `/courses/[id]` — Kurs detay, program, kursiyerler, sınavlar, aktarım, raporlar
- `/exams` — Sınav listesi
- `/exams/[id]` — Sınav detay ve sonuç girişi
- `/mebbis-transfer` — MEBBİS aktarım merkezi
- `/payments` — Ödemeler ve bakiyeler
- `/reports` — Raporlar ve çıktı alımı

---

## 2. Login Sayfası — `/login`

### Amaç
Kullanıcının kullanıcı adı/şifre ile giriş yapması, JWT token alması ve rolüne göre yönlendirilmesi.

### Akış

1. Kullanıcı `/login`’e gelir.
2. `userName` + `password` girer.
3. `POST /api/auth/login` çağrılır.
4. Başarılıysa:
   - `accessToken` + `refreshToken` saklanır (tercihen httpOnly cookie).
   - `/dashboard`’a yönlendirilir.
5. Giriş yapmış kullanıcı `/login`’e tekrar gelirse otomatik `/dashboard`.

---

## 3. Dashboard Sayfası — `/dashboard`

### Amaç
Kurumun ve şubenin güncel durumuna hızlı bakış.

### İçerik

- KPI Kartları:
  - Aktif kurs sayısı
  - Toplam kursiyer
  - Bekleyen MEB aktarım job sayısı
  - Yaklaşan sınav sayısı (bu ay)
- Listeler:
  - **Yaklaşan sınavlar** (örn: önümüzdeki 7 gün)
  - **Bugünkü dersler** (ScheduleSlot listesi)
- Uyarılar:
  - Son 7 gündeki başarısız MEBBİS aktarım job’ları
  - Ödemesi gecikmiş kursiyer sayısı

### Backend

- `GET /api/dashboard/summary`
- `GET /api/dashboard/today-schedule`
- `GET /api/dashboard/upcoming-exams`
- `GET /api/dashboard/alerts`

---

## 4. Öğrenci Listesi (Kursiyerler) — `/students`

### Amaç
Kayıtlı kursiyerleri listelemek, filtrelemek, yeni kursiyer oluşturma ve detay sayfasına geçmek.

### UI

- Filtreler:
  - Şube seçici
  - Aktif kursu olan olmayan (checkbox/dropdown)
  - Arama kutusu (TCKN, ad, soyad)
- Tablo:
  - TCKN (maskeli)
  - Ad Soyad
  - Telefon
  - Şube
  - Son kurs bilgisi
  - Aktif kurs durumu
  - İşlemler:
    - Detay (/students/[id])
    - Yeni kurs kaydı (enrollment)

### Backend

- `GET /api/students?branchId=...&hasActiveCourse=true&search=...`
- `POST /api/students` (Yeni kursiyer)

### Ventec Karşılığı

- Ventec’teki **“Yeni Kursiyer Kaydı”** + **“Kursiyer Arama”** ekranlarının fonksiyonlarını burada kapsıyoruz.

---

## 5. Öğrenci Detay Sayfası — `/students/[id]`

### Amaç
Tek kursiyerin tüm bilgilerini, evraklarını, kurslarını ve ödemelerini yönetmek.

### Sekmeler

1. **Genel Bilgiler**
   - TCKN, ad, soyad, doğum tarihi, adres, telefon, öğrenim durumu, ehliyet, yabancı aday flag.
   - “Düzenle” butonu → `PUT /api/students/{id}`

2. **Evraklar (Ventec: Evrak Bilgileri)**
   - Liste: belge türü, dosya, belge no, tarih, OCR durumu.
   - “Belge Yükle”:
     - `POST /api/students/{id}/documents` (multipart)
     - Arka planda OCR job’ı tetiklenir → doc_no/doc_date/ocr_confidence güncellenir.
   - MEBBİS’e gidecek evrakların hazır olup olmadığı burada takip edilir.

3. **Kurs Kayıtları (Enrollments)**
   - Öğrencinin dahil olduğu kurslar:
     - Kurs adı, SRC türü, sınıf/grup adı, durum, sınav hakları.
   - Yeni kurs kaydı:
     - `POST /api/enrollments` (studentId + courseId)

4. **Ödemeler**
   - Ödeme listesi:
     - Tarih, tutar, tip (course_fee, exam_fee), ödenme durumu, ceza tutarı.
   - Yeni ödeme:
     - `POST /api/payments`

### Ventec Karşılığı

- **Yeni Kursiyer Kaydı** → Genel bilgiler sekmesi.
- **Ödeme ve Bakiye Takibi** → Ödemeler sekmesi.
- **Evrak Bilgileri** → Evraklar sekmesi.

---

## 6. Gruplar (MEB Grup Kartı) — `/groups`

### Amaç
MEBBİS’te açılan sınıflarla birebir eşleşecek **MEB grup kartlarını** yönetmek.

### Ventec Referansı

- Ventec’teki **“MEB Grup Kartı”** sayfası:  
  “Kasım Grup 1A” gibi grup adı, tarih, kontenjan, SRC türü.

### UI

- Filtreler:
  - Yıl, Ay
  - Şube
- Tablo:
  - Grup adı (örn: 2025-KASIM-GRUP 1A)
  - Yıl / Ay
  - Şube
  - Başlangıç/Bitiş
  - Kontenjan
  - Bu gruba bağlı kurs sayısı
  - İşlemler (Detay, Düzenle, Sil/Pasif et)

### Backend

- `GET /api/groups?year=...&month=...&branchId=...`
- `POST /api/groups`
- `PUT /api/groups/{id}`
- `DELETE /api/groups/{id}` (veya pasif et)

---

## 7. Kurslar Listesi — `/courses`

### Amaç
Tüm SRC kurslarının listesini ve özet durumunu göstermek, yeni kurs oluşturmak.

### UI (Özet)

- Filtreler:
  - Şube, SRC türü, MEB onay durumu, ay/dönem, arama
- Tablo sütunları:
  - Kurs Adı (örn: “SRC1 Kasım 2025”) → tıklayınca `/courses/[id]`
  - SRC Türü (SRC1..SRC5)
  - Şube
  - MEB Grup adı
  - Başlangıç/Bitiş
  - Karma? (badge)
  - Planlanan Saat
  - Kontenjan / Kayıtlı sayısı
  - MEB Onay Durumu (draft/pending/approved/rejected)
  - İşlemler (detay, program, kursiyerler, MEB aktarım)

### Backend

- `GET /api/courses?...`
- `POST /api/courses` (Yeni kurs oluşturma)

### Ventec Karşılığı

- Ventec’te doğrudan ayrı kurs sayfası yok; “MEB Grup Kartı” + ders programı + gruplar mantığı birleştirilmişti.  
  Yeni sistemde kurs listesi, bu mantığı daha net şekilde ayırır.

---

## 8. Kurs Detay Sayfası — `/courses/[id]`

### Amaç
Tek kurs üzerindeki **tüm operasyonu** bir sayfadan yönetmek.

### Sekmeler

1. **Genel Bilgi**
   - Kurs adı, SRC türü, MEB grup, şube, karma flag, planlanan saat, kontenjan.
   - MEB onay durumu ve tarih.
   - Düzenleme imkanı.

2. **Ders Programı (Ventec: Ders Programı)**
   - Haftalık grid görünümü.
   - Her slotta:
     - Tarih-saat
     - Ders / konu
     - Eğitmen
     - Derslik
   - Aksiyonlar:
     - “Otomatik Program Oluştur” (auto planner)
       - Eğitmen 40 saat / hafta sınırı
       - Derslik kapasitesi
       - Karma sınıf kuralları
     - Manuel slot ekle/düzenle/sil
   - Rapor:
     - Ders programı çıktısı
     - Yoklama listesi (MEB formatında)

3. **Kursiyerler (Ventec: MEB Aday İşlemleri / Bekleyen Grup)**
   - Bu kursa kayıtlı öğrencilerin listesi:
     - Ad-soyad, TCKN, yoklama ortalaması, sınav hakları, bakiye.
   - “Havuzdan Kursiyer Ekle”:
     - MEB grup kartına bağlı “bekleyen” kursiyer havuzundan seçim.
   - Referans Ventec mantığı:
     - Evrakları tamamlanmış kursiyerler → Bekleyen grup → MEB Grup Kartı’na atama.

4. **Sınavlar**
   - Bu kursla ilişkili yazılı ve uygulama sınavları.
   - Sınav tarihleri, MEB oturum kodu, geçme oranı.
   - “Yeni Sınav Ekle” veya var olan sınav detayına git (`/exams/[id]`).

5. **MEBBİS Aktarımı (Ventec: MEB SRC Aktarım)**
   - Bu kurs için MEBBİS aktarım job listesi:
     - Tarih, mod (dry_run/live), success/failure, durum.
   - “Dry Run” & “Live Aktarım” butonları:
     - `POST /api/mebbis/transfer/{courseId}?mode=dry_run|live`
   - Job detaylarında:
     - Her kursiyer için status (transferred/failed)
     - error_code (ör: PHOTO_MISSING, DOC_INCOMPLETE, NETWORK_ERROR)
   - Bu alan, Ventec’in MEB ekranını açıp tek tek doldurduğu sürecin **toplu ve log’lu versiyonudur**.

6. **Raporlar**
   - Bu kurs özelinde:
     - Yoklama listesi
     - Ders programı
     - Sınav girecekler listesi
     - Sınav sonuç listesi
     - Sertifika listesi
   - Format seçimi: PDF, XLS, DOC, HTML.

---

## 9. Sınavlar Listesi — `/exams`

### Amaç
Tüm sınav oturumlarını tarihe ve duruma göre görmek.

### UI

- Filtreler:
  - Tarih aralığı, şube, SRC türü, sınav tipi (yazılı/uygulama)
- Tablo:
  - Tarih
  - Sınav tipi (written/practical)
  - SRC türü
  - Kurs adı
  - Şube
  - Katılımcı sayısı
  - Geçen/Kalan
  - İşlemler (Detay, Sonuç Gir, Sil)

### Backend

- `GET /api/exams?...`
- `POST /api/exams` (yeni sınav)

### Ventec Karşılığı

- **“Sınav Tarihi Tanımla”** + “Yazılı Sınav Notları”, “Uygulama Sınavı” ekranlarının üst seviye yönetimi.

---

## 10. Sınav Detay — `/exams/[id]`

### Amaç
Tek sınav için aday listesi, not girişi ve hak takibi.

### UI

- Genel bilgi:
  - Kurs, SRC türü, şube, tarih, sınav tipi, MEB oturum kodu.
- Aday tablosu:
  - Ad-soyad, TCKN
  - Not / puan
  - Durum (Geçti/Kaldı)
  - Hak no (1–4)
- Aksiyonlar:
  - Tek tek not girme (inline edit)
  - CSV/XLS import (`POST /api/exam-results/import`)
  - “Sonuçları Kaydet”

### Kurallar

- Bir kursiyer için **attempt_no > 4** olmamalı; backend reddeder.
- Yazılı sınavı geçenler otomatik uygulama sınav aday havuzuna aktarılabilir (iş kuralı).

### Ventec Karşılığı

- “Yazılı Sınav Notları” + “Uygulama Sınavı” ekranlarının yerini alır; hak takibi dahil.

---

## 11. MEBBİS Transfer Merkezi — `/mebbis-transfer`

### Amaç
Kurs bazlı MEB aktarım job’larını başlatmak ve izlemek.

### UI

- Üstte:
  - Kurs seçici (`courseId`)
  - “Dry Run” butonu
  - “Live Aktarım” butonu
- Altta:
  - Job listesi:
    - Tarih/Saat
    - Kurs adı
    - Mod: dry_run / live
    - Success/Failure sayıları
    - Durum: Running / Completed / Failed
    - “Detay” butonu

Detay modal/sayfası:

- `mebbis_transfer_items` listesi:
  - Öğrenci adı
  - Durum (transferred/failed)
  - error_code
  - error_message

### Ventec Karşılığı

- “MEB SRC Aktarım” + “Mebbis aktarım işlemleri” ekranının modern hali:
  - Ventec: MEB sayfasını açıp her kursiyer için alanları dolduruyor.
  - Yeni sistem: Headless/yarı otomatik adapter ile arayüzü doldurup sonucu logluyor.

---

## 12. Ödemeler — `/payments`

### Amaç
Kursiyer ve kurs bazlı ödeme/bakiye takibi.

### UI

- Filtreler:
  - Şube
  - Kurs
  - Ödeme tipi (course_fee/exam_fee/other)
  - Ödenmiş / Ödenmemiş
- Tablo:
  - Tarih
  - Kursiyer
  - Kurs
  - Tutar
  - Tip
  - Ödendi mi?
  - Ceza (penalty_amount)

### Ventec Karşılığı

- “Ödeme ve Bakiye Takibi” + nadiren kullanılan kasa/fatura modüllerinin sadeleştirilmiş hali.

---

## 13. Raporlar — `/reports`

### Amaç
MEB formatlı raporları ve sertifika listelerini üretmek.

### UI

- Rapor tipi seçici:
  - Ders Programı
  - Yoklama Listesi
  - Sınava Girecek Kursiyerler
  - Yazılı Sınav Sonuçları
  - Uygulama Sınav Sonuçları
  - Sertifika listeleri
  - Bakiye listeleri
  - Sınav harç/dekont listeleri
- Filtreler:
  - Kurs, grup, şube, tarih aralığı vs.
- Format:
  - PDF, XLS, DOC, HTML (MEB taleplerine uygun)

Backend:

- `POST /api/reports/generate` (raporType, parametreler, format)

### Ventec Karşılığı

- “Sınav ve Sertifika Raporları” + diğer rapor menüleri.

---

## 14. Ventec / MEBBİS Eski İş Akışı → Yeni Sistem Akışı

### 14.1 Eski Akışın Özeti

1. **Ventec’te Ön Kayıt ve Evrak Hazırlığı**
   - Yeni Kursiyer Kaydı → Ödeme/Bakiye → Evrak Bilgileri.
2. **MEBBİS’te Sınıf Açılışı**
   - MEBBİS: Giriş → Grup Açılış Tarihi sayfasından sınıf oluşturma.
3. **Ventec’te MEB Grup Kartı & MEB Aday İşlemleri**
   - MEB Grup Kartı: Sınıf ismi ve parametreler.
   - MEB Aday İşlemleri: Bekleyen havuzdan gruba atama.
4. **Ventec’ten MEBBİS Aktarımı**
   - MEB SRC Aktarım: Her kursiyer için dönem kaydı + evrak aktarımları.
5. **MEBBİS’te Aday Onayı**
   - MEBBİS: Aday dönem kayıt sayfasından tek tek onaylama.
6. **Ventec’te Ders Programı & Sınav & Sertifika**
   - Ders Programı: Yoklama listeleri, ders defteri.
   - Yazılı ve Uygulama Sınavı: Not girme, hak takibi.
   - Sınav ve Sertifika Raporları: Başarılı kursiyer listeleri, sertifika numaraları.

### 14.2 Yeni Sistemle Karşılık Gelen Akış

Aşağıda “yeni sistem sayfalarıyla” aynı sürecin nasıl yürüdüğü anlatılır.

#### A) Yeni Kursiyer Kayıt Süreci

1. Kullanıcı `/students` → “Yeni Kursiyer” butonu.
2. `/students/new` (veya modal):
   - Temel bilgiler girilir.
3. Kaydedildikten sonra `/students/[id]`:
   - **Evraklar** sekmesinde belgeler yüklenir.
   - OCR ile no/tarihler çekilir.
   - **Ödemeler** sekmesinde ödeme planı yapılır.

> Ventec: “Yeni Kursiyer Kaydı” + “Ödeme ve Bakiye Takibi” + “Evrak Bilgileri”

#### B) MEB Sınıf Açılışı ve MEB Grup Kartı

1. MEBBİS üzerinde yetkili kullanıcı:
   - Giriş yapar, resmi sınıf açılışını yapar (Grup Açılış Tarihi).
2. Yeni sistemde `/groups` sayfasına gidilir:
   - MEB’de açılan sınıf adıyla eşleşen bir **MEB Grup** oluşturulur.
3. `/courses/new` ekranında:
   - Bu MEB Grup seçilerek kurs oluşturulur (SRC türü, tarih, kontenjan).

> Ventec: MEBBİS’te sınıf aç → Ventec’te MEB Grup Kartı oluştur.  
> Yeni: MEBBİS’te sınıf aç → Yeni sistemde `/groups` ve oradan kurs yarat.

#### C) Kursiyerleri Gruba ve Kursa Atama

1. Evrakları ve ödemeleri tamamlanan kursiyerler `/students/[id]` üzerinden “Bu kursa kayıt et” ile ilgili kursa (`/courses/[id]`) bağlanır.
2. `/courses/[id]` → **Kursiyerler** sekmesinde:
   - Havuzdaki uygun kursiyerler liste halinde görülür (örneğin MEB Grubu ile eşleşen adaylar).
   - Çoklu seçimle kursa eklenir.

> Ventec: “MEB Aday İşlemleri” (bekleyen gruptan sınıfa aktarma).  
> Yeni: `/courses/[id]#students` + backend filtreleri.

#### D) MEBBİS Aktarımı

1. `/mebbis-transfer` veya `/courses/[id]#mebbis` sekmesinde:
   - Kurs seçilir.
   - Önce **Dry Run** çalıştırılır:
     - Eksik evraklar, format sorunları, hatalı kayıtlar raporlanır.
   - Hatalar giderildikten sonra **Live Aktarım** başlatılır.
2. Arkada `IMebbisAdapter`:
   - MEBBİS arayüzüne (headless script) kursiyerleri işler (dönem kaydı, resim, öğrenim belgesi, adli sicil).
3. Sonuçlar:
   - `mebbis_transfer_items` tablosuna status ve error_code ile kaydedilir.
   - UI’da detay rapor görünür.

> Ventec: “MEB SRC Aktarım” penceresi açılır, MEB sayfasına tek tek veri doldurulur.  
> Yeni: Aynı mantık otomasyona taşınır, fakat log’lu, raporlanabilir, dry-run’lı.

#### E) MEBBİS’te Onay

- Bu adım hala **MEBBİS içerisinde** gerçekleşir:
  - Yetkili kişi MEBBİS’e giriş yapar.
  - Aday dönem kaydı sayfasından kursiyerleri tek tek veya topluca onaylar.
- Yeni sistem:
  - Bu işlem için bir “durum takip” özelliği sunabilir (manuel işaretleme veya MEBBİS’ten data çekilebiliyorsa otomatik).

#### F) Ders Programı, Yoklama, Sınav ve Sertifika

1. `/courses/[id]#schedule`:
   - Ders programı oluşturan ekran.
   - Yoklama listesi ve ders defteri çıktısı alınır.
2. `/exams` + `/exams/[id]`:
   - “Yazılı” ve “Uygulama” sınavları planlanır, notlar girilir.
   - Sınav hak sayısı (max 4) hem backend hem UI seviyesinde kontrol edilir.
3. `/reports`:
   - Başarılı kursiyerler için sertifika listeleri MEB formatında alınır.
   - Sertifika listesi = Ventec’teki “Sınav ve Sertifika Raporları”.

---

## 15. Sayfalar Arası Navigasyon Örnekleri (User Journey)

### Senaryo 1: Sıfırdan Kurs Açıp Öğrenciyi Belgeye Götürme

1. Admin → `/groups` → “Yeni Grup Oluştur” → Kasım 2025 Grup 1A.
2. Admin → `/courses` → “Yeni Kurs Oluştur” → SRC1 Kasım 2025, bu gruba bağlı.
3. Danışma → `/students` → “Yeni Kursiyer”:
   - Genel bilgiler + evrak + ödeme.
4. Danışma → `/students/[id]#enrollments` → SRC1 Kasım 2025 kursuna kaydet.
5. Eğitim yöneticisi → `/courses/[id]#schedule` → Auto planner + ders programı.
6. Eğitim yöneticisi → `/courses/[id]#students` → Kursiyer listesini doğrular.
7. MEB sorumlusu → `/courses/[id]#mebbis` → Dry run → Hataları düzelt → Live aktarım.
8. MEBBİS içinde resmi onay.
9. Eğitim yöneticisi → `/exams` + `/exams/[id]`:
   - Yazılı ve uygulama sınav sonuçlarını girer/import eder.
10. `/reports` → Sertifika listesi PDF/XLS → MEB’e üst yazı ile gönderilir.

---

## 16. Cursor İçin Önerilen Agent Talimatı (Kısa)

Bu dokümanı Cursor’a yükledikten sonra Agent Mode’a şu tarz bir prompt yaz:

> **“You are a senior full-stack engineer.  
> Read and fully implement the page and flow specification in `SRC_Page_and_Flow_Spec.md`.  
> Build all pages, API endpoints and navigation flows exactly as described (URLs, tabs, filters, actions, and legacy Ventec/MEBBIS behaviors).  
> Use Next.js 15 (App Router) for the frontend and .NET 8 Web API for the backend.  
> Ensure that the flows from student registration to MEBBIS transfer, exams and certificate reports work end-to-end as documented.”*

