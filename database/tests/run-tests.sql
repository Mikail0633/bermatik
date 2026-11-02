-- =====================================================================
-- Bermatik — Senaryo testleri
-- YALNIZCA test veritabanında çalıştırın:
--   npm run db:test
-- Testler sitenin kullandığı kısıtlı rolle (bermatik_app) çalışır.
-- =====================================================================
SET NOCOUNT ON;
IF DB_NAME() NOT LIKE '%Test' THROW 50000, N'Testler yalnızca *Test veritabanında çalıştırılabilir.', 1;

IF DATABASE_PRINCIPAL_ID('test_app') IS NULL CREATE USER test_app WITHOUT LOGIN;
ALTER ROLE bermatik_app ADD MEMBER test_app;

CREATE TABLE #r (No int IDENTITY, Name nvarchar(200), Ok bit, Info nvarchar(2000));
CREATE TABLE #id (Id uniqueidentifier);
CREATE TABLE #row (Id uniqueidentifier, Code varchar(12));
CREATE TABLE #q (Id uniqueidentifier, TicketNo int);

DECLARE @admin uniqueidentifier, @owner uniqueidentifier, @worker uniqueidentifier, @cust uniqueidentifier, @cust2 uniqueidentifier,
        @shop uniqueidentifier, @code varchar(12), @staff uniqueidentifier, @svc1 uniqueidentifier, @svc2 uniqueidentifier,
        @appt uniqueidentifier, @invite char(12), @entry uniqueidentifier, @prod uniqueidentifier, @order uniqueidentifier,
        @n int, @s nvarchar(400), @kadikoy int, @caferaga int, @cankayaHood int, @catSac int, @catSakal int, @catManikur int,
        @tomorrowNoon datetime2(0) = DATEADD(hour, 12, CAST(DATEADD(day, 1, CAST(data.fn_IstanbulNow() AS date)) AS datetime2(0)));

SELECT @kadikoy = Id FROM data.Districts WHERE ProvinceId = 34 AND Name = N'Kadıköy';
SELECT TOP 1 @caferaga = Id FROM data.Neighborhoods WHERE DistrictId = @kadikoy AND Name LIKE N'Caferağa%';
SELECT TOP 1 @cankayaHood = n.Id FROM data.Neighborhoods n JOIN data.Districts d ON d.Id = n.DistrictId WHERE d.ProvinceId = 6;
SELECT @catSac = Id FROM data.ServiceCategories WHERE Slug = 'sac-kesimi';
SELECT @catSakal = Id FROM data.ServiceCategories WHERE Slug = 'sakal';
SELECT @catManikur = Id FROM data.ServiceCategories WHERE Slug = 'manikur';

INSERT #r VALUES (N'Adres verisi: 81 il, 973 ilçe', CASE WHEN (SELECT COUNT(*) FROM data.Provinces) = 81 AND (SELECT COUNT(*) FROM data.Districts) = 973 THEN 1 ELSE 0 END, NULL);
INSERT #r VALUES (N'Slug: İstanbul/Kadıköy → istanbul/kadikoy',
  CASE WHEN EXISTS (SELECT 1 FROM data.Districts d JOIN data.Provinces p ON p.Id = d.ProvinceId WHERE d.Id = @kadikoy AND p.Slug = 'istanbul' AND d.Slug = 'kadikoy') THEN 1 ELSE 0 END, NULL);
INSERT #r VALUES (N'Slugify Türkçe karakter', CASE WHEN data.fn_Slugify(N'Şükrü Usta Berber & Kuaför İĞÇ') = 'sukru-usta-berber-kuafor-igc' THEN 1 ELSE 0 END, data.fn_Slugify(N'Şükrü Usta Berber & Kuaför İĞÇ'));

-- =====================================================================
EXECUTE AS USER = 'test_app';
-- =====================================================================

-- Yetki: site tablolara doğrudan erişemez
BEGIN TRY SELECT @n = COUNT(*) FROM data.Users; INSERT #r VALUES (N'Site tabloları doğrudan okuyamaz', 0, N'okuyabildi'); END TRY
BEGIN CATCH IF XACT_STATE() <> 0 ROLLBACK; INSERT #r VALUES (N'Site tabloları doğrudan okuyamaz', CASE WHEN ERROR_NUMBER() = 229 THEN 1 ELSE 0 END, ERROR_MESSAGE()); END CATCH
BEGIN TRY UPDATE data.Users SET Role = 'admin'; INSERT #r VALUES (N'Site tablolara doğrudan yazamaz', 0, N'yazabildi'); END TRY
BEGIN CATCH IF XACT_STATE() <> 0 ROLLBACK; INSERT #r VALUES (N'Site tablolara doğrudan yazamaz', CASE WHEN ERROR_NUMBER() = 229 THEN 1 ELSE 0 END, ERROR_MESSAGE()); END CATCH

-- Kayıt
INSERT #id EXEC api.Auth_Register N'Admin@Test.com', N'hash', N'Admin', N'Test', 1990, N'0555 111 22 33', @KvkkAccepted = 1; SELECT @admin = Id FROM #id; DELETE #id;
INSERT #id EXEC api.Auth_Register N'owner@test.com', N'hash', N'Ahmet', N'Usta', 1985, N'05551112234', @KvkkAccepted = 1, @IsBusiness = 1; SELECT @owner = Id FROM #id; DELETE #id;
INSERT #id EXEC api.Auth_Register N'worker@test.com', N'hash', N'Mehmet', N'Kalfa', 1995, N'05551112235', @KvkkAccepted = 1; SELECT @worker = Id FROM #id; DELETE #id;
INSERT #id EXEC api.Auth_Register N'cust@test.com', N'hash', N'Ayşe', N'Yılmaz', 1992, N'05321234567', @KvkkAccepted = 1; SELECT @cust = Id FROM #id; DELETE #id;
INSERT #id EXEC api.Auth_Register N'cust2@test.com', N'hash', N'Ali', N'Veli', 1993, N'05551112236', @KvkkAccepted = 1; SELECT @cust2 = Id FROM #id; DELETE #id;
INSERT #r VALUES (N'5 kullanıcı kaydoldu', CASE WHEN @cust2 IS NOT NULL THEN 1 ELSE 0 END, NULL);

-- E-posta doğrulama kodu (dükkân sahibi ve personel)
DECLARE @mailTo TABLE (Email nvarchar(254), FirstName nvarchar(60));
INSERT @mailTo EXEC api.Email_CreateCode @owner, 0x0000000000000000000000000000000000000000000000000000000000000000;
BEGIN TRY EXEC api.Email_CreateCode @owner, 0x01; INSERT #r VALUES (N'Bir dakika dolmadan yeni kod istenemez', 0, NULL); END TRY
BEGIN CATCH INSERT #r VALUES (N'Bir dakika dolmadan yeni kod istenemez', CASE WHEN ERROR_NUMBER() = 50409 THEN 1 ELSE 0 END, ERROR_MESSAGE()); END CATCH
BEGIN TRY EXEC api.Shop_Apply @owner, 'erkek', N'Doğrulanmamış', NULL, N'0216 111 22 33', 34, @kadikoy, @caferaga, N'Moda Caddesi', N'12', NULL, 40.987, 29.026; INSERT #r VALUES (N'E-postası doğrulanmamış işletme dükkân ekleyemez', 0, NULL); END TRY
BEGIN CATCH IF XACT_STATE() <> 0 ROLLBACK; INSERT #r VALUES (N'E-postası doğrulanmamış işletme dükkân ekleyemez', CASE WHEN ERROR_MESSAGE() LIKE N'%doğrulayın%' THEN 1 ELSE 0 END, ERROR_MESSAGE()); END CATCH
BEGIN TRY EXEC api.Email_VerifyCode @owner, 0x1111111111111111111111111111111111111111111111111111111111111111; INSERT #r VALUES (N'Yanlış e-posta kodu reddedilir', 0, NULL); END TRY
BEGIN CATCH INSERT #r VALUES (N'Yanlış e-posta kodu reddedilir', CASE WHEN ERROR_NUMBER() = 50400 THEN 1 ELSE 0 END, ERROR_MESSAGE()); END CATCH
EXEC api.Email_VerifyCode @owner, 0x0000000000000000000000000000000000000000000000000000000000000000;
DELETE @mailTo; INSERT @mailTo EXEC api.Email_CreateCode @worker, 0x2222222222222222222222222222222222222222222222222222222222222222;
EXEC api.Email_VerifyCode @worker, 0x2222222222222222222222222222222222222222222222222222222222222222;
BEGIN TRY EXEC api.Email_CreateCode @owner, 0x03; INSERT #r VALUES (N'Doğru kodla e-posta doğrulanır', 0, NULL); END TRY
BEGIN CATCH INSERT #r VALUES (N'Doğru kodla e-posta doğrulanır', CASE WHEN ERROR_MESSAGE() LIKE N'%zaten doğrulandı%' THEN 1 ELSE 0 END, ERROR_MESSAGE()); END CATCH

BEGIN TRY EXEC api.Auth_Register N'ADMIN@test.com', N'hash', N'X', N'Y', NULL, N'05550000000', @KvkkAccepted = 1; INSERT #r VALUES (N'Aynı e-posta ile ikinci kayıt engellenir', 0, NULL); END TRY
BEGIN CATCH IF XACT_STATE() <> 0 ROLLBACK; INSERT #r VALUES (N'Aynı e-posta ile ikinci kayıt engellenir', CASE WHEN ERROR_NUMBER() = 50409 THEN 1 ELSE 0 END, ERROR_MESSAGE()); END CATCH
BEGIN TRY EXEC api.Auth_Register N'samephone@test.com', N'hash', N'X', N'Y', NULL, N'0532 123 45 67', @KvkkAccepted = 1; INSERT #r VALUES (N'Aynı telefon ile ikinci kayıt engellenir', 0, NULL); END TRY
BEGIN CATCH IF XACT_STATE() <> 0 ROLLBACK; INSERT #r VALUES (N'Aynı telefon ile ikinci kayıt engellenir', CASE WHEN ERROR_NUMBER() = 50409 THEN 1 ELSE 0 END, ERROR_MESSAGE()); END CATCH
BEGIN TRY EXEC api.User_UpdateProfile @cust2, N'Ali', N'Veli', 1993, N'05321234567'; INSERT #r VALUES (N'Profilde başkasının telefonu girilemez', 0, NULL); END TRY
BEGIN CATCH IF XACT_STATE() <> 0 ROLLBACK; INSERT #r VALUES (N'Profilde başkasının telefonu girilemez', CASE WHEN ERROR_NUMBER() = 50409 THEN 1 ELSE 0 END, ERROR_MESSAGE()); END CATCH
BEGIN TRY EXEC api.Auth_Register N'nophone@test.com', N'hash', N'Telefon', N'Yok', @KvkkAccepted = 1; INSERT #r VALUES (N'Telefonsuz kayıt olunamaz', 0, NULL); END TRY
BEGIN CATCH IF XACT_STATE() <> 0 ROLLBACK; INSERT #r VALUES (N'Telefonsuz kayıt olunamaz', CASE WHEN ERROR_NUMBER() = 50400 THEN 1 ELSE 0 END, ERROR_MESSAGE()); END CATCH
BEGIN TRY EXEC api.Auth_Register N'bad-email', N'hash', N'X', N'Y', @KvkkAccepted = 1; INSERT #r VALUES (N'Geçersiz e-posta reddedilir', 0, NULL); END TRY
BEGIN CATCH IF XACT_STATE() <> 0 ROLLBACK; INSERT #r VALUES (N'Geçersiz e-posta reddedilir', CASE WHEN ERROR_NUMBER() = 50400 THEN 1 ELSE 0 END, ERROR_MESSAGE()); END CATCH

-- Hatalı giriş kilidi
EXEC api.Auth_RecordLoginResult @cust2, 0; EXEC api.Auth_RecordLoginResult @cust2, 0; EXEC api.Auth_RecordLoginResult @cust2, 0;
EXEC api.Auth_RecordLoginResult @cust2, 0; EXEC api.Auth_RecordLoginResult @cust2, 0;
DECLARE @login TABLE (Id uniqueidentifier, PasswordHash nvarchar(255), Role varchar(12), IsActive bit, LockedUntil datetime2(0), TotpEnabled bit, TotpSecret nvarchar(64));
INSERT @login EXEC api.Auth_GetUserForLogin N'cust2@test.com';
INSERT #r VALUES (N'5 hatalı girişte hesap kilitlenir', CASE WHEN (SELECT LockedUntil FROM @login) > SYSUTCDATETIME() THEN 1 ELSE 0 END, NULL);
EXEC api.Auth_RecordLoginResult @cust2, 1;

-- Oturum
DECLARE @tok binary(32) = HASHBYTES('SHA2_256', 'oturum-anahtari');
DECLARE @exp datetime2(0) = DATEADD(day, 30, SYSUTCDATETIME());
EXEC api.Auth_CreateSession @cust, @tok, @exp, '127.0.0.1', N'test';
-- Tek oturum: aynı hesapla ikinci giriş, ilk oturumu kapatır
DECLARE @tok2 binary(32) = HASHBYTES('SHA2_256', 'ikinci-cihaz');
EXEC api.Auth_CreateSession @cust, @tok2, @exp, '127.0.0.2', N'ikinci cihaz';
DECLARE @sess1 TABLE (Id uniqueidentifier, Email nvarchar(254), Role varchar(12), FirstName nvarchar(60), LastName nvarchar(60), BirthYear smallint, Phone varchar(16), TotpEnabled bit, ExpiresAt datetime2(0), EmailVerified bit);
INSERT @sess1 EXEC api.Auth_GetSession @tok;
INSERT #r VALUES (N'Aynı hesapla başka yerden girilince ilk oturum kapanır', CASE WHEN NOT EXISTS (SELECT 1 FROM @sess1) THEN 1 ELSE 0 END, NULL);
-- 1 site + 1 telefon: telefondan giriş site oturumunu kapatmaz; ikinci telefon ilk telefonu kapatır
DECLARE @mtok binary(32) = HASHBYTES('SHA2_256', 'telefon-1'), @mtok2 binary(32) = HASHBYTES('SHA2_256', 'telefon-2');
EXEC api.Auth_CreateSession @cust, @mtok, @exp, '127.0.0.3', N'telefon', @Client = 'mobile';
DELETE @sess1; INSERT @sess1 EXEC api.Auth_GetSession @tok2;
INSERT #r VALUES (N'Telefondan giriş site oturumunu kapatmaz', CASE WHEN (SELECT Id FROM @sess1) = @cust THEN 1 ELSE 0 END, NULL);
EXEC api.Auth_CreateSession @cust, @mtok2, @exp, '127.0.0.4', N'telefon 2', @Client = 'mobile';
DELETE @sess1; INSERT @sess1 EXEC api.Auth_GetSession @mtok;
INSERT #r VALUES (N'İkinci telefondan giriş ilk telefonu kapatır', CASE WHEN NOT EXISTS (SELECT 1 FROM @sess1) THEN 1 ELSE 0 END, NULL);
DELETE @sess1; INSERT @sess1 EXEC api.Auth_GetSession @tok2;
INSERT #r VALUES (N'İkinci telefon girişinde site oturumu açık kalır', CASE WHEN (SELECT Id FROM @sess1) = @cust THEN 1 ELSE 0 END, NULL);
EXEC api.Auth_DeleteSession @mtok2;
EXEC api.Auth_DeleteSession @tok2;
EXEC api.Auth_CreateSession @cust, @tok, @exp, '127.0.0.1', N'test';
DECLARE @sess TABLE (Id uniqueidentifier, Email nvarchar(254), Role varchar(12), FirstName nvarchar(60), LastName nvarchar(60), BirthYear smallint, Phone varchar(16), TotpEnabled bit, ExpiresAt datetime2(0), EmailVerified bit);
INSERT @sess EXEC api.Auth_GetSession @tok;
INSERT #r VALUES (N'Oturum açılır ve kullanıcı bulunur', CASE WHEN (SELECT Id FROM @sess) = @cust THEN 1 ELSE 0 END, NULL);
EXEC api.Auth_DeleteSession @tok; DELETE @sess;
INSERT @sess EXEC api.Auth_GetSession @tok;
INSERT #r VALUES (N'Çıkış yapınca oturum kapanır', CASE WHEN NOT EXISTS (SELECT 1 FROM @sess) THEN 1 ELSE 0 END, NULL);

REVERT;
UPDATE data.Users SET Role = 'admin' WHERE Id = @admin;   -- ilk admin elle atanır
EXECUTE AS USER = 'test_app';

-- Dükkân başvurusu
BEGIN TRY EXEC api.Shop_Apply @cust, 'erkek', N'Müşteri Dükkânı', NULL, N'0216 111 22 33', 34, @kadikoy, @caferaga, N'Moda Caddesi', N'12', NULL, 40.987, 29.026; INSERT #r VALUES (N'Müşteri hesabı dükkân ekleyemez', 0, NULL); END TRY
BEGIN CATCH IF XACT_STATE() <> 0 ROLLBACK; INSERT #r VALUES (N'Müşteri hesabı dükkân ekleyemez', CASE WHEN ERROR_NUMBER() = 50403 THEN 1 ELSE 0 END, ERROR_MESSAGE()); END CATCH
BEGIN TRY EXEC api.Shop_Apply @owner, 'erkek', N'Ahmet Usta Berber', NULL, N'0216 111 22 33', 34, @kadikoy, @cankayaHood, N'Moda Caddesi', N'12', NULL, 40.987, 29.026;
  INSERT #r VALUES (N'Uyumsuz il/ilçe/mahalle reddedilir', 0, NULL); END TRY
BEGIN CATCH IF XACT_STATE() <> 0 ROLLBACK; INSERT #r VALUES (N'Uyumsuz il/ilçe/mahalle reddedilir', CASE WHEN ERROR_MESSAGE() LIKE N'%uyuşmuyor%' THEN 1 ELSE 0 END, ERROR_MESSAGE()); END CATCH

