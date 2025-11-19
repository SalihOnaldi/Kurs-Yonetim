# SRC KURS YÖNETİM SİSTEMİ — TAM TEKNİK SPESİFİKASYON DOKÜMANTI

Bu doküman, SRC Kurs Yönetim Sistemi’nin:

- Tüm önemli **sayfalarını ve işlevlerini**  
- **Ventec / MEBBİS entegrasyonunun yeni sistemdeki karşılığını**  
- Teknik olarak **MEBBİS Adapter** ve **Rapor Motoru (Report Engine)** bileşenlerinin detaylı tasarımını  

tek bir kapsamlı referans olarak tanımlar.

---

## 0. Genel Kavramsal Yapı

### 0.1 Ana Varlıklar

- **Kursiyer (Student)**  
  Temel kimlik, iletişim, öğrenim bilgileri, SRC türü, yabancı aday durumu.
- **Evraklar (Documents)**  
  Fotoğraf, diploma, adli sicil, ehliyet vb. belgelerin OCR destekli yüklemesi.
- **MEB Grup (MebGroup)**  
  Yıl, ay, grup adı (ör. “Kasım Grup 1A”), başlangıç/bitiş tarihleri, kontenjan.
- **Kurs (Course)**  
  SRC türü, tarih aralığı, grup bağlantısı, eğitmen ve plan bilgileri.
- **Ders Slotu (ScheduleSlot)**  
  Tarih, saat, eğitmen, konu, derslik.
- **Yoklama (Attendance)**  
  Kursiyer + slot → var/yok.
- **Sınav (Exam)**  
  Yazılı / uygulama türü, tarih, oturum kodu.
- **Sonuç (ExamResult)**  
  Not, geçti/kaldı, deneme hakkı.
- **MEBBİS Aktarım (MebbisTransferJob/Item)**  
  Dry-run ve live aktarım logları.
- **Ödeme (Payment)**  
  Ücret, tarih, tip, bakiye.

---

## 1. SAYFA BAZLI YAPI VE AKIŞ

### 1.1 Login (`/login`)
Kullanıcı adı/şifre → JWT token → yönlendirme `/dashboard`.  
Backend: `POST /api/auth/login`

---

### 1.2 Dashboard (`/dashboard`)
Özet göstergeler:
- Aktif kurs sayısı
- Toplam kursiyer
- Bekleyen MEB aktarımı
- Yaklaşan sınavlar
Altında “Bugünkü dersler”, “Yaklaşan sınavlar”, “Ödeme uyarıları”.  
API: `/api/dashboard/*`

---

### 1.3 Kursiyer Listesi (`/students`)
Filtreli tablo:
- Arama, Şube, Aktif kursu olan/olmayan.
İşlemler: Detay / Yeni kayıt.  
Backend: `GET /api/students`, `POST /api/students`

Ventec karşılığı: **Yeni Kursiyer Kaydı + Arama**

---

### 1.4 Kursiyer Detayı (`/students/[id]`)
Sekmeler:
1. **Genel Bilgi** → düzenleme
2. **Evraklar** → belge yükle, OCR
3. **Kurslar** → öğrencinin kurs kayıtları
4. **Ödemeler** → bakiye yönetimi

Ventec karşılığı: **Yeni Kursiyer Kaydı + Ödeme + Evrak Bilgileri**

---

### 1.5 Gruplar (`/groups`)
MEBBİS sınıflarıyla eşleşen grup kartları.  
Alanlar: Grup adı, tarih, kontenjan, SRC türü.  
API: `GET/POST/PUT /api/groups`

Ventec karşılığı: **MEB Grup Kartı**

---

### 1.6 Kurslar (`/courses`)
Tüm kursların listesi ve özet durumu.  
Sütunlar: Ad, SRC türü, şube, grup, kontenjan, MEB onay durumu.  
Yeni kurs oluştur: `POST /api/courses`

Ventec karşılığı: MEB grup tabanlı kurs birleşimi.

