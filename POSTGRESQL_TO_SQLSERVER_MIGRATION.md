# 🔄 PostgreSQL → SQL Server Migration Rehberi

## ⚠️ Geçiş Zorluğu Değerlendirmesi

**Zorluk Seviyesi**: ⭐⭐⭐⭐ (4/5 - Orta-Zor)

### Neden Zor?

1. **Farklı SQL Dialect'leri**: PostgreSQL ve SQL Server farklı SQL syntax'ları kullanır
2. **Veri Migration Gerekir**: Mevcut verileri taşımak gerekir
3. **EF Core Migration'ları Yeniden Oluşturulmalı**: Tüm migration'lar SQL Server için yeniden yazılmalı
4. **Kod Değişiklikleri**: Bazı özellikler farklı çalışır
5. **Downtime**: Geçiş sırasında sistem kapanabilir

---

## 📊 PostgreSQL vs SQL Server Farkları

### 1. Identity Columns

**PostgreSQL:**
```sql
CREATE TABLE Students (
    Id SERIAL PRIMARY KEY,  -- veya GENERATED ALWAYS AS IDENTITY
    ...
);
```

**SQL Server:**
```sql
CREATE TABLE Students (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    ...
);
```

### 2. String Functions

**PostgreSQL:**
```sql
SELECT UPPER(name) FROM Students;
SELECT LENGTH(name) FROM Students;
SELECT SUBSTRING(name, 1, 10) FROM Students;
```

**SQL Server:**
```sql
SELECT UPPER(name) FROM Students;  -- Aynı
SELECT LEN(name) FROM Students;    -- LENGTH yerine LEN
SELECT SUBSTRING(name, 1, 10) FROM Students;  -- Aynı
```

### 3. Date Functions

**PostgreSQL:**
```sql
SELECT NOW();
SELECT CURRENT_DATE;
SELECT EXTRACT(YEAR FROM date_column);
```

**SQL Server:**
```sql
SELECT GETDATE();
SELECT CAST(GETDATE() AS DATE);
SELECT YEAR(date_column);
```

### 4. Boolean Type

**PostgreSQL:**
```sql
IsActive BOOLEAN DEFAULT TRUE
```

**SQL Server:**
```sql
IsActive BIT DEFAULT 1  -- BOOLEAN yok, BIT kullanılır
```

### 5. Case Sensitivity

**PostgreSQL:**
- Case-sensitive (varsayılan)
- `"Students"` ve `students` farklı tablolar

**SQL Server:**
- Case-insensitive (varsayılan)
- `Students` ve `students` aynı tablo

### 6. JSON Support

**PostgreSQL:**
```sql
SELECT data->>'key' FROM table;
```

**SQL Server:**
```sql
SELECT JSON_VALUE(data, '$.key') FROM table;
```

---

## 🔄 Migration Adımları

### Adım 1: Veri Export (PostgreSQL'den)

#### Yöntem A: pg_dump (Önerilen)

```bash
# Tüm veritabanını export et
pg_dump -h railway-host -U postgres -d railway -F c -f backup.dump

# Sadece veri (schema olmadan)
pg_dump -h railway-host -U postgres -d railway --data-only -F c -f data.dump

# Sadece schema (veri olmadan)
pg_dump -h railway-host -U postgres -d railway --schema-only -F c -f schema.dump
```

#### Yöntem B: CSV Export

```sql
-- PostgreSQL'de
COPY (SELECT * FROM Students) TO '/tmp/students.csv' WITH CSV HEADER;
COPY (SELECT * FROM Enrollments) TO '/tmp/enrollments.csv' WITH CSV HEADER;
-- ... diğer tablolar
```

---

### Adım 2: EF Core Provider Değiştir

#### 1. NuGet Paketlerini Güncelle

```bash
cd V1/src/SRC.Infrastructure

# PostgreSQL paketini kaldır
dotnet remove package Npgsql.EntityFrameworkCore.PostgreSQL

# SQL Server paketini ekle
dotnet add package Microsoft.EntityFrameworkCore.SqlServer
```

#### 2. Program.cs Güncelle

**Değiştir:**
```csharp
builder.Services.AddDbContext<SrcDbContext>(options =>
    options.UseNpgsql(connectionString));
```

**Şununla:**
```csharp
builder.Services.AddDbContext<SrcDbContext>(options =>
    options.UseSqlServer(connectionString));
```

**Using ekle:**
```csharp
using Microsoft.EntityFrameworkCore;  // Zaten var
// Npgsql.EntityFrameworkCore.PostgreSQL using'ini kaldır
```

