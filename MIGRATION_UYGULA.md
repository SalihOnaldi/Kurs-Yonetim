# Migration Uygulama Talimatları

## ⚠️ HATA: "Invalid column name 'Username', 'ExpireDate', 'PasswordHash'"

Bu hata, migration'ın henüz veritabanına uygulanmadığını gösteriyor.

## 🔧 Çözüm

### Yöntem 1: Otomatik (Önerilen)
`basla.bat` dosyasını çalıştırın. Migration otomatik uygulanacak.

### Yöntem 2: Manuel Migration Uygulama

Backend terminalinde (veya yeni bir PowerShell penceresi):

```powershell
cd "C:\Users\0000K04-ULPC-01\Desktop\SRC Projesi\ProjeDosyasi\V1"
dotnet ef database update --project src\SRC.Infrastructure\SRC.Infrastructure.csproj --startup-project src\SRC.Presentation.Api\SRC.Presentation.Api.csproj
```

### Yöntem 3: SQL ile Manuel Ekleme (Hızlı Çözüm)

Eğer migration çalışmazsa, SQL Server Management Studio'da şu komutları çalıştırın:

```sql
USE SrcCourseManagement; -- Veritabanı adınızı buraya yazın

-- Tenant tablosuna yeni kolonları ekle
ALTER TABLE Tenants ADD Username NVARCHAR(MAX) NULL;
ALTER TABLE Tenants ADD PasswordHash NVARCHAR(MAX) NULL;
ALTER TABLE Tenants ADD ExpireDate DATETIME2 NULL;

-- Unique index ekle
CREATE UNIQUE INDEX IX_Tenants_Username ON Tenants(Username) WHERE Username IS NOT NULL;

-- AccountTransactions tablosunu oluştur
CREATE TABLE AccountTransactions (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    TenantId NVARCHAR(450) NOT NULL,
    TransactionDate DATETIME2 NOT NULL,
    Type NVARCHAR(MAX) NOT NULL,
    Category NVARCHAR(MAX) NOT NULL,
    Description NVARCHAR(MAX) NOT NULL,
    Amount DECIMAL(18,2) NOT NULL,
    Reference NVARCHAR(MAX) NULL,
    Notes NVARCHAR(MAX) NULL,
    CreatedBy NVARCHAR(MAX) NULL,
    CreatedAt DATETIME2 NOT NULL,
    UpdatedAt DATETIME2 NULL
);

-- Index'ler
CREATE INDEX IX_AccountTransactions_TenantId_TransactionDate ON AccountTransactions(TenantId, TransactionDate);
CREATE INDEX IX_AccountTransactions_TenantId_Type_Category ON AccountTransactions(TenantId, Type, Category);
```

## ✅ Kontrol

Migration uygulandıktan sonra, SQL Server Management Studio'da:

```sql
SELECT COLUMN_NAME, DATA_TYPE 
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_NAME = 'Tenants' 
AND COLUMN_NAME IN ('Username', 'PasswordHash', 'ExpireDate');
```

Bu sorgu 3 satır döndürmeli.

## 🚀 Sonraki Adım

Migration uygulandıktan sonra:
1. Backend'i yeniden başlatın
2. HQ Dashboard'a gidin
3. "Yeni Lisans Ekle" butonunu test edin