---

### 1.7 Kurs Detayı (`/courses/[id]`)
Sekmeler:
1. **Genel Bilgi**  
2. **Ders Programı** (auto plan + manuel slot)  
3. **Kursiyerler** (havuzdan atama)  
4. **Sınavlar**  
5. **MEBBİS Aktarım**  
6. **Raporlar**

Ventec karşılığı: **MEB Grup Kartı + MEB Aday İşlemleri + MEB SRC Aktarım + Ders Programı + Raporlama**

---

### 1.8 Sınavlar (`/exams`)
Tüm sınav oturumları.  
Filtreler: Tarih, şube, tür.  
Tablo: Tarih, tür, kurs, geçme oranı.  
API: `/api/exams`

Ventec karşılığı: **Sınav Tarihi Tanımla**

---

### 1.9 Sınav Detayı (`/exams/[id]`)
Kursiyer notları, hak sayısı, CSV import/export.  
Ventec karşılığı: **Yazılı / Uygulama sınav ekranları**

---

### 1.10 MEBBİS Aktarım Merkezi (`/mebbis-transfer`)
Kurs bazlı job listesi, Dry-run ve Live aktarım.  
Job → item loglama.  
Ventec karşılığı: **MEB SRC Aktarım**

---

### 1.11 Ödemeler (`/payments`)
Tüm kursiyerlerin ödeme kayıtları.  
Ventec karşılığı: **Ödeme Takibi**

---

### 1.12 Raporlar (`/reports`)
PDF/XLS çıktılar:  
Ders programı, yoklama, sınav, sertifika, bakiye.  
Ventec karşılığı: **Sınav ve Sertifika Raporları**

---

## 2. VENTEC / MEBBİS AKIŞLARI YENİ SİSTEMDE

| Eski Ventec Adımı | Yeni Sistem Karşılığı |
|--------------------|------------------------|
| Yeni Kursiyer Kaydı | `/students` + `/students/[id]` |
| Evrak Bilgileri | `/students/[id]#documents` |
| Ödeme Takibi | `/students/[id]#payments` |
| MEB Grup Kartı | `/groups` |
| MEB Aday İşlemleri | `/courses/[id]#students` |
| MEB SRC Aktarım | `/mebbis-transfer` |
| Ders Programı | `/courses/[id]#schedule` |
| Sınav Not Girişi | `/exams/[id]` |
| Sertifika Raporları | `/reports` |

---

## 3. TEKNİK BİLEŞENLER

### 3.1 MEBBİS ADAPTER (Adapter Katmanı)

#### Amaç
Ventec’in manuel MEBBİS aktarımını, otomatik ve log’lu hale getirmek.

#### Temel Yapı
- `IMebbisAdapter`
- `MebbisTransferService`
- `MebbisTransferJob` + `MebbisTransferItem`
- `MockMebbisAdapter`, `HeadlessMebbisAdapter`, `SftpMebbisAdapter`

#### Akış
1. `/mebbis-transfer` → Dry-run veya Live aktarım.
2. Job oluşturulur, Queue’ya alınır.
3. Adapter çalışır:
   - Dry-run → eksik evrakları raporlar.
   - Live → MEBBİS’e veri gönderir, sonuçları item bazında yazar.
4. UI job ve item detaylarını gösterir.