INSERT #row EXEC api.Shop_Apply @owner, 'erkek', N'Ahmet Usta Berber', N'Kadıköy''de 20 yıllık berber', N'0216 111 22 33', 34, @kadikoy, @caferaga, N'Moda Caddesi', N'12', N'Kat 1', 40.987, 29.026;
SELECT @shop = Id, @code = Code FROM #row; DELETE #row;
INSERT #r VALUES (N'Dükkân kodu BRM-E-0001', CASE WHEN @code = 'BRM-E-0001' THEN 1 ELSE 0 END, @code);
REVERT;
INSERT #r VALUES (N'Dükkân onay bekliyor, sahibi shop_owner oldu, adres ahmet-usta-berber',
  CASE WHEN (SELECT Status FROM data.Shops WHERE Id = @shop) = 'pending' AND (SELECT Role FROM data.Users WHERE Id = @owner) = 'shop_owner'
        AND (SELECT Slug FROM data.Shops WHERE Id = @shop) = 'ahmet-usta-berber' THEN 1 ELSE 0 END, NULL);
EXECUTE AS USER = 'test_app';

BEGIN TRY EXEC api.Shop_Get @shop, NULL; INSERT #r VALUES (N'Onaysız dükkân ziyaretçiye görünmez', 0, NULL); END TRY
BEGIN CATCH IF XACT_STATE() <> 0 ROLLBACK; INSERT #r VALUES (N'Onaysız dükkân ziyaretçiye görünmez', CASE WHEN ERROR_NUMBER() = 50404 THEN 1 ELSE 0 END, ERROR_MESSAGE()); END CATCH
BEGIN TRY EXEC api.Admin_Shop_SetStatus @owner, @shop, 'approved'; INSERT #r VALUES (N'Sahip kendi dükkânını onaylayamaz', 0, NULL); END TRY
BEGIN CATCH IF XACT_STATE() <> 0 ROLLBACK; INSERT #r VALUES (N'Sahip kendi dükkânını onaylayamaz', CASE WHEN ERROR_NUMBER() = 50403 THEN 1 ELSE 0 END, ERROR_MESSAGE()); END CATCH

EXEC api.Admin_Shop_SetStatus @admin, @shop, 'approved';
INSERT #id EXEC api.Shop_GetIdBySlug 'erkek', 'istanbul', 'kadikoy', 'ahmet-usta-berber';
INSERT #r VALUES (N'Admin onayladı, SEO adresinden dükkân bulunur', CASE WHEN (SELECT Id FROM #id) = @shop THEN 1 ELSE 0 END, NULL); DELETE #id;

-- Aynı isimde ikinci dükkân → ahmet-usta-berber-2, kod 0002
INSERT #row EXEC api.Shop_Apply @owner, 'erkek', N'Ahmet Usta Berber', NULL, N'02161112234', 34, @kadikoy, @caferaga, N'Moda Caddesi', N'14', NULL, 40.987, 29.026;
DECLARE @shop2 uniqueidentifier = (SELECT Id FROM #row); DELETE #row;
REVERT;
INSERT #r VALUES (N'Aynı isimde ikinci dükkân: ahmet-usta-berber-2 / BRM-E-0002',
  CASE WHEN (SELECT Slug + '|' + Code FROM data.Shops WHERE Id = @shop2) = 'ahmet-usta-berber-2|BRM-E-0002' THEN 1 ELSE 0 END,
  (SELECT Slug + '|' + Code FROM data.Shops WHERE Id = @shop2));
EXECUTE AS USER = 'test_app';

-- Çalışma saatleri, personel, hizmetler
EXEC api.ShopHours_Set @owner, @shop, N'[{"weekday":1,"opensAt":"00:00","closesAt":"23:59:59"},{"weekday":2,"opensAt":"00:00","closesAt":"23:59:59"},{"weekday":3,"opensAt":"00:00","closesAt":"23:59:59"},{"weekday":4,"opensAt":"00:00","closesAt":"23:59:59"},{"weekday":5,"opensAt":"00:00","closesAt":"23:59:59"},{"weekday":6,"opensAt":"00:00","closesAt":"23:59:59"},{"weekday":7,"opensAt":"00:00","closesAt":"23:59:59"}]';
BEGIN TRY EXEC api.ShopHours_Set @cust, @shop, N'[]'; INSERT #r VALUES (N'Müşteri çalışma saatini değiştiremez', 0, NULL); END TRY
BEGIN CATCH IF XACT_STATE() <> 0 ROLLBACK; INSERT #r VALUES (N'Müşteri çalışma saatini değiştiremez', CASE WHEN ERROR_NUMBER() = 50403 THEN 1 ELSE 0 END, ERROR_MESSAGE()); END CATCH

INSERT #id EXEC api.Staff_Save @owner, @shop, NULL, N'Mehmet', N'Kalfa'; SELECT @staff = Id FROM #id; DELETE #id;
INSERT #id EXEC api.ShopService_Save @owner, @shop, NULL, @catSac, N'Saç Kesimi', NULL, 300, 30; SELECT @svc1 = Id FROM #id; DELETE #id;
INSERT #id EXEC api.ShopService_Save @owner, @shop, NULL, @catSakal, N'Sakal', N'Ustura ile', 150, 15; SELECT @svc2 = Id FROM #id; DELETE #id;
BEGIN TRY EXEC api.ShopService_Save @owner, @shop, NULL, @catManikur, N'Manikür', NULL, 100, 30; INSERT #r VALUES (N'Erkek dükkânına kadın hizmeti eklenemez', 0, NULL); END TRY
BEGIN CATCH IF XACT_STATE() <> 0 ROLLBACK; INSERT #r VALUES (N'Erkek dükkânına kadın hizmeti eklenemez', CASE WHEN ERROR_NUMBER() = 50400 THEN 1 ELSE 0 END, ERROR_MESSAGE()); END CATCH
BEGIN TRY EXEC api.ShopService_Save @cust, @shop, @svc1, @catSac, N'Saç', NULL, 1, 30; INSERT #r VALUES (N'Müşteri fiyat değiştiremez', 0, NULL); END TRY
BEGIN CATCH IF XACT_STATE() <> 0 ROLLBACK; INSERT #r VALUES (N'Müşteri fiyat değiştiremez', CASE WHEN ERROR_NUMBER() = 50403 THEN 1 ELSE 0 END, ERROR_MESSAGE()); END CATCH

DECLARE @svcList TABLE (Id uniqueidentifier, CategoryId int, CategoryName nvarchar(60), CategorySlug varchar(40), Name nvarchar(80),
  Description nvarchar(1000), OwnDescription nvarchar(1000), Price decimal(10, 2), DurationMinutes smallint, IsActive bit, SortOrder int);
INSERT @svcList EXEC api.ShopService_List @shop, NULL;
INSERT #r VALUES (N'Hizmet açıklaması: boşsa kategori açıklaması gösterilir',
  CASE WHEN (SELECT Description FROM @svcList WHERE Id = @svc1) LIKE N'Yıkama%' AND (SELECT Description FROM @svcList WHERE Id = @svc2) = N'Ustura ile' THEN 1 ELSE 0 END, NULL);
EXEC api.Admin_Settings_Update @admin, @ServiceDescriptionsEnabled = 0; DELETE @svcList;
INSERT @svcList EXEC api.ShopService_List @shop, NULL;
INSERT #r VALUES (N'Admin kapatınca açıklamalar gizlenir', CASE WHEN NOT EXISTS (SELECT 1 FROM @svcList WHERE Description IS NOT NULL) THEN 1 ELSE 0 END, NULL);
EXEC api.Admin_Settings_Update @admin, @ServiceDescriptionsEnabled = 1;

-- Personel daveti
DECLARE @inv TABLE (InviteCode char(12));
INSERT @inv EXEC api.Staff_CreateInvite @owner, @staff; SELECT @invite = InviteCode FROM @inv;
BEGIN TRY EXEC api.Staff_ClaimInvite @worker, 'YANLISKOD'; INSERT #r VALUES (N'Yanlış davet kodu reddedilir', 0, NULL); END TRY
BEGIN CATCH IF XACT_STATE() <> 0 ROLLBACK; INSERT #r VALUES (N'Yanlış davet kodu reddedilir', CASE WHEN ERROR_NUMBER() = 50400 THEN 1 ELSE 0 END, ERROR_MESSAGE()); END CATCH
DECLARE @claim TABLE (StaffId uniqueidentifier, ShopId uniqueidentifier);
INSERT @claim EXEC api.Staff_ClaimInvite @worker, @invite;
INSERT #r VALUES (N'Çalışan davet koduyla dükkâna bağlandı', CASE WHEN (SELECT StaffId FROM @claim) = @staff THEN 1 ELSE 0 END, NULL);

-- Personel telefonu
DECLARE @staffList TABLE (Id uniqueidentifier, DisplayName nvarchar(60), Title nvarchar(60), PhotoPath nvarchar(300), IsActive bit,
  QueueAvgMinutes smallint, Phone varchar(16), ShowPhone bit, HasAccount bit, IsMe bit, IsCertified bit);
EXEC api.Staff_UpdateMyPhone @worker, @staff, N'0544 999 88 77', 0;
INSERT @staffList EXEC api.Staff_List @shop, @cust;
INSERT #r VALUES (N'Personel telefonu gizliyken müşteri göremez', CASE WHEN (SELECT Phone FROM @staffList WHERE Id = @staff) IS NULL THEN 1 ELSE 0 END, NULL);
DELETE @staffList; INSERT @staffList EXEC api.Staff_List @shop, @owner;
INSERT #r VALUES (N'Gizli telefonu dükkân sahibi görür', CASE WHEN (SELECT Phone FROM @staffList WHERE Id = @staff) = '05449998877' THEN 1 ELSE 0 END, NULL);
EXEC api.Staff_UpdateMyPhone @worker, @staff, N'0544 999 88 77', 1;
DELETE @staffList; INSERT @staffList EXEC api.Staff_List @shop, NULL;
INSERT #r VALUES (N'Personel "göster" deyince ziyaretçi de görür', CASE WHEN (SELECT Phone FROM @staffList WHERE Id = @staff) = '05449998877' THEN 1 ELSE 0 END, NULL);
BEGIN TRY EXEC api.Staff_UpdateMyPhone @cust, @staff, N'05000000000', 1; INSERT #r VALUES (N'Başkası personelin telefonunu değiştiremez', 0, NULL); END TRY
BEGIN CATCH IF XACT_STATE() <> 0 ROLLBACK; INSERT #r VALUES (N'Başkası personelin telefonunu değiştiremez', CASE WHEN ERROR_NUMBER() = 50403 THEN 1 ELSE 0 END, ERROR_MESSAGE()); END CATCH
BEGIN TRY EXEC api.Staff_UpdateMyPhone @worker, @staff, N'123', 1; INSERT #r VALUES (N'Geçersiz personel telefonu reddedilir', 0, NULL); END TRY
BEGIN CATCH IF XACT_STATE() <> 0 ROLLBACK; INSERT #r VALUES (N'Geçersiz personel telefonu reddedilir', CASE WHEN ERROR_NUMBER() = 50400 THEN 1 ELSE 0 END, ERROR_MESSAGE()); END CATCH

-- Randevu
DECLARE @svcJson nvarchar(200) = N'["' + CONVERT(nvarchar(36), @svc1) + N'","' + CONVERT(nvarchar(36), @svc2) + N'"]';
INSERT #id EXEC api.Appointment_Book @cust, @shop, @staff, @svcJson, @tomorrowNoon, N'Kısa olsun';
SELECT @appt = Id FROM #id; DELETE #id;
REVERT;
INSERT #r VALUES (N'Randevu: onay bekliyor, 450 TL, 45 dk',
  CASE WHEN EXISTS (SELECT 1 FROM data.Appointments WHERE Id = @appt AND Status = 'pending' AND TotalPrice = 450 AND DATEDIFF(minute, StartsAt, EndsAt) = 45) THEN 1 ELSE 0 END, NULL);
INSERT #r VALUES (N'Randevu saati UTC saklanır (12:00 TR = 09:00 UTC)',
  CASE WHEN (SELECT DATEPART(hour, StartsAt) FROM data.Appointments WHERE Id = @appt) = 9 THEN 1 ELSE 0 END, NULL);
EXECUTE AS USER = 'test_app';

DECLARE @svcJson1 nvarchar(100) = N'["' + CONVERT(nvarchar(36), @svc1) + N'"]';
DECLARE @t2 datetime2(0) = DATEADD(minute, 15, @tomorrowNoon);
BEGIN TRY EXEC api.Appointment_Book @cust2, @shop, @staff, @svcJson1, @t2; INSERT #r VALUES (N'Çakışan saate randevu verilmez', 0, NULL); END TRY
BEGIN CATCH IF XACT_STATE() <> 0 ROLLBACK; INSERT #r VALUES (N'Çakışan saate randevu verilmez', CASE WHEN ERROR_MESSAGE() LIKE N'%dolu%' THEN 1 ELSE 0 END, ERROR_MESSAGE()); END CATCH
DECLARE @t3 datetime2(0) = DATEADD(minute, 45, @tomorrowNoon);
INSERT #id EXEC api.Appointment_Book @cust2, @shop, @staff, @svcJson1, @t3; DELETE #id;
INSERT #r VALUES (N'Bitişik saate randevu verilir (12:45)', 1, NULL);
DECLARE @past datetime2(0) = DATEADD(day, -2, @tomorrowNoon);
BEGIN TRY EXEC api.Appointment_Book @cust2, @shop, @staff, @svcJson1, @past; INSERT #r VALUES (N'Geçmişe randevu verilmez', 0, NULL); END TRY
BEGIN CATCH IF XACT_STATE() <> 0 ROLLBACK; INSERT #r VALUES (N'Geçmişe randevu verilmez', CASE WHEN ERROR_NUMBER() = 50400 THEN 1 ELSE 0 END, ERROR_MESSAGE()); END CATCH

-- Personele göre süre
BEGIN TRY EXEC api.Staff_SetServiceDuration @cust, @staff, @svc1, 5; INSERT #r VALUES (N'Müşteri personel süresini değiştiremez', 0, NULL); END TRY
BEGIN CATCH IF XACT_STATE() <> 0 ROLLBACK; INSERT #r VALUES (N'Müşteri personel süresini değiştiremez', CASE WHEN ERROR_NUMBER() = 50403 THEN 1 ELSE 0 END, ERROR_MESSAGE()); END CATCH
EXEC api.Staff_SetServiceDuration @worker, @staff, @svc1, 20;
DECLARE @dur TABLE (ShopServiceId uniqueidentifier, Name nvarchar(80), Price decimal(10, 2), ShopDurationMinutes smallint, StaffDurationMinutes smallint, DurationMinutes smallint);
INSERT @dur EXEC api.Staff_ServiceDurations @staff;
INSERT #r VALUES (N'Personel kendi süresini girdi: saç 30 → 20 dk, sakal 15 dk (dükkân süresi)',
  CASE WHEN (SELECT DurationMinutes FROM @dur WHERE ShopServiceId = @svc1) = 20 AND (SELECT DurationMinutes FROM @dur WHERE ShopServiceId = @svc2) = 15 THEN 1 ELSE 0 END, NULL);
DECLARE @slots TABLE (StartsAtLocal datetime2(0), EndsAtLocal datetime2(0), DurationMinutes int);
DECLARE @tomorrow date = CAST(@tomorrowNoon AS date);
INSERT @slots EXEC api.Appointment_AvailableSlots @staff, @tomorrow, @svcJson;
DECLARE @t5 datetime2(0) = (SELECT MIN(StartsAtLocal) FROM @slots WHERE StartsAtLocal >= DATEADD(hour, 5, @tomorrowNoon));
INSERT #r VALUES (N'Boş saat listesi personelin süresiyle (35 dk) hesaplanır',
  CASE WHEN (SELECT MAX(DurationMinutes) FROM @slots) = 35 AND @t5 IS NOT NULL THEN 1 ELSE 0 END, NULL);
INSERT #id EXEC api.Appointment_Book @cust2, @shop, @staff, @svcJson, @t5;
DECLARE @apptStaffDur uniqueidentifier = (SELECT Id FROM #id); DELETE #id;
EXEC api.Staff_SetServiceDuration @owner, @staff, @svc1, NULL;   -- sahip de değiştirebilir; NULL = dükkân süresine dön
DELETE @dur; INSERT @dur EXEC api.Staff_ServiceDurations @staff;
INSERT #r VALUES (N'Sahip personel süresini sıfırlayabilir (tekrar 30 dk)', CASE WHEN (SELECT DurationMinutes FROM @dur WHERE ShopServiceId = @svc1) = 30 THEN 1 ELSE 0 END, NULL);
EXEC api.Staff_SetQueueAvg @worker, @staff, 30;
BEGIN TRY EXEC api.Staff_SetQueueAvg @cust, @staff, 5; INSERT #r VALUES (N'Müşteri sıra süresini değiştiremez', 0, NULL); END TRY
BEGIN CATCH IF XACT_STATE() <> 0 ROLLBACK; INSERT #r VALUES (N'Müşteri sıra süresini değiştiremez', CASE WHEN ERROR_NUMBER() = 50403 THEN 1 ELSE 0 END, ERROR_MESSAGE()); END CATCH
REVERT;
INSERT #r VALUES (N'Randevu personelin süresiyle hesaplandı (20 + 15 = 35 dk)',
  CASE WHEN (SELECT DATEDIFF(minute, StartsAt, EndsAt) FROM data.Appointments WHERE Id = @apptStaffDur) = 35 THEN 1 ELSE 0 END,
  (SELECT CAST(DATEDIFF(minute, StartsAt, EndsAt) AS nvarchar) FROM data.Appointments WHERE Id = @apptStaffDur));
EXECUTE AS USER = 'test_app';