#### 3. DbContext Güncelle

`SrcDbContext.cs` dosyasında PostgreSQL'e özel kodlar varsa kaldır:

```csharp
// PostgreSQL'e özel kodlar yoksa değişiklik gerekmez
// EF Core provider değişikliği yeterli
```

---

### Adım 3: Migration'ları Yeniden Oluştur

#### Mevcut Migration'ları Sil

```bash
cd V1/src/SRC.Presentation.Api

# Migration klasörünü temizle (DİKKAT: Backup al!)
# V1/src/SRC.Infrastructure/Migrations/ klasöründeki tüm dosyaları sil
```

#### Yeni Migration Oluştur

```bash
cd V1/src/SRC.Presentation.Api

# SQL Server için yeni migration oluştur
dotnet ef migrations add InitialSqlServer --project ../SRC.Infrastructure --startup-project .
```

#### Migration'ları Kontrol Et

Oluşturulan migration dosyalarını kontrol et, PostgreSQL'e özel syntax varsa düzelt:

```csharp
// Örnek: PostgreSQL'de SERIAL, SQL Server'da IDENTITY
migrationBuilder.CreateTable(
    name: "Students",
    columns: table => new
    {
        Id = table.Column<int>(type: "int", nullable: false)
            .Annotation("SqlServer:Identity", "1, 1"),  // ✅ SQL Server
        // PostgreSQL'de: .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn)
    },
    constraints: table =>
    {
        table.PrimaryKey("PK_Students", x => x.Id);
    });
```

---

### Adım 4: Veri Import (SQL Server'a)

#### Yöntem A: SQL Server Management Studio (SSMS)

1. **SSMS'i Aç**
2. **SQL Server'a Bağlan** (Azure SQL veya kendi sunucun)
3. **Database Oluştur**
   ```sql
   CREATE DATABASE srcdb;
   GO
   USE srcdb;
   GO
   ```

4. **Migration'ları Uygula**
   ```bash
   dotnet ef database update --project ../SRC.Infrastructure --startup-project . --connection "<SQL Server connection string>"
   ```

5. **Veri Import**
   - PostgreSQL'den export ettiğin CSV dosyalarını kullan
   - SSMS → Tasks → Import Data
   - Veya BCP utility kullan

#### Yöntem B: BCP Utility (Büyük Veri İçin)

```bash
# CSV'den SQL Server'a import
bcp srcdb.dbo.Students in students.csv -S server.database.windows.net -U username -P password -c -t, -F 2
```

#### Yöntem C: SQL Script ile

```sql
-- PostgreSQL'den export ettiğin verileri SQL Server'a insert et
-- Örnek:
INSERT INTO Students (Id, TcKimlikNo, FirstName, LastName, ...)
VALUES 
    (1, '12345678901', 'Ahmet', 'Yılmaz', ...),
    (2, '12345678902', 'Mehmet', 'Demir', ...);
-- ... diğer kayıtlar
```

---

### Adım 5: Veri Dönüşümleri

Bazı veri tipleri dönüştürülmeli:

#### Boolean → Bit

```sql
-- PostgreSQL'de: TRUE/FALSE
-- SQL Server'da: 1/0

UPDATE Students SET IsActive = CASE WHEN IsActive = TRUE THEN 1 ELSE 0 END;
```

#### Timestamp Formatı

```sql
-- PostgreSQL: '2024-01-01 12:00:00'::timestamp
-- SQL Server: '2024-01-01 12:00:00'

-- Genelde aynı format çalışır, ama kontrol et
```

#### JSON Columns

```sql
-- PostgreSQL'de JSONB kullanıyorsan
-- SQL Server'da NVARCHAR(MAX) veya JSON tipine dönüştür
```

---

### Adım 6: Connection String Güncelle

**PostgreSQL:**
```
Host=xxx.railway.app;Port=5432;Database=railway;Username=postgres;Password=xxx
```

**SQL Server:**
```
Server=tcp:xxx.database.windows.net,1433;Initial Catalog=srcdb;User ID=xxx;Password=xxx;Encrypt=True;TrustServerCertificate=False;Connection Timeout=30;
```

---

## ⚠️ Dikkat Edilmesi Gerekenler

### 1. Foreign Key Constraints

```sql
-- PostgreSQL'de: ON DELETE CASCADE
-- SQL Server'da: Aynı syntax, ama kontrol et
```

### 2. Indexes

