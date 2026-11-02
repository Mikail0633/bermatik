-- =====================================================================
-- Bermatik — Geliştirme için en az veri (YALNIZCA BermatikDev'e yüklenir)
-- Uydurma dükkân YOK. Sitede gerçek dükkânlar (OpenStreetMap + admin) görünür.
--   • admin@bermatik.test        : geliştirme admin hesabı
--   • test-berber@bermatik.test  : gizli test dükkânının sahibi (dükkân "onay bekliyor",
--                                   sitede görünmez; randevu/sıra ekranlarını denemek için)
-- Şifreler: Deneme123!
-- =====================================================================
SET NOCOUNT ON;
IF DB_NAME() <> 'BermatikDev' THROW 50000, N'Örnek veri yalnızca BermatikDev veritabanına yüklenebilir.', 1;
IF EXISTS (SELECT 1 FROM data.Users WHERE Email = 'admin@bermatik.test') BEGIN PRINT N'Geliştirme verisi zaten yüklü.'; RETURN; END

DECLARE @pw nvarchar(255) = N'$(PW_HASH)';
DECLARE @id TABLE (Id uniqueidentifier);
DECLARE @shop TABLE (Id uniqueidentifier, Code varchar(12));
DECLARE @admin uniqueidentifier, @owner uniqueidentifier, @s uniqueidentifier, @hood int;

INSERT @id EXEC api.Auth_Register N'admin@bermatik.test', @pw, N'Geliştirme', N'Admin', 1990, N'05550000001', @KvkkAccepted = 1;
SELECT @admin = Id FROM @id; DELETE @id;
UPDATE data.Users SET Role = 'admin' WHERE Id = @admin;

INSERT @id EXEC api.Auth_Register N'test-berber@bermatik.test', @pw, N'Test', N'Berber', 1985, N'05550000002', @KvkkAccepted = 1;
SELECT @owner = Id FROM @id; DELETE @id;
SELECT TOP (1) @hood = n.Id FROM data.Neighborhoods n JOIN data.Districts d ON d.Id = n.DistrictId
WHERE d.ProvinceId = 6 AND d.Name = N'Pursaklar' AND n.Name LIKE N'Saray Cumhuriyet%';
DECLARE @district int = (SELECT DistrictId FROM data.Neighborhoods WHERE Id = @hood);
INSERT @shop EXEC api.Shop_Apply @owner, 'erkek', N'Test Berber (gizli)', N'Geliştirme testleri için gizli dükkân.', N'05550000002',
  6, @district, @hood, N'Test Sokak', N'1', NULL, 40.061000, 32.922000;
SELECT @s = Id FROM @shop;

DECLARE @total int = (SELECT COUNT(*) FROM data.Users);
PRINT CONCAT(N'Geliştirme verisi yüklendi: ', @total, N' kullanıcı, 1 gizli test dükkânı.');