-- Boş saatler 40 dk adımlarla açılır, araya randevu girerse bitişinde yeni saat açılır
EXEC api.Staff_SetServiceDuration @worker, @staff, @svc1, 40;
DECLARE @day3 date = DATEADD(day, 2, CAST(@tomorrowNoon AS date));
DELETE @slots; INSERT @slots EXEC api.Appointment_AvailableSlots @staff, @day3, @svcJson1;
INSERT #r VALUES (N'40 dk süreyle boş saatler: 00:00, 00:40, 01:20 ...',
  CASE WHEN (SELECT COUNT(*) FROM @slots WHERE CAST(StartsAtLocal AS time(0)) IN ('00:00', '00:40', '01:20')) = 3
        AND NOT EXISTS (SELECT 1 FROM @slots WHERE CAST(StartsAtLocal AS time(0)) = '00:30') THEN 1 ELSE 0 END, NULL);
DECLARE @misaligned datetime2(0) = DATEADD(minute, 30, CAST(@day3 AS datetime2(0)));
BEGIN TRY EXEC api.Appointment_Book @cust2, @shop, @staff, @svcJson1, @misaligned; INSERT #r VALUES (N'Listede olmayan saate (00:30) randevu alınamaz', 0, NULL); END TRY
BEGIN CATCH IF XACT_STATE() <> 0 ROLLBACK; INSERT #r VALUES (N'Listede olmayan saate (00:30) randevu alınamaz', CASE WHEN ERROR_NUMBER() = 50409 THEN 1 ELSE 0 END, ERROR_MESSAGE()); END CATCH
-- Telefonla 01:00–01:30 arası randevu girilir (sahip istediği saate girebilir)
DECLARE @phoneT datetime2(0) = DATEADD(hour, 1, CAST(@day3 AS datetime2(0)));
EXEC api.Staff_SetServiceDuration @worker, @staff, @svc1, NULL;
INSERT #id EXEC api.Appointment_Book @owner, @shop, @staff, @svcJson1, @phoneT, NULL, N'Kemal', N'05320001122'; DELETE #id;
EXEC api.Staff_SetServiceDuration @worker, @staff, @svc1, 40;
DELETE @slots; INSERT @slots EXEC api.Appointment_AvailableSlots @staff, @day3, @svcJson1;
INSERT #r VALUES (N'Araya giren randevu (01:00–01:30) bitince sıradaki saat 01:30''da açılır',
  CASE WHEN EXISTS (SELECT 1 FROM @slots WHERE CAST(StartsAtLocal AS time(0)) = '01:30')
        AND NOT EXISTS (SELECT 1 FROM @slots WHERE CAST(StartsAtLocal AS time(0)) = '00:40') THEN 1 ELSE 0 END,
  (SELECT STRING_AGG(CONVERT(varchar(5), CAST(StartsAtLocal AS time(0))), ',') FROM (SELECT TOP 4 StartsAtLocal FROM @slots ORDER BY StartsAtLocal) x));
EXEC api.Staff_SetServiceDuration @worker, @staff, @svc1, NULL;

-- Telefonla randevu
DECLARE @t4 datetime2(0) = DATEADD(hour, 3, @tomorrowNoon);
BEGIN TRY EXEC api.Appointment_Book @owner, @shop, @staff, @svcJson1, @t4, NULL, N'Hasan'; INSERT #r VALUES (N'Telefon randevusu telefonsuz olmaz', 0, NULL); END TRY
BEGIN CATCH IF XACT_STATE() <> 0 ROLLBACK; INSERT #r VALUES (N'Telefon randevusu telefonsuz olmaz', CASE WHEN ERROR_NUMBER() = 50400 THEN 1 ELSE 0 END, ERROR_MESSAGE()); END CATCH
INSERT #id EXEC api.Appointment_Book @owner, @shop, @staff, @svcJson1, @t4, NULL, N'Hasan Demir', N'0532 000 11 22';
DECLARE @phoneAppt uniqueidentifier = (SELECT Id FROM #id); DELETE #id;
REVERT;
INSERT #r VALUES (N'Telefon randevusu direkt onaylı', CASE WHEN (SELECT Status + Source FROM data.Appointments WHERE Id = @phoneAppt) = 'acceptedphone' THEN 1 ELSE 0 END, NULL);
EXECUTE AS USER = 'test_app';

BEGIN TRY EXEC api.Appointment_SetStatus @cust, @appt, 'accepted'; INSERT #r VALUES (N'Müşteri kendi randevusunu onaylayamaz', 0, NULL); END TRY
BEGIN CATCH IF XACT_STATE() <> 0 ROLLBACK; INSERT #r VALUES (N'Müşteri kendi randevusunu onaylayamaz', CASE WHEN ERROR_NUMBER() = 50409 THEN 1 ELSE 0 END, ERROR_MESSAGE()); END CATCH
BEGIN TRY EXEC api.Appointment_SetStatus @cust2, @appt, 'cancelled'; INSERT #r VALUES (N'Başkasının randevusu iptal edilemez', 0, NULL); END TRY
BEGIN CATCH IF XACT_STATE() <> 0 ROLLBACK; INSERT #r VALUES (N'Başkasının randevusu iptal edilemez', CASE WHEN ERROR_NUMBER() = 50403 THEN 1 ELSE 0 END, ERROR_MESSAGE()); END CATCH

EXEC api.Appointment_SetStatus @worker, @appt, 'accepted';
DECLARE @custs TABLE (StaffId uniqueidentifier, StaffName nvarchar(60), CustomerId uniqueidentifier, CustomerName nvarchar(121),
  CustomerPhone varchar(16), VisitCount int, LastVisitLocal datetime2(0));
INSERT @custs EXEC api.Staff_Customers @worker, @shop;
INSERT #r VALUES (N'Personel kabul edince müşteri onun müşterisi olur', CASE WHEN EXISTS (SELECT 1 FROM @custs WHERE CustomerId = @cust AND StaffId = @staff) THEN 1 ELSE 0 END, NULL);

BEGIN TRY EXEC api.Review_Add @cust, @appt, 5, N'Erken'; INSERT #r VALUES (N'Tamamlanmamış randevuya yorum yazılamaz', 0, NULL); END TRY
BEGIN CATCH IF XACT_STATE() <> 0 ROLLBACK; INSERT #r VALUES (N'Tamamlanmamış randevuya yorum yazılamaz', CASE WHEN ERROR_NUMBER() = 50403 THEN 1 ELSE 0 END, ERROR_MESSAGE()); END CATCH
EXEC api.Appointment_SetStatus @worker, @appt, 'completed';

-- Yorumlar
BEGIN TRY EXEC api.Review_Add @cust2, @appt, 1, N'Kötü'; INSERT #r VALUES (N'Başkasının randevusuna yorum yazılamaz', 0, NULL); END TRY
BEGIN CATCH IF XACT_STATE() <> 0 ROLLBACK; INSERT #r VALUES (N'Başkasının randevusuna yorum yazılamaz', CASE WHEN ERROR_NUMBER() = 50403 THEN 1 ELSE 0 END, ERROR_MESSAGE()); END CATCH
INSERT #id EXEC api.Review_Add @cust, @appt, 5, N'Harika!'; DECLARE @review uniqueidentifier = (SELECT Id FROM #id); DELETE #id;
DECLARE @rev TABLE (Id uniqueidentifier, Rating tinyint, Comment nvarchar(1000), CreatedAt datetime2(0), CustomerName nvarchar(70), StaffName nvarchar(60));
INSERT @rev EXEC api.Review_List @shop;
INSERT #r VALUES (N'Yorum görünür, isim "Ayşe Y." şeklinde', CASE WHEN (SELECT CustomerName FROM @rev) = N'Ayşe Y.' THEN 1 ELSE 0 END, (SELECT CustomerName FROM @rev));
EXEC api.Admin_Review_SetHidden @admin, @review, 1; DELETE @rev;
INSERT @rev EXEC api.Review_List @shop;
INSERT #r VALUES (N'Admin gizleyince yorum görünmez', CASE WHEN NOT EXISTS (SELECT 1 FROM @rev) THEN 1 ELSE 0 END, NULL);
EXEC api.Admin_Review_SetHidden @admin, @review, 0;
EXEC api.Admin_Settings_Update @admin, @ReviewsEnabled = 0; DELETE @rev;
INSERT @rev EXEC api.Review_List @shop;
INSERT #r VALUES (N'Admin yorumları kapatınca hepsi gizlenir', CASE WHEN NOT EXISTS (SELECT 1 FROM @rev) THEN 1 ELSE 0 END, NULL);
EXEC api.Admin_Settings_Update @admin, @ReviewsEnabled = 1;

-- Canlı sıra
INSERT #q EXEC api.Queue_Join @cust2, @shop;
SELECT @entry = Id, @n = TicketNo FROM #q; DELETE #q;
INSERT #r VALUES (N'Sıraya girildi, numara 1', CASE WHEN @n = 1 THEN 1 ELSE 0 END, NULL);
BEGIN TRY EXEC api.Queue_Join @cust2, @shop; INSERT #r VALUES (N'Aynı anda iki sıraya girilemez', 0, NULL); END TRY
BEGIN CATCH IF XACT_STATE() <> 0 ROLLBACK; INSERT #r VALUES (N'Aynı anda iki sıraya girilemez', CASE WHEN ERROR_NUMBER() = 50409 THEN 1 ELSE 0 END, ERROR_MESSAGE()); END CATCH
INSERT #q EXEC api.Queue_Join @cust, @shop; DELETE #q;
INSERT #q EXEC api.Queue_Join @owner, @shop, NULL, N'Kapıdan gelen Hasan'; DELETE #q;
DECLARE @state TABLE (CurrentTicket int, WaitingCount int, Version int, QueueAvgMinutes smallint);
INSERT @state EXEC api.Queue_State @shop;
INSERT #r VALUES (N'Sıra özeti: 3 bekleyen', CASE WHEN (SELECT WaitingCount FROM @state) = 3 THEN 1 ELSE 0 END, NULL);
DECLARE @pos TABLE (Id uniqueidentifier, ShopId uniqueidentifier, ShopName nvarchar(100), TicketNo int, Status varchar(10),
  StaffId uniqueidentifier, StaffName nvarchar(60), PeopleAhead int, EstimatedMinutes int);
INSERT @pos EXEC api.Queue_MyPosition @cust;
INSERT #r VALUES (N'Önümde 1 kişi, tahmini 20 dk', CASE WHEN (SELECT PeopleAhead FROM @pos) = 1 AND (SELECT EstimatedMinutes FROM @pos) = 20 THEN 1 ELSE 0 END, NULL);
BEGIN TRY EXEC api.Queue_CallNext @cust, @shop; INSERT #r VALUES (N'Müşteri sırayı ilerletemez', 0, NULL); END TRY
BEGIN CATCH IF XACT_STATE() <> 0 ROLLBACK; INSERT #r VALUES (N'Müşteri sırayı ilerletemez', CASE WHEN ERROR_NUMBER() = 50403 THEN 1 ELSE 0 END, ERROR_MESSAGE()); END CATCH
DECLARE @called TABLE (Id uniqueidentifier, TicketNo int, CustomerName nvarchar(121));
INSERT @called EXEC api.Queue_CallNext @worker, @shop, @staff;
DELETE @state; INSERT @state EXEC api.Queue_State @shop;
INSERT #r VALUES (N'Sıradaki çağrıldı: Ali Veli (1), 2 bekleyen, sürüm arttı',
  CASE WHEN (SELECT CustomerName FROM @called) = N'Ali Veli' AND (SELECT CurrentTicket FROM @state) = 1 AND (SELECT WaitingCount FROM @state) = 2 THEN 1 ELSE 0 END, NULL);
SET @entry = (SELECT Id FROM @pos);
EXEC api.Queue_SetStatus @cust, @entry, 'cancelled';
INSERT #q EXEC api.Queue_Join @cust, @shop, @staff; DELETE #q;
DELETE @pos; INSERT @pos EXEC api.Queue_MyPosition @cust;
INSERT #r VALUES (N'Personeli bekleyen müşterinin tahmini süresi personelin ortalamasıyla (1 kişi x 30 dk)',
  CASE WHEN (SELECT PeopleAhead FROM @pos) = 1 AND (SELECT EstimatedMinutes FROM @pos) = 30 THEN 1 ELSE 0 END,
  (SELECT CONCAT(PeopleAhead, ' kişi, ', EstimatedMinutes, ' dk') FROM @pos));
SET @entry = (SELECT Id FROM @pos);
EXEC api.Queue_SetStatus @cust, @entry, 'cancelled';
DELETE @state; INSERT @state EXEC api.Queue_State @shop;
INSERT #r VALUES (N'Müşteri sıradan çıkabilir', CASE WHEN (SELECT WaitingCount FROM @state) = 1 THEN 1 ELSE 0 END, NULL);

-- Ürün satışı
INSERT #id EXEC api.Product_Save @owner, @shop, NULL, N'Sakal Yağı', NULL, 200, 2; SELECT @prod = Id FROM #id; DELETE #id;
-- Ürün fotoğrafları: sahip, personel ve admin yönetir
INSERT #id EXEC api.Product_AddImage @worker, @prod, N'products/1.jpg'; DECLARE @img1 uniqueidentifier = (SELECT Id FROM #id); DELETE #id;
INSERT #id EXEC api.Product_AddImage @owner, @prod, N'products/2.jpg'; DECLARE @img2 uniqueidentifier = (SELECT Id FROM #id); DELETE #id;
DECLARE @imgs TABLE (Id uniqueidentifier, Path nvarchar(300), IsCover bit, SortOrder int);
INSERT @imgs EXEC api.Product_Images @prod, @owner;
INSERT #r VALUES (N'Personel ve sahip fotoğraf ekledi, ilki vitrin oldu',
  CASE WHEN (SELECT COUNT(*) FROM @imgs) = 2 AND (SELECT IsCover FROM @imgs WHERE Id = @img1) = 1 THEN 1 ELSE 0 END, NULL);
EXEC api.Product_SetCoverImage @worker, @img2;
DELETE @imgs; INSERT @imgs EXEC api.Product_Images @prod, @owner;
INSERT #r VALUES (N'Vitrin fotoğrafı değiştirildi (tek vitrin)',
  CASE WHEN (SELECT IsCover FROM @imgs WHERE Id = @img2) = 1 AND (SELECT SUM(CAST(IsCover AS int)) FROM @imgs) = 1 THEN 1 ELSE 0 END, NULL);
BEGIN TRY EXEC api.Product_AddImage @cust, @prod, N'x.jpg'; INSERT #r VALUES (N'Müşteri ürüne fotoğraf ekleyemez', 0, NULL); END TRY
BEGIN CATCH IF XACT_STATE() <> 0 ROLLBACK; INSERT #r VALUES (N'Müşteri ürüne fotoğraf ekleyemez', CASE WHEN ERROR_NUMBER() = 50403 THEN 1 ELSE 0 END, ERROR_MESSAGE()); END CATCH
DECLARE @removed TABLE (Path nvarchar(300)); INSERT @removed EXEC api.Product_RemoveImage @admin, @img2;
DELETE @imgs; INSERT @imgs EXEC api.Product_Images @prod, @owner;
INSERT #r VALUES (N'Admin fotoğraf sildi, kalan fotoğraf vitrin oldu',
  CASE WHEN (SELECT COUNT(*) FROM @imgs) = 1 AND (SELECT IsCover FROM @imgs) = 1 THEN 1 ELSE 0 END, NULL);
INSERT #id EXEC api.Product_Save @worker, @shop, NULL, N'Wax', NULL, 150, 5; DELETE #id;
INSERT #id EXEC api.Product_Save @admin, @shop, @prod, N'Sakal Yağı 50 ml', NULL, 200, 2; DELETE #id;
REVERT;
INSERT #r VALUES (N'Personel ürün ekledi, admin ürün düzenledi (kayda geçti)',
  CASE WHEN EXISTS (SELECT 1 FROM data.Products WHERE Name = N'Wax' AND ShopId = @shop)
        AND (SELECT Name FROM data.Products WHERE Id = @prod) = N'Sakal Yağı 50 ml'
        AND EXISTS (SELECT 1 FROM data.AuditLog WHERE Action = 'product_save' AND ActorId = @admin)
        AND NOT EXISTS (SELECT 1 FROM data.AuditLog WHERE Action = 'product_save' AND ActorId = @worker) THEN 1 ELSE 0 END, NULL);
EXECUTE AS USER = 'test_app';
DECLARE @items nvarchar(200) = N'[{"productId":"' + CONVERT(nvarchar(36), @prod) + N'","quantity":2}]';
BEGIN TRY EXEC api.Order_Place @cust, @shop, @items; INSERT #r VALUES (N'Satış kapalıyken sipariş verilemez', 0, NULL); END TRY
BEGIN CATCH IF XACT_STATE() <> 0 ROLLBACK; INSERT #r VALUES (N'Satış kapalıyken sipariş verilemez', CASE WHEN ERROR_MESSAGE() LIKE N'%kapalı%' THEN 1 ELSE 0 END, ERROR_MESSAGE()); END CATCH
EXEC api.Admin_Settings_Update @admin, @StoreEnabled = 1;
EXEC api.Shop_Update @owner, @shop, N'Ahmet Usta Berber', NULL, N'02161112233', 34, @kadikoy, @caferaga, N'Moda Caddesi', N'12', NULL, 40.987, 29.026, 0, 1, 1, 20;
DECLARE @items3 nvarchar(200) = N'[{"productId":"' + CONVERT(nvarchar(36), @prod) + N'","quantity":3}]';
BEGIN TRY EXEC api.Order_Place @cust, @shop, @items3; INSERT #r VALUES (N'Stok yetersizse sipariş verilmez', 0, NULL); END TRY
BEGIN CATCH IF XACT_STATE() <> 0 ROLLBACK; INSERT #r VALUES (N'Stok yetersizse sipariş verilmez', CASE WHEN ERROR_MESSAGE() LIKE N'%stok%' THEN 1 ELSE 0 END, ERROR_MESSAGE()); END CATCH
INSERT #id EXEC api.Order_Place @cust, @shop, @items; SELECT @order = Id FROM #id; DELETE #id;
REVERT;
INSERT #r VALUES (N'Sipariş 400 TL, stok 0', CASE WHEN (SELECT Total FROM data.Orders WHERE Id = @order) = 400 AND (SELECT Stock FROM data.Products WHERE Id = @prod) = 0 THEN 1 ELSE 0 END, NULL);
EXECUTE AS USER = 'test_app';
EXEC api.Order_SetStatus @cust, @order, 'cancelled';
REVERT;
INSERT #r VALUES (N'İptal edilince stok geri döner', CASE WHEN (SELECT Stock FROM data.Products WHERE Id = @prod) = 2 THEN 1 ELSE 0 END, NULL);
INSERT #r VALUES (N'Yeni sipariş ve müşteri iptali dükkân sahibine bildirildi',
  CASE WHEN (SELECT COUNT(*) FROM data.Notifications WHERE UserId = @owner AND Kind = 'order_new') = 2 THEN 1 ELSE 0 END, NULL);