```sql
-- PostgreSQL: CREATE INDEX idx_name ON table(column);
-- SQL Server: CREATE INDEX idx_name ON table(column);
-- Genelde aynı, ama kontrol et
```

### 3. Stored Procedures / Functions

Eğer PostgreSQL'de stored procedure/functions kullanıyorsan, SQL Server syntax'ına çevirmen gerekir.

### 4. Full-Text Search

```sql
-- PostgreSQL: tsvector, tsquery
-- SQL Server: CONTAINS, FREETEXT
-- Tamamen farklı syntax
```

### 5. Case Sensitivity

```sql
-- PostgreSQL: Case-sensitive (varsayılan)
-- SQL Server: Case-insensitive (varsayılan)

-- SQL Server'da case-sensitive yapmak için:
ALTER DATABASE srcdb COLLATE SQL_Latin1_General_CP1_CS_AS;
```

---

## 🔧 Otomatik Migration Script Örneği

### PowerShell Script (PostgreSQL → SQL Server)

```powershell
# 1. PostgreSQL'den veri export
$pgConnection = "Host=xxx.railway.app;Port=5432;Database=railway;Username=postgres;Password=xxx"
$tables = @("Students", "Enrollments", "Payments", ...)

foreach ($table in $tables) {
    # CSV export
    psql $pgConnection -c "COPY $table TO STDOUT WITH CSV HEADER" > "$table.csv"
}

# 2. SQL Server'a import
$sqlConnection = "Server=tcp:xxx.database.windows.net,1433;Database=srcdb;User ID=xxx;Password=xxx"
foreach ($table in $tables) {
    # BCP ile import
    bcp "srcdb.dbo.$table" in "$table.csv" -S xxx.database.windows.net -U xxx -P xxx -c -t, -F 2
}
```

---

## 📊 Zorluk Matrisi

| İşlem | Zorluk | Süre | Risk |
|-------|--------|------|------|
| EF Core Provider Değiştir | ⭐⭐ | 10 dk | Düşük |
| Migration Yeniden Oluştur | ⭐⭐⭐ | 30 dk | Orta |
| Veri Export (PostgreSQL) | ⭐⭐ | 15 dk | Düşük |
| Veri Import (SQL Server) | ⭐⭐⭐ | 30-60 dk | Orta |
| Veri Dönüşümleri | ⭐⭐⭐⭐ | 1-2 saat | Yüksek |
| Test ve Doğrulama | ⭐⭐⭐⭐ | 2-4 saat | Yüksek |
| **TOPLAM** | **⭐⭐⭐⭐** | **4-8 saat** | **Orta-Yüksek** |

---

## ✅ En İyi Pratikler

1. **Backup Al**: PostgreSQL'den tam backup al
2. **Test Ortamında Dene**: Önce test ortamında geçiş yap
3. **Veri Doğrulama**: Her tablo için kayıt sayısını kontrol et
4. **Downtime Planla**: Geçiş sırasında sistem kapanabilir
5. **Rollback Planı**: Geri dönüş planı hazırla

---

## 🆘 Sorun Giderme

### Veri Import Hatası

```sql
-- Identity insert aç (ID'leri korumak için)
SET IDENTITY_INSERT Students ON;
-- Import işlemi
SET IDENTITY_INSERT Students OFF;
```

### Foreign Key Hatası

```sql
-- Foreign key constraint'leri geçici olarak kapat
ALTER TABLE Enrollments NOCHECK CONSTRAINT FK_Enrollments_Students;
-- Import işlemi
ALTER TABLE Enrollments CHECK CONSTRAINT FK_Enrollments_Students;
```

### Encoding Sorunları

```sql
-- Türkçe karakterler için
ALTER DATABASE srcdb COLLATE Turkish_CI_AS;
```

---

## 💡 Sonuç

**PostgreSQL → SQL Server geçişi:**
- ⚠️ **Orta-Zor** seviyede
- ⏱️ **4-8 saat** sürebilir
- 🔄 **Veri migration** gerekir
- 📝 **Kod değişiklikleri** gerekir
- 🛠️ **Test** şart

**Öneri**: Eğer SQL Server kullanmaya devam edeceksen, baştan Azure SQL Database kullan. PostgreSQL'e geçip sonra SQL Server'a dönmek yerine direkt SQL Server ile başla.

---

## 📚 Kaynaklar

- PostgreSQL → SQL Server Migration: https://docs.microsoft.com/sql/relational-databases/migration
- EF Core Providers: https://docs.microsoft.com/ef/core/providers/
- BCP Utility: https://docs.microsoft.com/sql/tools/bcp-utility

