-- ============================================
-- MIGRATION: Add License Fields to Tenants
-- ============================================
-- Bu script'i SQL Server Management Studio'da çalıştırın
-- Veritabanı: srcdb

USE srcdb;
GO

-- 1. Tenant tablosuna yeni kolonları ekle
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Tenants') AND name = 'Username')
BEGIN
    ALTER TABLE Tenants ADD Username NVARCHAR(450) NULL;
    PRINT 'Username kolonu eklendi.';
END
ELSE
BEGIN
    PRINT 'Username kolonu zaten mevcut.';
END
GO

-- Username nvarchar(max) ise index icin uygun olacak sekilde daralt
IF EXISTS (
    SELECT 1
    FROM sys.columns c
    JOIN sys.types t ON c.user_type_id = t.user_type_id
    WHERE c.object_id = OBJECT_ID('Tenants')
      AND c.name = 'Username'
      AND t.name = 'nvarchar'
      AND c.max_length = -1  -- NVARCHAR(MAX)
)
BEGIN
    ALTER TABLE Tenants ALTER COLUMN Username NVARCHAR(450) NULL;
    PRINT 'Username kolonu NVARCHAR(450) olarak guncellendi.';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Tenants') AND name = 'PasswordHash')
BEGIN
    ALTER TABLE Tenants ADD PasswordHash NVARCHAR(MAX) NULL;
    PRINT 'PasswordHash kolonu eklendi.';
END
ELSE
BEGIN
    PRINT 'PasswordHash kolonu zaten mevcut.';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Tenants') AND name = 'ExpireDate')
BEGIN
    ALTER TABLE Tenants ADD ExpireDate DATETIME2 NULL;
    PRINT 'ExpireDate kolonu eklendi.';
END
ELSE
BEGIN
    PRINT 'ExpireDate kolonu zaten mevcut.';
END
GO

-- 2. Unique index ekle (Username için)
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Tenants_Username' AND object_id = OBJECT_ID('Tenants'))
BEGIN
    CREATE UNIQUE INDEX IX_Tenants_Username 
    ON Tenants(Username) 
    WHERE Username IS NOT NULL;
    PRINT 'IX_Tenants_Username index''i eklendi.';
END
ELSE
BEGIN
    PRINT 'IX_Tenants_Username index''i zaten mevcut.';
END
GO

-- 3. AccountTransactions tablosunu oluştur
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'AccountTransactions')
BEGIN
    CREATE TABLE AccountTransactions (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        TenantId NVARCHAR(450) NOT NULL,
        TransactionDate DATETIME2 NOT NULL,
        Type NVARCHAR(100) NOT NULL,
        Category NVARCHAR(100) NOT NULL,
        Description NVARCHAR(MAX) NOT NULL,
        Amount DECIMAL(18,2) NOT NULL,
        Reference NVARCHAR(MAX) NULL,
        Notes NVARCHAR(MAX) NULL,
        CreatedBy NVARCHAR(MAX) NULL,
        CreatedAt DATETIME2 NOT NULL,
        UpdatedAt DATETIME2 NULL
    );
    PRINT 'AccountTransactions tablosu oluşturuldu.';
END
ELSE
BEGIN
    PRINT 'AccountTransactions tablosu zaten mevcut.';
END
GO

-- Var olan tabloda Type/Category NVARCHAR(MAX) ise index icin daralt
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('AccountTransactions') AND name = 'Type')
BEGIN
    IF EXISTS (
        SELECT 1
        FROM sys.columns c
        JOIN sys.types t ON c.user_type_id = t.user_type_id
        WHERE c.object_id = OBJECT_ID('AccountTransactions')
          AND c.name = 'Type'
          AND t.name = 'nvarchar'
          AND c.max_length = -1 -- NVARCHAR(MAX)
    )
    BEGIN
        ALTER TABLE AccountTransactions ALTER COLUMN Type NVARCHAR(100) NOT NULL;
        PRINT 'AccountTransactions.Type NVARCHAR(100) olarak guncellendi.';
    END
END
GO

IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('AccountTransactions') AND name = 'Category')
BEGIN
    IF EXISTS (
        SELECT 1
        FROM sys.columns c
        JOIN sys.types t ON c.user_type_id = t.user_type_id
        WHERE c.object_id = OBJECT_ID('AccountTransactions')
          AND c.name = 'Category'
          AND t.name = 'nvarchar'
          AND c.max_length = -1 -- NVARCHAR(MAX)
    )
    BEGIN
        ALTER TABLE AccountTransactions ALTER COLUMN Category NVARCHAR(100) NOT NULL;
        PRINT 'AccountTransactions.Category NVARCHAR(100) olarak guncellendi.';
    END
END
GO

-- 4. AccountTransactions için index'ler
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_AccountTransactions_TenantId_TransactionDate' AND object_id = OBJECT_ID('AccountTransactions'))
BEGIN
    CREATE INDEX IX_AccountTransactions_TenantId_TransactionDate 
    ON AccountTransactions(TenantId, TransactionDate);
    PRINT 'IX_AccountTransactions_TenantId_TransactionDate index''i eklendi.';
END
ELSE
BEGIN
    PRINT 'IX_AccountTransactions_TenantId_TransactionDate index''i zaten mevcut.';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_AccountTransactions_TenantId_Type_Category' AND object_id = OBJECT_ID('AccountTransactions'))
BEGIN
    CREATE INDEX IX_AccountTransactions_TenantId_Type_Category 
    ON AccountTransactions(TenantId, Type, Category);
    PRINT 'IX_AccountTransactions_TenantId_Type_Category index''i eklendi.';
END
ELSE
BEGIN
    PRINT 'IX_AccountTransactions_TenantId_Type_Category index''i zaten mevcut.';
END
GO

-- 5. Kontrol sorgusu
SELECT 
    'Tenants Tablosu' AS Tablo,
    COLUMN_NAME AS Kolon,
    DATA_TYPE AS Tip
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_NAME = 'Tenants' 
AND COLUMN_NAME IN ('Username', 'PasswordHash', 'ExpireDate')
UNION ALL
SELECT 
    'AccountTransactions Tablosu' AS Tablo,
    COLUMN_NAME AS Kolon,
    DATA_TYPE AS Tip
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_NAME = 'AccountTransactions'
ORDER BY Tablo, Kolon;
GO

PRINT '========================================';
PRINT 'MIGRATION TAMAMLANDI!';
PRINT '========================================';
GO