EXECUTE AS USER = 'test_app';
DECLARE @order2 uniqueidentifier;
INSERT #id EXEC api.Order_Place @cust, @shop, @items; SELECT @order2 = Id FROM #id; DELETE #id;
EXEC api.Order_SetStatus @worker, @order2, 'ready';
REVERT;
INSERT #r VALUES (N'Sipariş hazır olunca müşteriye bildirim gider',
  CASE WHEN EXISTS (SELECT 1 FROM data.Notifications WHERE UserId = @cust AND Kind = 'order_ready' AND Url = N'/siparislerim') THEN 1 ELSE 0 END, NULL);
EXECUTE AS USER = 'test_app';
EXEC api.Order_SetStatus @admin, @order2, 'cancelled';
REVERT;
INSERT #r VALUES (N'Admin dükkân adına siparişi iptal edebilir, müşteriye haber gider',
  CASE WHEN (SELECT Status FROM data.Orders WHERE Id = @order2) = 'cancelled'
        AND EXISTS (SELECT 1 FROM data.Notifications WHERE UserId = @cust AND Kind = 'order_cancelled') THEN 1 ELSE 0 END, NULL);
EXECUTE AS USER = 'test_app';

-- =====================================================================
-- Bildirimler ve saç uzama zamanlayıcısı
-- =====================================================================
DECLARE @cust3 uniqueidentifier, @cust4 uniqueidentifier;
INSERT #id EXEC api.Auth_Register N'cust3@test.com', N'hash', N'Can', N'Kara', 1990, N'05330000003', @KvkkAccepted = 1; SELECT @cust3 = Id FROM #id; DELETE #id;
INSERT #id EXEC api.Auth_Register N'cust4@test.com', N'hash', N'Efe', N'Ak', 1991, N'05330000004', @KvkkAccepted = 1; SELECT @cust4 = Id FROM #id; DELETE #id;
REVERT;
-- Geçmiş ziyaretler: Can 30 gün önce, Efe 3 gün önce saç kestirdi (doğrudan veritabanına)
DECLARE @past30 datetime2(0) = DATEADD(day, -30, SYSUTCDATETIME()), @past3 datetime2(0) = DATEADD(day, -3, SYSUTCDATETIME());
INSERT INTO data.Appointments (Id, ShopId, StaffId, CustomerId, CustomerName, StartsAt, EndsAt, Status, TotalPrice)
VALUES ('11111111-0000-0000-0000-000000000003', @shop, @staff, @cust3, N'Can Kara', @past30, DATEADD(minute, 30, @past30), 'completed', 300),
       ('11111111-0000-0000-0000-000000000004', @shop, @staff, @cust4, N'Efe Ak', @past3, DATEADD(minute, 30, @past3), 'completed', 300);
INSERT INTO data.AppointmentServices (AppointmentId, ShopServiceId, Name, Price, DurationMinutes)
VALUES ('11111111-0000-0000-0000-000000000003', @svc1, N'Saç Kesimi', 300, 30),
       ('11111111-0000-0000-0000-000000000004', @svc1, N'Saç Kesimi', 300, 30);
INSERT #r VALUES (N'Zamanlayıcı: 30 gün önce gelen "zamanı geldi", 3 gün önce gelen değil',
  CASE WHEN (SELECT DueAt FROM data.tvf_CustomerDue(@shop) WHERE CustomerId = @cust3) <= SYSUTCDATETIME()
        AND (SELECT DueAt FROM data.tvf_CustomerDue(@shop) WHERE CustomerId = @cust4) > DATEADD(day, 20, SYSUTCDATETIME()) THEN 1 ELSE 0 END, NULL);
EXECUTE AS USER = 'test_app';

-- Bildirim izinleri (varsayılan kapalı)
DECLARE @prefs TABLE (PushOptIn bit, SlotAlertsOptIn bit, HasDevice bit);
INSERT @prefs EXEC api.Notify_GetPreferences @cust3;
INSERT #r VALUES (N'Bildirim izinleri varsayılan olarak kapalı',
  CASE WHEN (SELECT CAST(PushOptIn AS int) + CAST(SlotAlertsOptIn AS int) FROM @prefs) = 0 THEN 1 ELSE 0 END, NULL);
EXEC api.Notify_SetPreferences @cust3, 1, 1;
EXEC api.Notify_SetPreferences @cust4, 1, 1;
EXEC api.Notify_SetPreferences @cust, 1, 1;
EXEC api.Push_Subscribe @cust3, 'web', N'https://push.example/cust3', N'key', N'auth';
EXEC api.Push_Subscribe @cust4, 'web', N'https://push.example/cust4', N'key', N'auth';
EXEC api.Push_Subscribe @cust, 'web', N'https://push.example/cust', N'key', N'auth';
DELETE @prefs; INSERT @prefs EXEC api.Notify_GetPreferences @cust3;
INSERT #r VALUES (N'Cihaz kaydı ve bildirim izni', CASE WHEN (SELECT CAST(HasDevice AS int) + CAST(PushOptIn AS int) FROM @prefs) = 2 THEN 1 ELSE 0 END, NULL);

-- Anlık bildirimler
DECLARE @notes TABLE (Id bigint, Kind varchar(24), Title nvarchar(80), Body nvarchar(300), Url nvarchar(300), CreatedAtLocal datetime2(0), IsRead bit);
INSERT @notes EXEC api.Notification_ListMine @worker;
INSERT #r VALUES (N'Yeni randevu talebinde personele bildirim gitti', CASE WHEN EXISTS (SELECT 1 FROM @notes WHERE Kind = 'appointment_new') THEN 1 ELSE 0 END, NULL);
DELETE @notes; INSERT @notes EXEC api.Notification_ListMine @cust;
INSERT #r VALUES (N'Randevu onaylanınca müşteriye bildirim gitti', CASE WHEN EXISTS (SELECT 1 FROM @notes WHERE Kind = 'appointment_accepted') THEN 1 ELSE 0 END, NULL);

-- Randevu iptal → yalnızca zamanı gelen müşteriye "boş randevu" haberi
EXEC api.Appointment_SetStatus @owner, @phoneAppt, 'cancelled';
REVERT;
INSERT #r VALUES (N'İptalde haber yalnızca zamanı gelen müşteriye (Can) gitti; yeni traş olana (Efe) ve randevusu olana gitmedi',
  CASE WHEN EXISTS (SELECT 1 FROM data.Notifications WHERE UserId = @cust3 AND Kind = 'slot_opened' AND PushStatus = 'queued')
        AND NOT EXISTS (SELECT 1 FROM data.Notifications WHERE UserId = @cust4 AND Kind = 'slot_opened')
        AND NOT EXISTS (SELECT 1 FROM data.Notifications WHERE UserId = @cust AND Kind = 'slot_opened') THEN 1 ELSE 0 END, NULL);
EXECUTE AS USER = 'test_app';

-- Kampanyalar
DECLARE @tpl int = 1;   -- 'Şampuanda %50 indirim'
BEGIN TRY EXEC api.Campaign_Send @owner, @shop, NULL, N'Kendi mesajım', N'Herkese bedava!'; INSERT #r VALUES (N'Dükkân kendi metnini yazamaz, yalnızca hazır mesaj', 0, NULL); END TRY
BEGIN CATCH IF XACT_STATE() <> 0 ROLLBACK; INSERT #r VALUES (N'Dükkân kendi metnini yazamaz, yalnızca hazır mesaj', CASE WHEN ERROR_NUMBER() IN (50400, 50403) THEN 1 ELSE 0 END, ERROR_MESSAGE()); END CATCH
DECLARE @prev TABLE (RecipientCount int);
INSERT @prev EXEC api.Campaign_PreviewCount @owner, @shop, 1;
DECLARE @camp TABLE (Id uniqueidentifier, RecipientCount int);
INSERT @camp EXEC api.Campaign_Send @owner, @shop, @tpl, NULL, NULL, 1;
REVERT;
INSERT #r VALUES (N'Dükkân kampanyası yalnızca zamanı gelen müşteriye (1 kişi), önizleme ile aynı',
  CASE WHEN (SELECT RecipientCount FROM @camp) = 1 AND (SELECT RecipientCount FROM @prev) = 1
        AND EXISTS (SELECT 1 FROM data.Notifications WHERE UserId = @cust3 AND Kind = 'campaign') THEN 1 ELSE 0 END,
  (SELECT CONCAT(RecipientCount, ' kişi') FROM @camp));
INSERT #r VALUES (N'Kampanya metninde {ad} ve {dukkan} dolduruldu',
  CASE WHEN EXISTS (SELECT 1 FROM data.Notifications WHERE UserId = @cust3 AND Kind = 'campaign'
                    AND Body LIKE N'Merhaba Can, Ahmet Usta Berber%') THEN 1 ELSE 0 END,
  (SELECT TOP 1 Body FROM data.Notifications WHERE UserId = @cust3 AND Kind = 'campaign'));
EXECUTE AS USER = 'test_app';
BEGIN TRY EXEC api.Campaign_Send @owner, @shop, @tpl; INSERT #r VALUES (N'Dükkân saatte en fazla 1 kampanya gönderebilir', 0, NULL); END TRY
BEGIN CATCH IF XACT_STATE() <> 0 ROLLBACK; INSERT #r VALUES (N'Dükkân saatte en fazla 1 kampanya gönderebilir', CASE WHEN ERROR_NUMBER() = 50409 THEN 1 ELSE 0 END, ERROR_MESSAGE()); END CATCH
BEGIN TRY EXEC api.Campaign_Send @cust, @shop, @tpl; INSERT #r VALUES (N'Müşteri kampanya gönderemez', 0, NULL); END TRY
BEGIN CATCH IF XACT_STATE() <> 0 ROLLBACK; INSERT #r VALUES (N'Müşteri kampanya gönderemez', CASE WHEN ERROR_NUMBER() = 50403 THEN 1 ELSE 0 END, ERROR_MESSAGE()); END CATCH
REVERT;
DECLARE @tplKadin int = (SELECT Id FROM data.MessageTemplates WHERE Title = N'Gelin başı sezonu');
EXECUTE AS USER = 'test_app';
DECLARE @tplList TABLE (Id int, Title nvarchar(80), Body nvarchar(300), IsActive bit, Segment varchar(5));
INSERT @tplList EXEC api.Template_List @owner, @shop;
INSERT #r VALUES (N'Erkek dükkânı kadın bölümünün hazır mesajını görmez', CASE WHEN @tplKadin IS NOT NULL AND NOT EXISTS (SELECT 1 FROM @tplList WHERE Segment = 'kadin') AND EXISTS (SELECT 1 FROM @tplList WHERE Segment = 'erkek') THEN 1 ELSE 0 END, NULL);
BEGIN TRY EXEC api.Campaign_Send @owner, @shop, @tplKadin; INSERT #r VALUES (N'Erkek dükkânı kadın mesajını gönderemez', 0, NULL); END TRY
BEGIN CATCH IF XACT_STATE() <> 0 ROLLBACK; INSERT #r VALUES (N'Erkek dükkânı kadın mesajını gönderemez', CASE WHEN ERROR_NUMBER() = 50400 THEN 1 ELSE 0 END, ERROR_MESSAGE()); END CATCH
DELETE @camp;
INSERT @camp EXEC api.Campaign_Send @admin, NULL, NULL, N'Bermatik''e hoş geldin', N'Merhaba {ad}, ilk randevuna özel sürprizler seni bekliyor!', 0;
DELETE @camp;
INSERT @camp EXEC api.Campaign_Send @admin, NULL, NULL, N'Üçüncü mesaj', N'Bu mesaj Can''a gitmemeli (7 günde en fazla 2).', 0;
REVERT;
INSERT #r VALUES (N'Admin kendi metniyle herkese gönderebilir; bir müşteri 7 günde en fazla 2 kampanya alır',
  CASE WHEN (SELECT COUNT(*) FROM data.Notifications WHERE UserId = @cust3 AND Kind = 'campaign') = 2
        AND EXISTS (SELECT 1 FROM data.Notifications WHERE UserId = @cust4 AND Kind = 'campaign' AND Title = N'Üçüncü mesaj') THEN 1 ELSE 0 END, NULL);
EXECUTE AS USER = 'test_app';

-- Gönderim görevi
DECLARE @push TABLE (NotificationId bigint, Title nvarchar(80), Body nvarchar(300), Url nvarchar(300), Endpoint nvarchar(1000), P256dh nvarchar(200), AuthKey nvarchar(100), Platform varchar(10));
INSERT @push EXEC api.Worker_NextPush 500;
DECLARE @nid bigint = (SELECT MIN(NotificationId) FROM @push);
EXEC api.Worker_PushResult @nid, 1;
DECLARE @nid2 bigint = (SELECT MAX(NotificationId) FROM @push);
DECLARE @gone nvarchar(1000) = (SELECT TOP 1 Endpoint FROM @push WHERE NotificationId = @nid2);
EXEC api.Worker_PushResult @nid2, 0, N'410 Gone', @gone;
REVERT;
INSERT #r VALUES (N'Gönderim görevi: gönderilen "sent" olur, geçersiz cihaz silinir',
  CASE WHEN (SELECT PushStatus FROM data.Notifications WHERE Id = @nid) = 'sent'
        AND NOT EXISTS (SELECT 1 FROM data.PushSubscriptions WHERE Endpoint = @gone) AND (SELECT COUNT(*) FROM @push) > 0 THEN 1 ELSE 0 END, NULL);
EXECUTE AS USER = 'test_app';
EXEC api.Notification_MarkRead @cust3;
DELETE @notes; INSERT @notes EXEC api.Notification_ListMine @cust3;
INSERT #r VALUES (N'Zil listesi: bildirimler okundu yapılabilir', CASE WHEN NOT EXISTS (SELECT 1 FROM @notes WHERE IsRead = 0) AND EXISTS (SELECT 1 FROM @notes) THEN 1 ELSE 0 END, NULL);

-- Arama ve harita
DECLARE @search TABLE (Id uniqueidentifier, Code varchar(12), Segment varchar(5), Name nvarchar(100), Slug varchar(120), ProvinceSlug varchar(40),
  DistrictSlug varchar(60), Phone varchar(16), Street nvarchar(120), BuildingNo nvarchar(20), Neighborhood nvarchar(200), District nvarchar(60),
  Province nvarchar(40), Latitude decimal(9, 6), Longitude decimal(9, 6), CoverImagePath nvarchar(300), DistanceKm float, IsOpen bit,
  OpensAt time(0), ClosesAt time(0), IsCertified bit, AvgRating decimal(2, 1), ReviewCount int, TodayAppointments int, IsClaimed bit);
INSERT @search EXEC api.Shop_Search 'erkek', 40.99, 29.03, 5;
INSERT #r VALUES (N'Yakındaki dükkân bulundu (konumla), açık, puan 5.0',
  CASE WHEN (SELECT COUNT(*) FROM @search) = 1 AND (SELECT IsOpen FROM @search) = 1 AND (SELECT AvgRating FROM @search) = 5.0 THEN 1 ELSE 0 END,
  (SELECT CONCAT(COUNT(*), '|', MAX(CAST(IsOpen AS int)), '|', MAX(AvgRating)) FROM @search));
DELETE @search; INSERT @search EXEC api.Shop_Search 'kadin', 40.99, 29.03, 5;
INSERT #r VALUES (N'Kadın tarafında erkek dükkânı çıkmaz', CASE WHEN NOT EXISTS (SELECT 1 FROM @search) THEN 1 ELSE 0 END, NULL);
DELETE @search; INSERT @search EXEC api.Shop_Search 'erkek', NULL, NULL, 10, 34, @kadikoy;
INSERT #r VALUES (N'İl/ilçe ile arama (konumsuz)', CASE WHEN (SELECT COUNT(*) FROM @search) = 1 THEN 1 ELSE 0 END, NULL);
DELETE @search; INSERT @search EXEC api.Shop_Search @Segment = 'erkek', @Query = N'Kadık';
INSERT #r VALUES (N'Aramada ilçe adı da eşleşir (Kadık → Kadıköy dükkânı)', CASE WHEN EXISTS (SELECT 1 FROM @search WHERE Id = @shop) THEN 1 ELSE 0 END, NULL);
-- Sırayı gör: bugünkü randevular (isimsiz) ve kartlardaki bugünkü randevu sayısı
REVERT;
DECLARE @nowUtc datetime2(0) = SYSUTCDATETIME();
DECLARE @dayStartUtc datetime2(0) = data.fn_ToUtc(CAST(CAST(data.fn_IstanbulNow() AS date) AS datetime2(0)));
DECLARE @sTodayA datetime2(0) = CASE WHEN DATEADD(minute, -90, @nowUtc) >= @dayStartUtc THEN DATEADD(minute, -90, @nowUtc) ELSE @dayStartUtc END;
DECLARE @sTodayB datetime2(0) = CASE WHEN DATEADD(minute, 30, @nowUtc) < DATEADD(day, 1, @dayStartUtc) THEN DATEADD(minute, 30, @nowUtc) ELSE DATEADD(minute, -60, DATEADD(day, 1, @dayStartUtc)) END;
INSERT INTO data.Appointments (ShopId, StaffId, CustomerName, Source, StartsAt, EndsAt, Status) VALUES
  (@shop, @staff, N'Gizli Müşteri', 'phone', @sTodayA, DATEADD(minute, 30, @sTodayA), 'completed'),
  (@shop, @staff, N'Gizli Müşteri', 'phone', @sTodayB, DATEADD(minute, 30, @sTodayB), 'accepted'),
  (@shop, @staff, N'Gizli Müşteri', 'phone', DATEADD(minute, 10, @sTodayA), DATEADD(minute, 20, @sTodayA), 'cancelled');