#### Örnek Job Modeli
```csharp
public class MebbisTransferJob {
    public Guid Id { get; set; }
    public Guid CourseId { get; set; }
    public string Mode { get; set; }
    public string Status { get; set; } // pending/running/completed
    public int SuccessCount { get; set; }
    public int FailureCount { get; set; }
}
Dry Run
Eksik belge, hatalı TCKN, fotoğraf yok vb. durumları listeler.

Gerçek aktarım yapılmaz.

Live Mode
Gerçek MEBBİS oturumu (headless) açılır.

Kursiyerler sırayla aktarılır.

Başarı/başarısız loglanır.

Hata Kodları
PHOTO_MISSING, DOC_INCOMPLETE, INVALID_TCKN, MEB_SESSION_ERROR, NETWORK_ERROR

Adapter Tipleri
json
Copy code
"MEBBIS_ADAPTER": "mock" // mock | headless | sftp
3.2 RAPOR MOTORU (Report Engine)
Amaç
Ders, yoklama, sınav, sertifika ve bakiye raporlarını MEB formatında üretmek.

Yapı
IReportService

IReportRenderer (PDF, Excel, HTML, Doc)

ReportType Enum

ReportParameters, ReportFileResult

API
POST /api/reports/generate

Body:

json
Copy code
{
  "reportType": "AttendanceList",
  "parameters": { "courseId": "GUID", "from": "2025-11-01", "to": "2025-11-30" },
  "format": "Pdf"
}
Renderer Örneği
csharp
Copy code
public interface IReportRenderer {
    ReportFormat Format { get; }
    Task<byte[]> RenderAsync<T>(string template, T model);
}
Örnek Rapor Modelleri
Ders Programı

csharp
Copy code
public class CourseScheduleRow {
    public DateTime Date { get; set; }
    public string LessonOrTopic { get; set; }
    public string Teacher { get; set; }
}
Yoklama Listesi

csharp
Copy code
public class AttendanceListStudent {
    public string Name { get; set; }
    public string Tckn { get; set; }
}
Sertifika Listesi

csharp
Copy code
public class CertificateListRow {
    public string StudentName { get; set; }
    public string CertificateNumber { get; set; }
}
Rapor Formatları
Pdf (QuestPDF)

Excel (ClosedXML)

Doc (pypandoc)

Html (Template)

Kabul Kriterleri
Tüm raporlar MEB’in başlık sırasına bire bir uyar.

PDF/XLS satır sayısı eşleşir.

1000+ satırlık rapor <10 saniyede üretilir.

Rapor üretimleri audit log’a kaydedilir.

4. NAVİGASYON VE KULLANICI SENARYOSU
Tam Süreç (Sıfırdan Kurs ve Sertifika)
/groups → Yeni grup oluştur.

/courses → Kurs oluştur, gruba bağla.

/students → Yeni kursiyer kaydı, evrak+ödeme yükle.

/courses/[id]#students → Kursiyerleri ata.

/courses/[id]#schedule → Ders programı oluştur.

/mebbis-transfer → Dry run → Live aktarım.

MEBBİS’te onayla.

/exams → Sınav oluştur, notları gir.

/reports → Sertifika listesi al.

5. GÜVENLİK, LOG VE TEST
JWT Authentication + Tenant bazlı yetkilendirme

Audit Log: tüm transfer ve rapor üretim istekleri kayıtlı

Masking: TCKN kısmi gösterim

MockMebbisAdapter ile test

Unit + Integration test senaryoları (Hangfire + API + UI)

6. KABUL KRİTERLERİ (GENEL)
Tüm akış Ventec işleyişini birebir karşılamalı.

Dry run / live ayrımı işlevsel.

Raporlar MEB formatında alınabilir.

Kursiyer → Kurs → MEBBİS → Sınav → Sertifika zinciri kesintisiz ilerlemeli.

Her işlem (aktarım, rapor, sınav girişi) audit log’a yazılmalı.

SONUÇ
Bu tekil doküman, SRC Kurs Yönetim Sistemi’nin:

Sayfa bazlı UX/UI planını,

MEBBİS entegrasyon mantığını,

Teknik alt bileşenlerin (Adapter & Report Engine) tam modelini

birlikte içerir.
Cursor’a veya başka geliştirme araçlarına verildiğinde, uygulama iskeleti doğrudan bu yapıdan oluşturulabilir.

yaml
Copy code

---

İstersen ben bunu `.md` dosyası olarak kaydedip sana indirme linki de oluşturabilirim — ister misin?





