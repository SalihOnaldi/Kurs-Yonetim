-- admin.kurs kullanıcısını kontrol et ve düzelt
-- Bu SQL'i SQL Server Management Studio'da çalıştırın

USE SrcCourseManagement; -- Veritabanı adınızı buraya yazın

-- 1. Kullanıcıyı kontrol et
SELECT 
    Id, 
    Username, 
    Role, 
    IsActive, 
    Email,
    FullName
FROM Users 
WHERE Username = 'admin.kurs';

-- 2. UserTenant ilişkisini kontrol et
SELECT 
    ut.Id,
    ut.UserId,
    ut.TenantId,
    u.Username,
    u.Role,
    t.Name AS TenantName
FROM UserTenants ut
INNER JOIN Users u ON ut.UserId = u.Id
INNER JOIN Tenants t ON ut.TenantId = t.Id
WHERE u.Username = 'admin.kurs';

-- 3. Eğer kullanıcı yoksa veya şifre yanlışsa, şunu çalıştır:
-- Önce kullanıcıyı sil (eğer varsa)
DELETE FROM UserTenants WHERE UserId IN (SELECT Id FROM Users WHERE Username = 'admin.kurs');
DELETE FROM Users WHERE Username = 'admin.kurs';

-- Yeni kullanıcı oluştur (BCrypt hash: Kurs123!)
-- NOT: BCrypt hash'i C# kodundan almanız gerekiyor, bu örnek hash değildir
-- Doğru hash için API'yi çalıştırıp SeedData'nın çalışmasını bekleyin

-- 4. Tenant'ları kontrol et
SELECT Id, Name, IsActive FROM Tenants;

-- 5. Eğer UserTenant ilişkisi yoksa, manuel ekle:
-- Önce UserId'yi bul
DECLARE @UserId INT;
SELECT @UserId = Id FROM Users WHERE Username = 'admin.kurs';

-- TenantId'yi bul
DECLARE @TenantId NVARCHAR(450);
SELECT @TenantId = Id FROM Tenants WHERE Id = 'MAVI-BEYAZ-AKADEMI';

-- UserTenant ilişkisini ekle
IF NOT EXISTS (SELECT 1 FROM UserTenants WHERE UserId = @UserId AND TenantId = @TenantId)
BEGIN
    INSERT INTO UserTenants (Id, UserId, TenantId)
    VALUES (NEWID(), @UserId, @TenantId);
    PRINT 'UserTenant ilişkisi eklendi';
END
ELSE
BEGIN
    PRINT 'UserTenant ilişkisi zaten var';
END

