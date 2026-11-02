-- =====================================================================
-- Bermatik — Gizli test dükkânına saat, personel ve hizmet ekler (YALNIZCA BermatikDev)
-- Dükkân "onay bekliyor" durumunda kalır; sitede görünmez.
-- Randevu/sıra ekranlarını denerken geçici olarak yayına alınır, sonra geri gizlenir.
-- =====================================================================
SET NOCOUNT ON;
IF DB_NAME() <> 'BermatikDev' THROW 50000, N'Yalnızca BermatikDev.', 1;
DECLARE @owner uniqueidentifier = (SELECT Id FROM data.Users WHERE Email = 'test-berber@bermatik.test');
DECLARE @s uniqueidentifier = (SELECT TOP 1 Id FROM data.Shops WHERE OwnerId = @owner);
IF @s IS NULL OR EXISTS (SELECT 1 FROM data.Staff WHERE ShopId = @s) BEGIN PRINT N'Test dükkânı hazır.'; RETURN; END

DECLARE @id TABLE (Id uniqueidentifier);
EXEC api.ShopHours_Set @owner, @s, N'[{"weekday":1,"opensAt":"09:00","closesAt":"21:00"},{"weekday":2,"opensAt":"09:00","closesAt":"21:00"},{"weekday":3,"opensAt":"09:00","closesAt":"21:00"},{"weekday":4,"opensAt":"09:00","closesAt":"21:00"},{"weekday":5,"opensAt":"09:00","closesAt":"21:00"},{"weekday":6,"opensAt":"09:00","closesAt":"21:00"},{"weekday":7,"opensAt":"00:00","closesAt":"23:59:59"}]';
INSERT @id EXEC api.Staff_Save @owner, @s, NULL, N'Mehmet', N'Usta'; DELETE @id;
INSERT @id EXEC api.Staff_Save @owner, @s, NULL, N'Can', N'Kalfa'; DELETE @id;
DECLARE @c1 int = (SELECT Id FROM data.ServiceCategories WHERE Slug = 'sac-kesimi');
DECLARE @c2 int = (SELECT Id FROM data.ServiceCategories WHERE Slug = 'sakal');
DECLARE @c3 int = (SELECT Id FROM data.ServiceCategories WHERE Slug = 'sac-sakal');
INSERT @id EXEC api.ShopService_Save @owner, @s, NULL, @c1, N'Saç Kesimi', NULL, 350, 30; DELETE @id;
INSERT @id EXEC api.ShopService_Save @owner, @s, NULL, @c2, N'Sakal Traşı', NULL, 200, 20; DELETE @id;
INSERT @id EXEC api.ShopService_Save @owner, @s, NULL, @c3, N'Saç + Sakal', NULL, 500, 45; DELETE @id;
PRINT N'Test dükkânına saat, 2 personel ve 3 hizmet eklendi.';

-- Geliştirme hesapları e-postası doğrulanmış sayılır
UPDATE data.Users SET EmailVerifiedAt = SYSUTCDATETIME() WHERE Email LIKE N'%@bermatik.test' AND EmailVerifiedAt IS NULL;
GO