EXECUTE AS USER = 'test_app';
DECLARE @day TABLE (StartsAtLocal datetime2(0), EndsAtLocal datetime2(0), StaffName nvarchar(60), IsPast bit);
INSERT @day EXEC api.Shop_DaySchedule @shop;
INSERT #r VALUES (N'Sırayı gör: bugünkü 2 randevu (iptal sayılmaz), ilki geçti, isim yok',
  CASE WHEN (SELECT COUNT(*) FROM @day) = 2 AND (SELECT TOP 1 IsPast FROM @day ORDER BY StartsAtLocal) = 1 THEN 1 ELSE 0 END,
  (SELECT CONCAT(COUNT(*), '|', SUM(CAST(IsPast AS int))) FROM @day));
DELETE @search; INSERT @search EXEC api.Shop_Search 'erkek', 40.99, 29.03, 5;
INSERT #r VALUES (N'Kartta bugünkü randevu sayısı 2', CASE WHEN (SELECT TodayAppointments FROM @search) = 2 THEN 1 ELSE 0 END, (SELECT MAX(TodayAppointments) FROM @search));
REVERT;
DELETE FROM data.Appointments WHERE ShopId = @shop AND CustomerName = N'Gizli Müşteri' AND Source = 'phone';
EXECUTE AS USER = 'test_app';
-- Mahalle filtresi, "yakın çevre" (ilçe hariç) ve bölge merkezleri
DELETE @search; INSERT @search EXEC api.Shop_Search @Segment = 'erkek', @ProvinceId = 34, @DistrictId = @kadikoy, @NeighborhoodId = @caferaga;
INSERT #r VALUES (N'Mahalle filtresi o mahalledeki dükkânı bulur', CASE WHEN EXISTS (SELECT 1 FROM @search WHERE Id = @shop) THEN 1 ELSE 0 END, NULL);
DELETE @search; INSERT @search EXEC api.Shop_Search @Segment = 'erkek', @Latitude = 40.99, @Longitude = 29.03, @RadiusKm = 5, @ExcludeDistrictId = @kadikoy;
INSERT #r VALUES (N'Yakın çevre listesi ilçenin kendi dükkânlarını tekrar göstermez', CASE WHEN NOT EXISTS (SELECT 1 FROM @search WHERE Id = @shop) THEN 1 ELSE 0 END, NULL);
EXEC api.Area_SetCenter @kadikoy, NULL, 40.990000, 29.030000;
EXEC api.Area_SetCenter @kadikoy, NULL, 41.500000, 29.500000;  -- dolu merkez değişmez
EXEC api.Area_SetCenter @kadikoy, @caferaga, 40.987000, 29.026000;
DECLARE @center TABLE (Province nvarchar(40), District nvarchar(60), Neighborhood nvarchar(200), NeighborhoodId int,
  DistrictLat decimal(9, 6), DistrictLng decimal(9, 6), NeighborhoodLat decimal(9, 6), NeighborhoodLng decimal(9, 6));
INSERT @center EXEC api.Area_GetCenter @kadikoy, @caferaga;
INSERT #r VALUES (N'İlçe ve mahalle merkezi bir kez kaydedilir, sonra değişmez',
  CASE WHEN EXISTS (SELECT 1 FROM @center WHERE DistrictLat = 40.99 AND NeighborhoodLat = 40.987) THEN 1 ELSE 0 END, NULL);
DECLARE @nearest TABLE (Id int, Name nvarchar(200));
INSERT @nearest EXEC api.Area_NearestNeighborhood @kadikoy, 40.9871, 29.0262;
INSERT #r VALUES (N'En yakın mahalle konumdan bulunur', CASE WHEN (SELECT Id FROM @nearest) = @caferaga THEN 1 ELSE 0 END, NULL);
BEGIN TRY EXEC api.Area_SetCenter @kadikoy, @caferaga, 51.5, -0.12; INSERT #r VALUES (N'Türkiye dışı konum reddedilir', 0, NULL); END TRY
BEGIN CATCH INSERT #r VALUES (N'Türkiye dışı konum reddedilir', CASE WHEN ERROR_NUMBER() = 50400 THEN 1 ELSE 0 END, ERROR_MESSAGE()); END CATCH

-- Belgeler ve admin
INSERT #id EXEC api.Certificate_Add @owner, 'ustalik', N'ab-12345', N'İstanbul Esnaf Odası', N'certificates/owner/belge.jpg';
DECLARE @cert uniqueidentifier = (SELECT Id FROM #id); DELETE #id;
BEGIN TRY EXEC api.Certificate_Add @cust, 'ustalik', N'AB-12345', NULL, N'x.jpg'; INSERT #r VALUES (N'Aynı seri numarası ikinci kez kullanılamaz', 0, NULL); END TRY
BEGIN CATCH IF XACT_STATE() <> 0 ROLLBACK; INSERT #r VALUES (N'Aynı seri numarası ikinci kez kullanılamaz', CASE WHEN ERROR_NUMBER() = 50409 THEN 1 ELSE 0 END, ERROR_MESSAGE()); END CATCH
DECLARE @file TABLE (FilePath nvarchar(300));
INSERT @file EXEC api.Certificate_GetFile @cust, @cert;
INSERT #r VALUES (N'Başkasının belge dosyası görünmez', CASE WHEN NOT EXISTS (SELECT 1 FROM @file) THEN 1 ELSE 0 END, NULL);
EXEC api.Admin_Certificate_Review @admin, @cert, 'verified';
DELETE @search; INSERT @search EXEC api.Shop_Search 'erkek', 40.99, 29.03, 5;
INSERT #r VALUES (N'Belge onaylanınca dükkân "belgeli" görünür', CASE WHEN (SELECT IsCertified FROM @search) = 1 THEN 1 ELSE 0 END, NULL);

BEGIN TRY EXEC api.Admin_User_SetRole @cust, @cust, 'admin'; INSERT #r VALUES (N'Müşteri kendini admin yapamaz', 0, NULL); END TRY
BEGIN CATCH IF XACT_STATE() <> 0 ROLLBACK; INSERT #r VALUES (N'Müşteri kendini admin yapamaz', CASE WHEN ERROR_NUMBER() = 50403 THEN 1 ELSE 0 END, ERROR_MESSAGE()); END CATCH
BEGIN TRY EXEC api.Admin_Dashboard @owner; INSERT #r VALUES (N'Admin paneli yalnızca admin''e açık', 0, NULL); END TRY
BEGIN CATCH IF XACT_STATE() <> 0 ROLLBACK; INSERT #r VALUES (N'Admin paneli yalnızca admin''e açık', CASE WHEN ERROR_NUMBER() = 50403 THEN 1 ELSE 0 END, ERROR_MESSAGE()); END CATCH

EXEC api.Admin_User_SetActive @admin, @cust2, 0;
BEGIN TRY EXEC api.Queue_Join @cust2, @shop; INSERT #r VALUES (N'Engellenen kullanıcı işlem yapamaz', 0, NULL); END TRY
BEGIN CATCH IF XACT_STATE() <> 0 ROLLBACK; INSERT #r VALUES (N'Engellenen kullanıcı işlem yapamaz', CASE WHEN ERROR_NUMBER() = 50401 THEN 1 ELSE 0 END, ERROR_MESSAGE()); END CATCH

DECLARE @audit TABLE (Id bigint, Action varchar(40), Entity varchar(40), EntityId nvarchar(64), Details nvarchar(max), CreatedAtLocal datetime2(0), ActorName nvarchar(121));
INSERT @audit EXEC api.Admin_AuditLog_List @admin;
INSERT #r VALUES (N'Admin işlemleri kayıt altında', CASE WHEN (SELECT COUNT(*) FROM @audit) >= 8 THEN 1 ELSE 0 END, (SELECT CAST(COUNT(*) AS nvarchar) FROM @audit));

REVERT;

-- =====================================================================
-- Ek özellikler
-- =====================================================================
EXECUTE AS USER = 'test_app';

-- KVKK
BEGIN TRY EXEC api.Auth_Register N'nokvkk@test.com', N'hash', N'Kvkk', N'Yok', NULL, N'05330000009'; INSERT #r VALUES (N'KVKK onayı olmadan kayıt olunamaz', 0, NULL); END TRY
BEGIN CATCH IF XACT_STATE() <> 0 ROLLBACK; INSERT #r VALUES (N'KVKK onayı olmadan kayıt olunamaz', CASE WHEN ERROR_NUMBER() = 50400 THEN 1 ELSE 0 END, ERROR_MESSAGE()); END CATCH

-- Personel molası: her gün 13:00–14:00
DECLARE @day5 date = DATEADD(day, 4, CAST(@tomorrowNoon AS date));
DECLARE @today date = DATEADD(day, -1, CAST(@tomorrowNoon AS date));
EXEC api.Staff_SetBreaks @worker, @staff, N'[{"weekday":null,"start":"13:00","end":"14:00"}]';
DELETE @slots; INSERT @slots EXEC api.Appointment_AvailableSlots @staff, @day5, @svcJson1;
INSERT #r VALUES (N'Öğle arasında (13:00–14:00) randevu açılmaz, 12:30 ve 14:00 açık',
  CASE WHEN NOT EXISTS (SELECT 1 FROM @slots WHERE CAST(StartsAtLocal AS time(0)) IN ('13:00', '13:30'))
        AND EXISTS (SELECT 1 FROM @slots WHERE CAST(StartsAtLocal AS time(0)) = '12:30')
        AND EXISTS (SELECT 1 FROM @slots WHERE CAST(StartsAtLocal AS time(0)) = '14:00') THEN 1 ELSE 0 END, NULL);

-- Haftalık izin günü
DECLARE @wd tinyint = (DATEDIFF(day, '19000101', @day5) % 7) + 1;
DECLARE @dayoff TABLE (Id uniqueidentifier, ConflictingAppointments int);
INSERT @dayoff EXEC api.Staff_AddDayOff @worker, @staff, @wd;
DELETE @slots; INSERT @slots EXEC api.Appointment_AvailableSlots @staff, @day5, @svcJson1;
INSERT #r VALUES (N'Personelin haftalık izin gününde randevu açılmaz', CASE WHEN NOT EXISTS (SELECT 1 FROM @slots) THEN 1 ELSE 0 END, NULL);
DECLARE @dayoffId uniqueidentifier = (SELECT Id FROM @dayoff);
EXEC api.Staff_RemoveDayOff @worker, @dayoffId;
BEGIN TRY EXEC api.Staff_AddDayOff @cust, @staff, 1; INSERT #r VALUES (N'Müşteri personele izin giremez', 0, NULL); END TRY
BEGIN CATCH IF XACT_STATE() <> 0 ROLLBACK; INSERT #r VALUES (N'Müşteri personele izin giremez', CASE WHEN ERROR_NUMBER() = 50403 THEN 1 ELSE 0 END, ERROR_MESSAGE()); END CATCH

-- Tatil (tarih aralığı) — dükkân sahibi girer
DELETE @dayoff; INSERT @dayoff EXEC api.Staff_AddDayOff @owner, @staff, NULL, @day5, @day5, N'Yıllık izin';
DECLARE @panelStaff TABLE (Id uniqueidentifier, DisplayName nvarchar(100), Title nvarchar(100), PhotoPath nvarchar(300), Phone varchar(20), ShowPhone bit, IsActive bit, HasAccount bit, BreaksJson nvarchar(max), DaysOffJson nvarchar(max));
INSERT @panelStaff EXEC api.Staff_ListForPanel @owner, @shop;
INSERT #r VALUES (N'Panel personel listesi mola ve izinleri getirir',
  CASE WHEN EXISTS (SELECT 1 FROM @panelStaff WHERE Id = @staff AND BreaksJson LIKE N'%13:00%' AND DaysOffJson LIKE N'%Yıllık izin%') THEN 1 ELSE 0 END, NULL);
BEGIN TRY EXEC api.Staff_ListForPanel @cust, @shop; INSERT #r VALUES (N'Müşteri panel personel listesini göremez', 0, NULL); END TRY
BEGIN CATCH INSERT #r VALUES (N'Müşteri panel personel listesini göremez', CASE WHEN ERROR_NUMBER() = 50403 THEN 1 ELSE 0 END, ERROR_MESSAGE()); END CATCH
DELETE @slots; INSERT @slots EXEC api.Appointment_AvailableSlots @staff, @day5, @svcJson1;
INSERT #r VALUES (N'Personel tatildeyken randevu açılmaz', CASE WHEN NOT EXISTS (SELECT 1 FROM @slots) THEN 1 ELSE 0 END, NULL);
SET @dayoffId = (SELECT Id FROM @dayoff);
EXEC api.Staff_RemoveDayOff @owner, @dayoffId;
DELETE @slots; INSERT @slots EXEC api.Appointment_AvailableSlots @staff, @day5, @svcJson1;
INSERT #r VALUES (N'İzin silinince randevular tekrar açılır', CASE WHEN EXISTS (SELECT 1 FROM @slots) THEN 1 ELSE 0 END, NULL);

-- Dükkân özel kapalı günü (bugün: Bayram)
DECLARE @clos TABLE (Id uniqueidentifier, ConflictingAppointments int);
INSERT @clos EXEC api.ShopClosure_Add @owner, @shop, @today, @today, N'Bayram';
DELETE @search; INSERT @search EXEC api.Shop_Search 'erkek', NULL, NULL, 10, 34, @kadikoy;
INSERT #r VALUES (N'Özel kapalı günde rozet "kapalı" gösterir', CASE WHEN (SELECT IsOpen FROM @search) = 0 THEN 1 ELSE 0 END, NULL);
BEGIN TRY EXEC api.Queue_Join @cust4, @shop; INSERT #r VALUES (N'Özel kapalı günde sıraya girilemez', 0, NULL); END TRY
BEGIN CATCH IF XACT_STATE() <> 0 ROLLBACK; INSERT #r VALUES (N'Özel kapalı günde sıraya girilemez', CASE WHEN ERROR_MESSAGE() LIKE N'%kapalı%' THEN 1 ELSE 0 END, ERROR_MESSAGE()); END CATCH
DECLARE @closId uniqueidentifier = (SELECT Id FROM @clos);
EXEC api.ShopClosure_Remove @owner, @closId;
DELETE @clos; INSERT @clos EXEC api.ShopClosure_Add @owner, @shop, @day5, @day5, N'Tadilat';
DELETE @slots; INSERT @slots EXEC api.Appointment_AvailableSlots @staff, @day5, @svcJson1;
INSERT #r VALUES (N'Özel kapalı günde randevu açılmaz', CASE WHEN NOT EXISTS (SELECT 1 FROM @slots) THEN 1 ELSE 0 END, NULL);
SET @closId = (SELECT Id FROM @clos);
EXEC api.ShopClosure_Remove @owner, @closId;
BEGIN TRY EXEC api.ShopClosure_Add @worker, @shop, @day5, @day5; INSERT #r VALUES (N'Kapalı günü yalnızca dükkân sahibi girer', 0, NULL); END TRY
BEGIN CATCH IF XACT_STATE() <> 0 ROLLBACK; INSERT #r VALUES (N'Kapalı günü yalnızca dükkân sahibi girer', CASE WHEN ERROR_NUMBER() = 50403 THEN 1 ELSE 0 END, ERROR_MESSAGE()); END CATCH

-- Randevu hatırlatma (24 saat kala)
REVERT;
DECLARE @in24 datetime2(0) = DATEADD(hour, 24, SYSUTCDATETIME());
INSERT INTO data.Appointments (Id, ShopId, StaffId, CustomerId, CustomerName, StartsAt, EndsAt, Status, TotalPrice)
VALUES ('22222222-0000-0000-0000-000000000001', @shop, @staff, @cust3, N'Can Kara', @in24, DATEADD(minute, 30, @in24), 'accepted', 300);
EXECUTE AS USER = 'test_app';
DECLARE @rem TABLE (Enqueued int);
INSERT @rem EXEC api.Worker_EnqueueReminders;
DECLARE @rem1 int = (SELECT Enqueued FROM @rem);
DELETE @rem; INSERT @rem EXEC api.Worker_EnqueueReminders;
REVERT;
INSERT #r VALUES (N'Randevudan 1 gün önce hatırlatma gider, ikinci kez gitmez',
  CASE WHEN @rem1 >= 1 AND (SELECT Enqueued FROM @rem) = 0
        AND EXISTS (SELECT 1 FROM data.Notifications WHERE UserId = @cust3 AND Kind = 'appointment_reminder' AND Title = N'Yarın randevun var') THEN 1 ELSE 0 END, NULL);
EXECUTE AS USER = 'test_app';

-- Şifremi unuttum
DECLARE @rt binary(32) = HASHBYTES('SHA2_256', '482913'), @rtExp datetime2(0) = DATEADD(minute, 30, SYSUTCDATETIME());
DECLARE @resetRow TABLE (UserId uniqueidentifier, FirstName nvarchar(60));
INSERT @resetRow EXEC api.Auth_CreatePasswordReset N'yok@test.com', @rt, @rtExp;
INSERT #r VALUES (N'Kayıtlı olmayan e-postaya kod oluşturulmaz (sızıntı yok)', CASE WHEN NOT EXISTS (SELECT 1 FROM @resetRow) THEN 1 ELSE 0 END, NULL);
INSERT @resetRow EXEC api.Auth_CreatePasswordReset N'Cust4@Test.com', @rt, @rtExp;
INSERT #r VALUES (N'Şifre sıfırlama kodu oluşturuldu', CASE WHEN (SELECT FirstName FROM @resetRow) = N'Efe' THEN 1 ELSE 0 END, NULL);
DECLARE @wrong binary(32) = HASHBYTES('SHA2_256', '000000');
BEGIN TRY EXEC api.Auth_ResetPassword N'cust4@test.com', @wrong, N'yeni-hash'; INSERT #r VALUES (N'Yanlış kodla şifre değişmez', 0, NULL); END TRY
BEGIN CATCH IF XACT_STATE() <> 0 ROLLBACK; INSERT #r VALUES (N'Yanlış kodla şifre değişmez', CASE WHEN ERROR_NUMBER() = 50400 THEN 1 ELSE 0 END, ERROR_MESSAGE()); END CATCH
EXEC api.Auth_ResetPassword N'cust4@test.com', @rt, N'yeni-hash';
BEGIN TRY EXEC api.Auth_ResetPassword N'cust4@test.com', @rt, N'baska-hash'; INSERT #r VALUES (N'Kod ikinci kez kullanılamaz', 0, NULL); END TRY
BEGIN CATCH IF XACT_STATE() <> 0 ROLLBACK; INSERT #r VALUES (N'Kod ikinci kez kullanılamaz', CASE WHEN ERROR_NUMBER() = 50400 THEN 1 ELSE 0 END, ERROR_MESSAGE()); END CATCH
DELETE @login; INSERT @login EXEC api.Auth_GetUserForLogin N'cust4@test.com';
INSERT #r VALUES (N'Doğru kodla şifre değişti', CASE WHEN (SELECT PasswordHash FROM @login) = N'yeni-hash' THEN 1 ELSE 0 END, NULL);
-- 5 yanlış denemeden sonra doğru kod da kabul edilmez
DECLARE @rt2 binary(32) = HASHBYTES('SHA2_256', '771204'), @try int = 0;
DELETE @resetRow; INSERT @resetRow EXEC api.Auth_CreatePasswordReset N'cust4@test.com', @rt2, @rtExp;
WHILE @try < 5 BEGIN BEGIN TRY EXEC api.Auth_ResetPassword N'cust4@test.com', @wrong, N'x'; END TRY BEGIN CATCH IF XACT_STATE() <> 0 ROLLBACK; END CATCH; SET @try += 1; END
BEGIN TRY EXEC api.Auth_ResetPassword N'cust4@test.com', @rt2, N'tahmin-hash'; INSERT #r VALUES (N'5 yanlış denemeden sonra kod kilitlenir', 0, NULL); END TRY
BEGIN CATCH IF XACT_STATE() <> 0 ROLLBACK; INSERT #r VALUES (N'5 yanlış denemeden sonra kod kilitlenir', CASE WHEN ERROR_NUMBER() = 50409 THEN 1 ELSE 0 END, ERROR_MESSAGE()); END CATCH

-- Favoriler ve tekrar randevu
DECLARE @fav TABLE (IsFavorite bit);
INSERT @fav EXEC api.Favorite_Toggle @cust4, @shop;
DECLARE @favList TABLE (Id uniqueidentifier, Code varchar(12), Segment varchar(5), Name nvarchar(100), Slug varchar(120), ProvinceSlug varchar(40),
  DistrictSlug varchar(60), District nvarchar(60), Province nvarchar(40), Phone varchar(16), CoverImagePath nvarchar(300), IsOpen bit, ClosesAt time(0));
INSERT @favList EXEC api.Favorite_ListMine @cust4;
INSERT #r VALUES (N'Dükkân favorilere eklendi', CASE WHEN (SELECT IsFavorite FROM @fav) = 1 AND (SELECT COUNT(*) FROM @favList) = 1 THEN 1 ELSE 0 END, NULL);
DELETE @fav; INSERT @fav EXEC api.Favorite_Toggle @cust4, @shop; INSERT @fav EXEC api.Favorite_Toggle @cust4, @shop;
DECLARE @rebook TABLE (ShopId uniqueidentifier, ShopName nvarchar(100), StaffId uniqueidentifier, StaffName nvarchar(60), ServiceIdsJson nvarchar(max));
INSERT @rebook EXEC api.Appointment_RebookInfo @cust, @appt;
INSERT #r VALUES (N'"Geçen seferki gibi": aynı personel ve 2 hizmet hazır gelir',
  CASE WHEN (SELECT StaffId FROM @rebook) = @staff AND (SELECT COUNT(*) FROM OPENJSON((SELECT ServiceIdsJson FROM @rebook))) = 2 THEN 1 ELSE 0 END, NULL);
DELETE @rebook; INSERT @rebook EXEC api.Appointment_RebookInfo @cust4, @appt;
INSERT #r VALUES (N'Başkasının randevusu tekrar alınamaz', CASE WHEN NOT EXISTS (SELECT 1 FROM @rebook) THEN 1 ELSE 0 END, NULL);

-- Çalışma fotoğrafları (galeri)
INSERT #id EXEC api.Gallery_Add @worker, @shop, N'gallery/fade.jpg', N'Skin fade'; DECLARE @g1 uniqueidentifier = (SELECT Id FROM #id); DELETE #id;
INSERT #id EXEC api.Gallery_Add @owner, @shop, N'gallery/dukkan.jpg', N'Dükkânımız'; DECLARE @g2 uniqueidentifier = (SELECT Id FROM #id); DELETE #id;
BEGIN TRY EXEC api.Gallery_Add @cust, @shop, N'x.jpg'; INSERT #r VALUES (N'Müşteri galeriye fotoğraf ekleyemez', 0, NULL); END TRY
BEGIN CATCH IF XACT_STATE() <> 0 ROLLBACK; INSERT #r VALUES (N'Müşteri galeriye fotoğraf ekleyemez', CASE WHEN ERROR_NUMBER() = 50403 THEN 1 ELSE 0 END, ERROR_MESSAGE()); END CATCH
DECLARE @gal TABLE (Id uniqueidentifier, Path nvarchar(300), Caption nvarchar(150), StaffId uniqueidentifier, StaffName nvarchar(60), IsHidden bit, CreatedAtLocal datetime2(0));
INSERT @gal EXEC api.Gallery_List @shop, @staff;
INSERT #r VALUES (N'Personelin fotoğrafı onun adına kaydedildi', CASE WHEN (SELECT COUNT(*) FROM @gal) = 1 AND (SELECT Id FROM @gal) = @g1 THEN 1 ELSE 0 END, NULL);
BEGIN TRY EXEC api.Gallery_Remove @worker, @g2; INSERT #r VALUES (N'Personel başkasının fotoğrafını silemez', 0, NULL); END TRY
BEGIN CATCH IF XACT_STATE() <> 0 ROLLBACK; INSERT #r VALUES (N'Personel başkasının fotoğrafını silemez', CASE WHEN ERROR_NUMBER() = 50403 THEN 1 ELSE 0 END, ERROR_MESSAGE()); END CATCH
EXEC api.Admin_Gallery_SetHidden @admin, @g2, 1;
DELETE @gal; INSERT @gal EXEC api.Gallery_List @shop;
INSERT #r VALUES (N'Admin gizlediği fotoğraf ziyaretçiye görünmez', CASE WHEN NOT EXISTS (SELECT 1 FROM @gal WHERE Id = @g2) AND EXISTS (SELECT 1 FROM @gal WHERE Id = @g1) THEN 1 ELSE 0 END, NULL);

-- Şikayet
INSERT #id EXEC api.Report_Create @cust4, 'photo', @g1, 'uygunsuz', N'Bu fotoğraf başka bir dükkândan alınmış'; DECLARE @rep uniqueidentifier = (SELECT Id FROM #id); DELETE #id;
BEGIN TRY EXEC api.Report_Create @cust4, 'photo', @g1, 'sahte'; INSERT #r VALUES (N'Aynı şey açıkken iki kez bildirilemez', 0, NULL); END TRY
BEGIN CATCH IF XACT_STATE() <> 0 ROLLBACK; INSERT #r VALUES (N'Aynı şey açıkken iki kez bildirilemez', CASE WHEN ERROR_NUMBER() = 50409 THEN 1 ELSE 0 END, ERROR_MESSAGE()); END CATCH
DECLARE @reports TABLE (Id uniqueidentifier, TargetType varchar(10), TargetId uniqueidentifier, Reason varchar(16), Note nvarchar(500), Status varchar(10),
  ResolutionNote nvarchar(300), CreatedAtLocal datetime2(0), ReporterName nvarchar(121), ReporterEmail nvarchar(254), TargetSummary nvarchar(400), TimesReported int);
INSERT @reports EXEC api.Admin_Report_List @admin;
INSERT #r VALUES (N'Şikayet admin listesinde, içerik özetiyle', CASE WHEN (SELECT TargetSummary FROM @reports WHERE Id = @rep) = N'gallery/fade.jpg' THEN 1 ELSE 0 END, NULL);
BEGIN TRY EXEC api.Admin_Report_List @owner; INSERT #r VALUES (N'Şikayet listesini yalnızca admin görür', 0, NULL); END TRY
BEGIN CATCH IF XACT_STATE() <> 0 ROLLBACK; INSERT #r VALUES (N'Şikayet listesini yalnızca admin görür', CASE WHEN ERROR_NUMBER() = 50403 THEN 1 ELSE 0 END, ERROR_MESSAGE()); END CATCH
EXEC api.Admin_Report_Resolve @admin, @rep, 'resolved', N'Fotoğraf gizlendi';
DELETE @reports; INSERT @reports EXEC api.Admin_Report_List @admin, 'open';
INSERT #r VALUES (N'Şikayet kapatıldı', CASE WHEN NOT EXISTS (SELECT 1 FROM @reports WHERE Id = @rep) THEN 1 ELSE 0 END, NULL);

-- İstatistikler
DECLARE @st TABLE (CompletedAppointments int, AppointmentRevenue decimal(12, 2), NoShows int, Cancellations int, QueueServed int,
  ProductRevenue decimal(12, 2), UniqueCustomers int, TopServicesJson nvarchar(max), TopStaffJson nvarchar(max));
INSERT @st EXEC api.Shop_Stats @owner, @shop, 7;
INSERT #r VALUES (N'Dükkân istatistikleri: tamamlanan randevu, kazanç, en çok tercih edilen hizmet',
  CASE WHEN (SELECT CompletedAppointments FROM @st) >= 1 AND (SELECT AppointmentRevenue FROM @st) > 0
        AND ISJSON((SELECT TopServicesJson FROM @st)) = 1 THEN 1 ELSE 0 END,
  (SELECT CONCAT(CompletedAppointments, ' randevu, ', AppointmentRevenue, ' TL') FROM @st));
BEGIN TRY EXEC api.Shop_Stats @worker, @shop; INSERT #r VALUES (N'Dükkân istatistiklerini personel göremez', 0, NULL); END TRY
BEGIN CATCH IF XACT_STATE() <> 0 ROLLBACK; INSERT #r VALUES (N'Dükkân istatistiklerini personel göremez', CASE WHEN ERROR_NUMBER() = 50403 THEN 1 ELSE 0 END, ERROR_MESSAGE()); END CATCH
DECLARE @daily TABLE (Day date, NewUsers int, NewShops int, NewAppointments int, CompletedAppointments int, QueueEntries int);
INSERT @daily EXEC api.Admin_StatsDaily @admin, 7;
DECLARE @prov TABLE (Province nvarchar(40), Shops int, Appointments int);
INSERT @prov EXEC api.Admin_StatsTopProvinces @admin;
INSERT #r VALUES (N'Platform istatistikleri: 7 günlük grafik ve en aktif il (İstanbul)',
  CASE WHEN (SELECT COUNT(*) FROM @daily) = 7 AND (SELECT SUM(NewUsers) FROM @daily) >= 5 AND (SELECT TOP 1 Province FROM @prov) = N'İstanbul' THEN 1 ELSE 0 END, NULL);

-- Hesabımı sil (KVKK)
BEGIN TRY EXEC api.User_DeleteAccount @owner; INSERT #r VALUES (N'Açık dükkânı olan hesabını silemez', 0, NULL); END TRY
BEGIN CATCH IF XACT_STATE() <> 0 ROLLBACK; INSERT #r VALUES (N'Açık dükkânı olan hesabını silemez', CASE WHEN ERROR_NUMBER() = 50409 THEN 1 ELSE 0 END, ERROR_MESSAGE()); END CATCH
EXEC api.User_DeleteAccount @cust4;
REVERT;
INSERT #r VALUES (N'Hesap silinince kişisel bilgiler silinir, giriş yapılamaz',
  CASE WHEN EXISTS (SELECT 1 FROM data.Users WHERE Id = @cust4 AND Email LIKE 'silindi-%' AND Phone IS NULL AND IsActive = 0 AND FirstName = N'Silinmiş')
        AND NOT EXISTS (SELECT 1 FROM data.PushSubscriptions WHERE UserId = @cust4)
        AND NOT EXISTS (SELECT 1 FROM data.Appointments WHERE CustomerId = @cust4 AND CustomerName <> N'Silinmiş kullanıcı') THEN 1 ELSE 0 END, NULL);

-- =====================================================================
-- Değişiklik geçmişi, harita dizini, temizlik, bakım
-- =====================================================================
EXECUTE AS USER = 'test_app';
INSERT #id EXEC api.ShopService_Save @owner, @shop, @svc1, @catSac, N'Saç Kesimi', NULL, 350, 30; DELETE #id;
INSERT #id EXEC api.ShopService_Save @owner, @shop, @svc1, @catSac, N'Saç Kesimi', NULL, 400, 30; DELETE #id;
DECLARE @hist TABLE (ChangedAtLocal datetime2(0), IsCurrent bit, ChangedBy nvarchar(121), Snapshot nvarchar(max));
INSERT @hist EXEC api.History_List @owner, 'service', @svc1;
INSERT #r VALUES (N'Fiyat geçmişi: 300 → 350 → 400 TL, değiştiren kişiyle',
  CASE WHEN (SELECT COUNT(*) FROM @hist) >= 3
        AND (SELECT JSON_VALUE(Snapshot, '$.fiyat') FROM @hist WHERE IsCurrent = 1) = '400.00'
        AND EXISTS (SELECT 1 FROM @hist WHERE JSON_VALUE(Snapshot, '$.fiyat') = '300.00')
        AND (SELECT ChangedBy FROM @hist WHERE IsCurrent = 1) = N'Ahmet Usta' THEN 1 ELSE 0 END,
  (SELECT STRING_AGG(JSON_VALUE(Snapshot, '$.fiyat'), ' → ') FROM @hist));
BEGIN TRY EXEC api.History_List @cust, 'service', @svc1; INSERT #r VALUES (N'Geçmişi müşteri göremez', 0, NULL); END TRY
BEGIN CATCH IF XACT_STATE() <> 0 ROLLBACK; INSERT #r VALUES (N'Geçmişi müşteri göremez', CASE WHEN ERROR_NUMBER() = 50403 THEN 1 ELSE 0 END, ERROR_MESSAGE()); END CATCH
DELETE @hist; INSERT @hist EXEC api.History_List @admin, 'shop', @shop;
INSERT #r VALUES (N'Admin dükkân geçmişini görür (onay dahil)', CASE WHEN EXISTS (SELECT 1 FROM @hist WHERE JSON_VALUE(Snapshot, '$.durum') = 'pending')
  AND EXISTS (SELECT 1 FROM @hist WHERE JSON_VALUE(Snapshot, '$.durum') = 'approved') THEN 1 ELSE 0 END, NULL);
DELETE @search; INSERT @search EXEC api.Shop_Search 'erkek', 41.10, 29.03, 5;
INSERT #r VALUES (N'Harita dizini: 12 km uzaktaki dükkân 5 km aramada çıkmaz', CASE WHEN NOT EXISTS (SELECT 1 FROM @search) THEN 1 ELSE 0 END, NULL);
DELETE @search; INSERT @search EXEC api.Shop_Search 'erkek', 41.10, 29.03, 15;
INSERT #r VALUES (N'Harita dizini: 15 km aramada çıkar, mesafe ~12,5 km',
  CASE WHEN (SELECT DistanceKm FROM @search) BETWEEN 12 AND 13.5 THEN 1 ELSE 0 END, (SELECT CAST(DistanceKm AS nvarchar) FROM @search));
REVERT;

-- Gece temizliği
INSERT INTO data.Sessions (TokenHash, UserId, ExpiresAt) VALUES (HASHBYTES('SHA2_256', 'eski-oturum'), @cust, DATEADD(day, -1, SYSUTCDATETIME()));
INSERT INTO data.Notifications (UserId, Kind, Title, Body, CreatedAt, ReadAt)
VALUES (@cust, 'campaign', N'Eski', N'Eski bildirim', DATEADD(day, -100, SYSUTCDATETIME()), DATEADD(day, -99, SYSUTCDATETIME()));
DECLARE @clean TABLE (Sessions int, ResetCodes int, Notifications int, Devices int, QueueEntries int, Reports int, AuditLog int, Security int);
INSERT @clean EXEC data.usp_NightlyCleanup;
INSERT #r VALUES (N'Gece temizliği: süresi dolmuş oturum ve 100 günlük okunmuş bildirim silindi',
  CASE WHEN (SELECT Sessions FROM @clean) >= 1 AND (SELECT Notifications FROM @clean) >= 1
        AND NOT EXISTS (SELECT 1 FROM data.Notifications WHERE Title = N'Eski') THEN 1 ELSE 0 END, NULL);
EXECUTE AS USER = 'test_app';
BEGIN TRY EXEC data.usp_NightlyCleanup; INSERT #r VALUES (N'Site bakım işlemlerini çalıştıramaz', 0, NULL); END TRY
BEGIN CATCH IF XACT_STATE() <> 0 ROLLBACK; INSERT #r VALUES (N'Site bakım işlemlerini çalıştıramaz', CASE WHEN ERROR_NUMBER() = 229 THEN 1 ELSE 0 END, ERROR_MESSAGE()); END CATCH
REVERT;

-- =====================================================================
-- Google ile giriş
-- =====================================================================
EXECUTE AS USER = 'test_app';
DECLARE @g TABLE (Id uniqueidentifier, IsActive bit, LockedUntil datetime2(0), TotpEnabled bit, TotpSecret nvarchar(64));
INSERT @g EXEC api.Auth_GoogleSignIn 'google-sub-yeni', N'yeni.google@test.com', 1;
INSERT #r VALUES (N'Google: yeni kullanıcı için satır dönmez (kayıt tamamlanacak)', CASE WHEN NOT EXISTS (SELECT 1 FROM @g) THEN 1 ELSE 0 END, NULL);
BEGIN TRY EXEC api.Auth_RegisterGoogle 'google-sub-yeni', N'yeni.google@test.com', N'Gül', N'Google', N'05440001122'; INSERT #r VALUES (N'Google kaydı da KVKK onayı ister', 0, NULL); END TRY
BEGIN CATCH IF XACT_STATE() <> 0 ROLLBACK; INSERT #r VALUES (N'Google kaydı da KVKK onayı ister', CASE WHEN ERROR_NUMBER() = 50400 THEN 1 ELSE 0 END, ERROR_MESSAGE()); END CATCH
INSERT #id EXEC api.Auth_RegisterGoogle 'google-sub-yeni', N'yeni.google@test.com', N'Gül', N'Google', N'05440001122', NULL, 1;
DECLARE @gUser uniqueidentifier = (SELECT Id FROM #id); DELETE #id;
DELETE @g; INSERT @g EXEC api.Auth_GoogleSignIn 'google-sub-yeni', N'yeni.google@test.com', 1;
INSERT #r VALUES (N'Google: kayıttan sonra aynı hesapla giriş', CASE WHEN (SELECT Id FROM @g) = @gUser THEN 1 ELSE 0 END, NULL);
DELETE @g; INSERT @g EXEC api.Auth_GoogleSignIn 'google-sub-cust', N'cust@test.com', 0;
INSERT #r VALUES (N'Google: doğrulanmamış e-posta mevcut hesaba bağlanmaz', CASE WHEN NOT EXISTS (SELECT 1 FROM @g) THEN 1 ELSE 0 END, NULL);
DELETE @g; INSERT @g EXEC api.Auth_GoogleSignIn 'google-sub-cust', N'CUST@test.com', 1;
INSERT #r VALUES (N'Google: doğrulanmış e-posta mevcut hesaba bağlanır', CASE WHEN (SELECT Id FROM @g) = @cust THEN 1 ELSE 0 END, NULL);
REVERT;

-- =====================================================================
-- Katılmamış dükkân, sahiplenme ve eksik dükkân bildirimi
-- =====================================================================
EXECUTE AS USER = 'test_app';
DECLARE @osm TABLE (Id uniqueidentifier, Code varchar(12));
INSERT @osm EXEC api.Admin_Shop_Create @admin, 'erkek', N'Gerçek Berber', NULL, NULL, 34, @kadikoy, @caferaga, N'Moda Caddesi', NULL, NULL, 40.9880, 29.0270;
DECLARE @unclaimed uniqueidentifier = (SELECT Id FROM @osm);
DECLARE @adminShops TABLE (Id uniqueidentifier, Code varchar(12), Segment varchar(5), Name nvarchar(100), Status varchar(10), StatusReason nvarchar(300), IsOwner bit);
INSERT @adminShops EXEC api.Shop_ListMine @admin;
INSERT #r VALUES (N'Admin eklediği dükkânın yöneticisi olur (işletme paneline düşer)', CASE WHEN EXISTS (SELECT 1 FROM @adminShops WHERE Id = @unclaimed) THEN 1 ELSE 0 END, NULL);
BEGIN TRY EXEC api.Admin_Shop_SetActive @admin, @unclaimed, 1; INSERT #r VALUES (N'Hizmet/personel/saat girilmeden dükkân aktif yapılamaz', 0, NULL); END TRY
BEGIN CATCH IF XACT_STATE() <> 0 ROLLBACK; INSERT #r VALUES (N'Hizmet/personel/saat girilmeden dükkân aktif yapılamaz', CASE WHEN ERROR_NUMBER() = 50409 THEN 1 ELSE 0 END, ERROR_MESSAGE()); END CATCH
BEGIN TRY EXEC api.Queue_Join @cust, @unclaimed; INSERT #r VALUES (N'Katılmamış dükkânda sıraya girilemez', 0, NULL); END TRY
BEGIN CATCH IF XACT_STATE() <> 0 ROLLBACK; INSERT #r VALUES (N'Katılmamış dükkânda sıraya girilemez', CASE WHEN ERROR_MESSAGE() LIKE N'%katılmadı%' THEN 1 ELSE 0 END, ERROR_MESSAGE()); END CATCH
BEGIN TRY EXEC api.Admin_Shop_Create @owner, 'erkek', N'Sahte', NULL, NULL, 34, @kadikoy, @caferaga, N'X', NULL, NULL, 40.98, 29.02; INSERT #r VALUES (N'Admin olmayan dükkân ekleyemez', 0, NULL); END TRY
BEGIN CATCH IF XACT_STATE() <> 0 ROLLBACK; INSERT #r VALUES (N'Admin olmayan dükkân ekleyemez', CASE WHEN ERROR_NUMBER() = 50403 THEN 1 ELSE 0 END, ERROR_MESSAGE()); END CATCH
BEGIN TRY EXEC api.Claim_Create @cust3, @unclaimed, N'05441112255'; INSERT #r VALUES (N'Müşteri hesabı dükkân sahiplenemez', 0, NULL); END TRY
BEGIN CATCH IF XACT_STATE() <> 0 ROLLBACK; INSERT #r VALUES (N'Müşteri hesabı dükkân sahiplenemez', CASE WHEN ERROR_NUMBER() = 50403 THEN 1 ELSE 0 END, ERROR_MESSAGE()); END CATCH
INSERT #id EXEC api.Claim_Create @worker, @unclaimed, N'0544 111 22 33', N'Dükkân benim'; DECLARE @claimId uniqueidentifier = (SELECT Id FROM #id); DELETE #id;
INSERT #id EXEC api.OwnerDocument_Add @worker, NULL, @claimId, 'vergi_levhasi', N'dogrulama/test.jpg'; DECLARE @docId uniqueidentifier = (SELECT Id FROM #id); DELETE #id;
BEGIN TRY EXEC api.OwnerDocument_Add @cust, NULL, @claimId, 'vergi_levhasi', N'dogrulama/x.jpg'; INSERT #r VALUES (N'Başkasının talebine belge eklenemez', 0, NULL); END TRY
BEGIN CATCH INSERT #r VALUES (N'Başkasının talebine belge eklenemez', CASE WHEN ERROR_NUMBER() = 50403 THEN 1 ELSE 0 END, ERROR_MESSAGE()); END CATCH
DECLARE @docFile TABLE (FilePath nvarchar(300));
INSERT @docFile EXEC api.OwnerDocument_GetFile @cust, @docId;
INSERT #r VALUES (N'Belge dosyasını başkası göremez', CASE WHEN NOT EXISTS (SELECT 1 FROM @docFile) THEN 1 ELSE 0 END, NULL);
INSERT @docFile EXEC api.OwnerDocument_GetFile @admin, @docId;
EXEC api.Admin_OwnerDocument_Review @admin, @docId, 'approved';
DECLARE @docs TABLE (Id uniqueidentifier, Kind varchar(16), Status varchar(10), ReviewNote nvarchar(300), CreatedAtLocal datetime2(0));
INSERT @docs EXEC api.OwnerDocument_List @admin, NULL, @claimId;
INSERT #r VALUES (N'Admin belgeyi görür ve onaylar', CASE WHEN EXISTS (SELECT 1 FROM @docFile) AND (SELECT Status FROM @docs) = 'approved' THEN 1 ELSE 0 END, NULL);
BEGIN TRY EXEC api.Claim_Create @worker, @unclaimed, N'05441112233'; INSERT #r VALUES (N'Aynı dükkân için ikinci açık talep olmaz', 0, NULL); END TRY
BEGIN CATCH IF XACT_STATE() <> 0 ROLLBACK; INSERT #r VALUES (N'Aynı dükkân için ikinci açık talep olmaz', CASE WHEN ERROR_NUMBER() = 50409 THEN 1 ELSE 0 END, ERROR_MESSAGE()); END CATCH
EXEC api.Admin_Claim_Resolve @admin, @claimId, 1, N'Telefonla doğrulandı';
REVERT;
INSERT #r VALUES (N'Sahiplenme onaylanınca dükkân talep edene geçer ve "katılmış" olur',
  CASE WHEN EXISTS (SELECT 1 FROM data.Shops WHERE Id = @unclaimed AND OwnerId = @worker AND IsClaimed = 1)
        AND EXISTS (SELECT 1 FROM data.Notifications WHERE UserId = @worker AND Kind = 'shop_claim') THEN 1 ELSE 0 END, NULL);
EXECUTE AS USER = 'test_app';
BEGIN TRY EXEC api.Claim_Create @cust, @unclaimed, N'05441112244'; INSERT #r VALUES (N'Sahiplenilmiş dükkân tekrar sahiplenilemez', 0, NULL); END TRY
BEGIN CATCH IF XACT_STATE() <> 0 ROLLBACK; INSERT #r VALUES (N'Sahiplenilmiş dükkân tekrar sahiplenilemez', CASE WHEN ERROR_NUMBER() = 50409 THEN 1 ELSE 0 END, ERROR_MESSAGE()); END CATCH
INSERT #id EXEC api.Suggestion_Create @cust, 'erkek', N'Gerçek Berber', NULL, 40.9881, 29.0271, N'Burada bir berber var';
DECLARE @sug uniqueidentifier = (SELECT Id FROM #id); DELETE #id;
DECLARE @sugs TABLE (Id uniqueidentifier, Status varchar(10), Segment varchar(5), Name nvarchar(100), Phone varchar(16), Latitude decimal(9, 6), Longitude decimal(9, 6),
  Note nvarchar(500), CreatedShopId uniqueidentifier, CreatedAtLocal datetime2(0), ReporterName nvarchar(121), NearbyShop nvarchar(100));
INSERT @sugs EXEC api.Admin_Suggestion_List @admin;
INSERT #r VALUES (N'Eksik dükkân bildirimi admin listesinde; yakındaki aynı dükkân uyarısıyla',
  CASE WHEN (SELECT NearbyShop FROM @sugs WHERE Id = @sug) = N'Gerçek Berber' THEN 1 ELSE 0 END, (SELECT NearbyShop FROM @sugs WHERE Id = @sug));
EXEC api.Admin_Suggestion_Resolve @admin, @sug, 'dismissed';
DELETE @sugs; INSERT @sugs EXEC api.Admin_Suggestion_List @admin;
INSERT #r VALUES (N'Bildirim kapatıldı', CASE WHEN NOT EXISTS (SELECT 1 FROM @sugs WHERE Id = @sug) THEN 1 ELSE 0 END, NULL);
REVERT;

INSERT #r VALUES (N'İşletme hesabıyla kayıt dükkân sahibi rolü verir', CASE WHEN (SELECT Role FROM data.Users WHERE Email = N'owner@test.com') = 'shop_owner' AND (SELECT Role FROM data.Users WHERE Email = N'cust3@test.com') = 'customer' THEN 1 ELSE 0 END, NULL);

-- Admin, dükkân sahibi olmadan da dükkânın her şeyini yönetebilir
DECLARE @adminCat int = (SELECT TOP (1) Id FROM data.ServiceCategories WHERE Segment = 'erkek' ORDER BY Id);
DECLARE @adminSvc TABLE (Id uniqueidentifier);
INSERT @adminSvc EXEC api.ShopService_Save @ActorId = @admin, @ShopId = @shop, @CategoryId = @adminCat, @Name = N'Admin hizmeti', @Price = 99, @DurationMinutes = 15;
INSERT #r VALUES (N'Admin her dükkâna hizmet ekleyebilir', CASE WHEN EXISTS (SELECT 1 FROM data.ShopServices WHERE ShopId = @shop AND Name = N'Admin hizmeti') THEN 1 ELSE 0 END, NULL);
DECLARE @adminSvcId uniqueidentifier = (SELECT Id FROM data.ShopServices WHERE ShopId = @shop AND Name = N'Admin hizmeti');
EXEC api.ShopService_Delete @admin, @adminSvcId;
BEGIN TRY EXEC api.Staff_SetBreaks @admin, @staff, N'[{"weekday":null,"start":"12:00","end":"12:30"}]'; INSERT #r VALUES (N'Admin personel molası girebilir', 1, NULL); END TRY
BEGIN CATCH INSERT #r VALUES (N'Admin personel molası girebilir', 0, ERROR_MESSAGE()); END CATCH
EXEC api.Staff_SetBreaks @admin, @staff, N'[]';
BEGIN TRY EXEC api.Queue_ListForShop @admin, @shop; INSERT #r VALUES (N'Admin dükkânın sırasını görebilir', 1, NULL); END TRY
BEGIN CATCH INSERT #r VALUES (N'Admin dükkânın sırasını görebilir', 0, ERROR_MESSAGE()); END CATCH
BEGIN TRY EXEC api.Staff_SetBreaks @cust, @staff, N'[]'; INSERT #r VALUES (N'Müşteri personel molası giremez', 0, NULL); END TRY
BEGIN CATCH INSERT #r VALUES (N'Müşteri personel molası giremez', CASE WHEN ERROR_NUMBER() = 50403 THEN 1 ELSE 0 END, ERROR_MESSAGE()); END CATCH

-- Admin haritası ve hızlı kontrol
DECLARE @mapPts TABLE (Id uniqueidentifier, Code varchar(12), Segment varchar(5), Name nvarchar(100), Status varchar(10), IsClaimed bit, NeedsReview bit,
  Latitude decimal(9, 6), Longitude decimal(9, 6), District nvarchar(60));
INSERT @mapPts EXEC api.Admin_Shop_MapPoints @admin;
INSERT #r VALUES (N'Admin haritası tüm dükkânları getirir', CASE WHEN (SELECT COUNT(*) FROM @mapPts) = (SELECT COUNT(*) FROM data.Shops) THEN 1 ELSE 0 END, NULL);
UPDATE data.Shops SET NeedsReview = 1 WHERE Id = @shop;
DECLARE @nextRev TABLE (Id uniqueidentifier, Code varchar(12), Segment varchar(5), Name nvarchar(100), Status varchar(10), Phone varchar(16), Street nvarchar(120),
  BuildingNo nvarchar(20), Source varchar(10), ExternalRef varchar(40), Neighborhood nvarchar(200), District nvarchar(60), Province nvarchar(40),
  Latitude decimal(9, 6), Longitude decimal(9, 6), Remaining int);
INSERT @nextRev EXEC api.Admin_Shop_NextReview @admin;
DECLARE @skipList nvarchar(max) = (SELECT STRING_AGG(CONVERT(nvarchar(36), Id), N',') FROM data.Shops WHERE NeedsReview = 1 AND Id <> @shop);
DELETE @nextRev; INSERT @nextRev EXEC api.Admin_Shop_NextReview @admin, @skipList;
INSERT #r VALUES (N'Hızlı kontrol sıradaki dükkânı getirir, atlananları geçer', CASE WHEN (SELECT Id FROM @nextRev) = @shop THEN 1 ELSE 0 END, NULL);
UPDATE data.Shops SET NeedsReview = 0 WHERE Id = @shop;
BEGIN TRY EXEC api.Admin_Shop_MapPoints @cust; INSERT #r VALUES (N'Müşteri admin haritasını göremez', 0, NULL); END TRY
BEGIN CATCH INSERT #r VALUES (N'Müşteri admin haritasını göremez', CASE WHEN ERROR_NUMBER() = 50403 THEN 1 ELSE 0 END, ERROR_MESSAGE()); END CATCH

-- Admin yönetimi: dükkânı aktif yap (randevu/sıra açılır), sahibi gelince sahiplenebilir
DECLARE @mng TABLE (Id uniqueidentifier, Code varchar(12));
INSERT @mng EXEC api.Admin_Shop_Create @admin, 'erkek', N'Admin Yönetimli Berber', NULL, N'0312 555 44 33', 34, @kadikoy, @caferaga, N'Moda Caddesi', N'5', NULL, 40.9885, 29.0275;
DECLARE @mngShop uniqueidentifier = (SELECT Id FROM @mng);
DECLARE @mngCat int = (SELECT TOP (1) Id FROM data.ServiceCategories WHERE Segment = 'erkek' ORDER BY Id);
DECLARE @tmp TABLE (Id uniqueidentifier);
INSERT @tmp EXEC api.ShopService_Save @ActorId = @admin, @ShopId = @mngShop, @CategoryId = @mngCat, @Name = N'Saç kesimi', @Price = 300, @DurationMinutes = 30;
DELETE @tmp; INSERT @tmp EXEC api.Staff_Save @ActorId = @admin, @ShopId = @mngShop, @DisplayName = N'Usta';
EXEC api.ShopHours_Set @admin, @mngShop, N'[{"weekday":1,"isClosed":false,"opensAt":"09:00","closesAt":"20:00"},{"weekday":2,"isClosed":false,"opensAt":"09:00","closesAt":"20:00"},{"weekday":3,"isClosed":false,"opensAt":"09:00","closesAt":"20:00"},{"weekday":4,"isClosed":false,"opensAt":"09:00","closesAt":"20:00"},{"weekday":5,"isClosed":false,"opensAt":"09:00","closesAt":"20:00"},{"weekday":6,"isClosed":false,"opensAt":"09:00","closesAt":"20:00"},{"weekday":7,"isClosed":true,"opensAt":"09:00","closesAt":"20:00"}]';
EXEC api.Admin_Shop_SetActive @admin, @mngShop, 1;
INSERT #r VALUES (N'Admin dükkânı aktif yapınca randevu ve sıra açılır', CASE WHEN EXISTS (SELECT 1 FROM data.Shops WHERE Id = @mngShop AND IsClaimed = 1 AND OwnerId = @admin) THEN 1 ELSE 0 END, NULL);
INSERT #id EXEC api.Claim_Create @owner, @mngShop, N'05551112234', N'Bu benim dükkânım';
DECLARE @mngClaim uniqueidentifier = (SELECT Id FROM #id); DELETE #id;
EXEC api.Admin_Claim_Resolve @admin, @mngClaim, 1, N'Doğrulandı';
INSERT #r VALUES (N'Admin yönettiği dükkânı gerçek sahibine devredebilir (sahiplenme)', CASE WHEN EXISTS (SELECT 1 FROM data.Shops WHERE Id = @mngShop AND OwnerId = @owner AND IsClaimed = 1) THEN 1 ELSE 0 END, NULL);
BEGIN TRY EXEC api.Admin_Shop_SetActive @admin, @mngShop, 0; INSERT #r VALUES (N'Sahibi olan dükkânı admin pasif yapamaz', 0, NULL); END TRY
BEGIN CATCH IF XACT_STATE() <> 0 ROLLBACK; INSERT #r VALUES (N'Sahibi olan dükkânı admin pasif yapamaz', CASE WHEN ERROR_NUMBER() = 50409 THEN 1 ELSE 0 END, ERROR_MESSAGE()); END CATCH

-- Katılmamış dükkâna randevu / sıra talebi (admin ayarlar)
DECLARE @rqShopT TABLE (Id uniqueidentifier, Code varchar(12));
INSERT @rqShopT EXEC api.Admin_Shop_Create @admin, 'kadin', N'Talep Kuaför', NULL, NULL, 34, @kadikoy, @caferaga, N'Moda Caddesi', NULL, NULL, 40.9890, 29.0280;
DECLARE @rqShop uniqueidentifier = (SELECT Id FROM @rqShopT);
DECLARE @rqWhen datetime2(0) = DATEADD(hour, 14, CAST(CAST(DATEADD(day, 1, data.fn_IstanbulNow()) AS date) AS datetime2(0)));
DECLARE @rqCat int = (SELECT TOP (1) Id FROM data.ServiceCategories WHERE Segment = 'kadin' ORDER BY Id);
INSERT #id EXEC api.Request_Create @cust, @rqShop, 'randevu', @rqCat, @rqWhen, N'Saç kesimi istiyorum';
DECLARE @rq uniqueidentifier = (SELECT Id FROM #id); DELETE #id;
INSERT #r VALUES (N'Katılmamış dükkâna randevu talebi bırakılır', CASE WHEN @rq IS NOT NULL THEN 1 ELSE 0 END, NULL);
BEGIN TRY EXEC api.Request_Create @cust, @rqShop, 'sira', NULL, @rqWhen; INSERT #r VALUES (N'Aynı dükkâna ikinci açık talep bırakılamaz', 0, NULL); END TRY
BEGIN CATCH INSERT #r VALUES (N'Aynı dükkâna ikinci açık talep bırakılamaz', CASE WHEN ERROR_NUMBER() = 50409 THEN 1 ELSE 0 END, ERROR_MESSAGE()); END CATCH
DECLARE @rqPast datetime2(0) = DATEADD(day, -1, data.fn_IstanbulNow());
BEGIN TRY EXEC api.Request_Create @cust3, @rqShop, 'randevu', NULL, @rqPast; INSERT #r VALUES (N'Geçmiş saate talep bırakılamaz', 0, NULL); END TRY
BEGIN CATCH INSERT #r VALUES (N'Geçmiş saate talep bırakılamaz', CASE WHEN ERROR_NUMBER() = 50400 THEN 1 ELSE 0 END, ERROR_MESSAGE()); END CATCH
BEGIN TRY EXEC api.Request_Create @cust3, @shop, 'randevu', NULL, @rqWhen; INSERT #r VALUES (N'Bermatik''teki dükkâna talep değil gerçek randevu alınır', 0, NULL); END TRY
BEGIN CATCH INSERT #r VALUES (N'Bermatik''teki dükkâna talep değil gerçek randevu alınır', CASE WHEN ERROR_NUMBER() = 50409 THEN 1 ELSE 0 END, ERROR_MESSAGE()); END CATCH
DECLARE @rqWhen2 datetime2(0) = DATEADD(minute, 30, @rqWhen);
EXEC api.Admin_Request_Resolve @admin, @rq, 'confirmed', @rqWhen2, NULL;
INSERT #r VALUES (N'Admin talebi onaylayınca müşteriye bildirim gider',
  CASE WHEN EXISTS (SELECT 1 FROM data.Notifications WHERE UserId = @cust AND Title = N'Randevunuz ayarlandı')
        AND EXISTS (SELECT 1 FROM data.BookingRequests WHERE Id = @rq AND Status = 'confirmed' AND ConfirmedAtLocal = @rqWhen2) THEN 1 ELSE 0 END, NULL);
EXEC api.Request_Cancel @cust, @rq;
BEGIN TRY EXEC api.Request_Cancel @cust3, @rq; INSERT #r VALUES (N'Başkasının talebi iptal edilemez', 0, NULL); END TRY
BEGIN CATCH INSERT #r VALUES (N'Başkasının talebi iptal edilemez', CASE WHEN ERROR_NUMBER() = 50404 THEN 1 ELSE 0 END, ERROR_MESSAGE()); END CATCH
INSERT #r VALUES (N'Müşteri talebini iptal edebilir', CASE WHEN EXISTS (SELECT 1 FROM data.BookingRequests WHERE Id = @rq AND Status = 'cancelled') THEN 1 ELSE 0 END, NULL);

-- Admin kategori listesi (pasifler dahil)
DECLARE @cats TABLE (Id int, Segment varchar(5), Slug varchar(40), Name nvarchar(60), Description nvarchar(1000), SortOrder int, IsActive bit, RevisitDays smallint, UsageCount int);
INSERT @cats EXEC api.Admin_ServiceCategory_List @admin;
INSERT #r VALUES (N'Admin tüm hizmet kategorilerini görür', CASE WHEN (SELECT COUNT(*) FROM @cats) = (SELECT COUNT(*) FROM data.ServiceCategories) AND (SELECT COUNT(*) FROM @cats) > 0 THEN 1 ELSE 0 END, NULL);
BEGIN TRY EXEC api.Admin_ServiceCategory_List @cust; INSERT #r VALUES (N'Müşteri kategori yönetimini göremez', 0, NULL); END TRY
BEGIN CATCH INSERT #r VALUES (N'Müşteri kategori yönetimini göremez', CASE WHEN ERROR_NUMBER() = 50403 THEN 1 ELSE 0 END, ERROR_MESSAGE()); END CATCH

-- Fotoğraflar: kapak ve personel
DECLARE @oldPath TABLE (OldPath nvarchar(300));
INSERT @oldPath EXEC api.Shop_SetCover @owner, @shop, N'foto/kapak1.webp';
DELETE @oldPath; INSERT @oldPath EXEC api.Shop_SetCover @owner, @shop, N'foto/kapak2.webp';
INSERT #r VALUES (N'Kapak değişince eski fotoğrafın yolu döner (diskten silinsin)',
  CASE WHEN (SELECT OldPath FROM @oldPath) = N'foto/kapak1.webp' AND (SELECT CoverImagePath FROM data.Shops WHERE Id = @shop) = N'foto/kapak2.webp' THEN 1 ELSE 0 END, NULL);
BEGIN TRY EXEC api.Shop_SetCover @cust, @shop, N'foto/x.webp'; INSERT #r VALUES (N'Müşteri dükkân kapağını değiştiremez', 0, NULL); END TRY
BEGIN CATCH IF XACT_STATE() <> 0 ROLLBACK; INSERT #r VALUES (N'Müşteri dükkân kapağını değiştiremez', CASE WHEN ERROR_NUMBER() = 50403 THEN 1 ELSE 0 END, ERROR_MESSAGE()); END CATCH
DELETE @oldPath; INSERT @oldPath EXEC api.Staff_SetPhoto @worker, @staff, N'foto/mehmet.webp';
INSERT #r VALUES (N'Personel kendi fotoğrafını yükleyebilir', CASE WHEN (SELECT PhotoPath FROM data.Staff WHERE Id = @staff) = N'foto/mehmet.webp' THEN 1 ELSE 0 END, NULL);
DELETE #id; INSERT #id EXEC api.Staff_Save @owner, @shop, @staff, N'Mehmet', N'Usta'; DELETE #id;
INSERT #r VALUES (N'Personel bilgisi kaydedilince fotoğrafı silinmez', CASE WHEN (SELECT PhotoPath FROM data.Staff WHERE Id = @staff) = N'foto/mehmet.webp' THEN 1 ELSE 0 END, NULL);
BEGIN TRY EXEC api.Staff_SetPhoto @cust, @staff, NULL; INSERT #r VALUES (N'Müşteri personel fotoğrafını silemez', 0, NULL); END TRY
BEGIN CATCH IF XACT_STATE() <> 0 ROLLBACK; INSERT #r VALUES (N'Müşteri personel fotoğrafını silemez', CASE WHEN ERROR_NUMBER() = 50403 THEN 1 ELSE 0 END, ERROR_MESSAGE()); END CATCH
-- Personel rozeti: kendi belgesi onaylanınca adının yanında rozet
DELETE #id; INSERT #id EXEC api.Certificate_Add @worker, 'kalfalik', N'KF-778899', NULL, N'ustalik/x.jpg';
DECLARE @wCert uniqueidentifier = (SELECT Id FROM #id); DELETE #id;
EXEC api.Admin_Certificate_Review @admin, @wCert, 'verified';
DELETE @staffList; INSERT @staffList EXEC api.Staff_List @shop, NULL;
INSERT #r VALUES (N'Belgesi onaylanan personelin rozeti görünür', CASE WHEN (SELECT IsCertified FROM @staffList WHERE Id = @staff) = 1 THEN 1 ELSE 0 END, NULL);
DELETE #id; INSERT #id EXEC api.Gallery_Add @admin, @shop, N'foto/admin.webp', N'Admin ekledi';
INSERT #r VALUES (N'Admin galeriye fotoğraf ekleyebilir', CASE WHEN EXISTS (SELECT 1 FROM #id) THEN 1 ELSE 0 END, NULL); DELETE #id;


-- Güvenlik: kalıcı deneme sınırı ve yeni cihaz uyarısı
DECLARE @rl TABLE (Allowed bit);
INSERT @rl EXEC api.RateLimit_Hit 'test:1.2.3.4', 2, 60;
INSERT @rl EXEC api.RateLimit_Hit 'test:1.2.3.4', 2, 60;
INSERT @rl EXEC api.RateLimit_Hit 'test:1.2.3.4', 2, 60;
INSERT #r VALUES (N'Deneme sınırı: 2 deneme serbest, 3. engellenir', CASE WHEN (SELECT COUNT(*) FROM @rl WHERE Allowed = 1) = 2 AND (SELECT COUNT(*) FROM @rl WHERE Allowed = 0) = 1 THEN 1 ELSE 0 END, NULL);
INSERT @rl EXEC api.RateLimit_Hit 'test:5.6.7.8', 2, 60;
INSERT #r VALUES (N'Deneme sınırı başka adresi etkilemez', CASE WHEN (SELECT COUNT(*) FROM @rl WHERE Allowed = 1) = 3 THEN 1 ELSE 0 END, NULL);
DECLARE @dev TABLE (IsNew bit, Alerted bit, Email nvarchar(254), FirstName nvarchar(60));
INSERT @dev EXEC api.Auth_SeenDevice @cust3, 0x01, N'Test', N'Chrome, Windows';
INSERT #r VALUES (N'İlk cihaz uyarı vermez', CASE WHEN (SELECT Alerted FROM @dev) = 0 AND (SELECT IsNew FROM @dev) = 1 THEN 1 ELSE 0 END, NULL);
DELETE @dev; INSERT @dev EXEC api.Auth_SeenDevice @cust3, 0x01, N'Test', N'Chrome, Windows';
INSERT #r VALUES (N'Tanıdık cihaz uyarı vermez', CASE WHEN (SELECT IsNew FROM @dev) = 0 AND (SELECT Alerted FROM @dev) = 0 THEN 1 ELSE 0 END, NULL);
DELETE @dev; INSERT @dev EXEC api.Auth_SeenDevice @cust3, 0x02, N'Test', N'Safari, iPhone';
INSERT #r VALUES (N'Yeni cihazdan girişte güvenlik bildirimi gider',
  CASE WHEN (SELECT Alerted FROM @dev) = 1 AND EXISTS (SELECT 1 FROM data.Notifications WHERE UserId = @cust3 AND Kind = 'security' AND Body LIKE N'%Safari, iPhone%') THEN 1 ELSE 0 END, NULL);


-- Ticari ileti onayı (İYS'ye hazırlık)
DECLARE @cons TABLE (Enabled bit, Email bit, Sms bit);
BEGIN TRY EXEC api.Consent_Set @cust3, 1, 0; INSERT #r VALUES (N'Özellik kapalıyken ticari ileti onayı alınmaz', 0, NULL); END TRY
BEGIN CATCH IF XACT_STATE() <> 0 ROLLBACK; INSERT #r VALUES (N'Özellik kapalıyken ticari ileti onayı alınmaz', CASE WHEN ERROR_NUMBER() = 50409 THEN 1 ELSE 0 END, ERROR_MESSAGE()); END CATCH
EXEC api.Admin_Settings_Update @admin, @CommercialConsentEnabled = 1;
EXEC api.Consent_Set @cust3, 1, 0;
EXEC api.Consent_Set @cust3, 1, 0;
INSERT @cons EXEC api.Consent_Get @cust3;
INSERT #r VALUES (N'E-posta onayı kaydedilir, aynı durum tekrar yazılmaz, SMS reddi boşuna yazılmaz',
  CASE WHEN (SELECT Email FROM @cons) = 1 AND (SELECT Sms FROM @cons) = 0
        AND (SELECT COUNT(*) FROM data.CommercialConsents WHERE UserId = @cust3) = 1
        AND (SELECT Recipient FROM data.CommercialConsents WHERE UserId = @cust3) = N'cust3@test.com' THEN 1 ELSE 0 END,
  (SELECT CONCAT(COUNT(*), '|', MAX(Recipient)) FROM data.CommercialConsents WHERE UserId = @cust3));
EXEC api.Admin_Settings_Update @admin, @CommercialConsentEnabled = 0;
EXEC api.Consent_Set @cust3, 1, 0;
INSERT #r VALUES (N'Özellik kapanınca mevcut onay formu hata vermeden kaydedilir', 1, NULL);
EXEC api.Consent_Unsubscribe @cust3, 'EPOSTA';
DELETE @cons; INSERT @cons EXEC api.Consent_Get @cust3;
INSERT #r VALUES (N'İletiden çık bağlantısı ret kaydı yazar (özellik kapalıyken de)',
  CASE WHEN (SELECT Email FROM @cons) = 0 AND EXISTS (SELECT 1 FROM data.CommercialConsents WHERE UserId = @cust3 AND Status = 'RET' AND Source = 'HS_ILETI_RET') THEN 1 ELSE 0 END, NULL);
EXEC api.Admin_Settings_Update @admin, @CommercialConsentEnabled = 1;
EXEC api.Consent_Set @cust3, 1, 1;
EXEC api.Admin_Settings_Update @admin, @CommercialConsentEnabled = 0;
EXEC api.User_DeleteAccount @cust3;
INSERT #r VALUES (N'Hesap silinince iki kanal için de ret kaydı yazılır',
  CASE WHEN (SELECT COUNT(*) FROM data.CommercialConsents WHERE UserId = @cust3 AND Source = 'HS_HESAP_SIL' AND Status = 'RET') = 2 THEN 1 ELSE 0 END,
  (SELECT CAST(COUNT(*) AS nvarchar) FROM data.CommercialConsents WHERE UserId = @cust3 AND Source = 'HS_HESAP_SIL'));

-- Dükkân kodu 9999'u geçince 5 haneye çıkar (eskiden tıkanıyordu)
INSERT #r VALUES (N'Dükkân kodu 10.000. dükkânda da üretilir', CASE WHEN data.fn_ShopCode('erkek', 7) = 'BRM-E-0007' AND data.fn_ShopCode('kadin', 12345) = 'BRM-K-12345' AND LEN(data.fn_ShopCode('erkek', 999999)) <= 12 THEN 1 ELSE 0 END, NULL);

-- =====================================================================
SELECT CONCAT(CASE WHEN Ok = 1 THEN N'  ✓ ' ELSE N'  ✗ ' END, Name, CASE WHEN Ok = 0 THEN N'  →  ' + ISNULL(Info, N'') ELSE N'' END) FROM #r ORDER BY No;
SELECT CONCAT(N'Sonuç: ', SUM(CAST(Ok AS int)), N' başarılı, ', SUM(1 - CAST(Ok AS int)), N' başarısız') FROM #r;
IF EXISTS (SELECT 1 FROM #r WHERE Ok = 0) THROW 50000, N'Başarısız test var.', 1;
