-- =====================================================================
-- Bermatik — Admin dükkân yönetimi ve OpenStreetMap içe aktarma
-- =====================================================================

-- Admin dükkân ekler ("henüz katılmadı" olarak, doğrudan yayında)
CREATE OR ALTER PROCEDURE api.Admin_Shop_Create
  @ActorId uniqueidentifier, @Segment varchar(5), @Name nvarchar(100), @Description nvarchar(2000) = NULL,
  @Phone nvarchar(40) = NULL, @ProvinceId tinyint, @DistrictId int, @NeighborhoodId int,
  @Street nvarchar(120), @BuildingNo nvarchar(20) = NULL, @AddressDetail nvarchar(200) = NULL,
  @Latitude decimal(9, 6), @Longitude decimal(9, 6)
AS
BEGIN
  SET NOCOUNT ON; SET XACT_ABORT ON;
  EXEC data.usp_RequireAdmin @ActorId;
  DECLARE @NormPhone varchar(16) = data.fn_NormalizePhone(@Phone);
  IF NULLIF(LTRIM(RTRIM(@Phone)), N'') IS NOT NULL AND @NormPhone IS NULL THROW 50400, N'Telefon numarası geçersiz.', 1;
  IF @Segment NOT IN ('erkek', 'kadin') THROW 50400, N'Bölüm geçersiz.', 1;
  IF NOT EXISTS (SELECT 1 FROM data.Neighborhoods n JOIN data.Districts d ON d.Id = n.DistrictId
                 WHERE n.Id = @NeighborhoodId AND d.Id = @DistrictId AND d.ProvinceId = @ProvinceId)
    THROW 50400, N'İl, ilçe ve mahalle birbiriyle uyuşmuyor.', 1;

  DECLARE @Seq int, @Code varchar(12);
  DECLARE @Out TABLE (Id uniqueidentifier);
  IF @Segment = 'erkek' SET @Seq = NEXT VALUE FOR data.ShopCodeErkek; ELSE SET @Seq = NEXT VALUE FOR data.ShopCodeKadin;
  SET @Code = data.fn_ShopCode(@Segment, @Seq);

  BEGIN TRAN;
    INSERT INTO data.Shops (Code, OwnerId, Segment, Name, Slug, Description, Phone, ProvinceId, DistrictId, NeighborhoodId,
                            Street, BuildingNo, AddressDetail, Latitude, Longitude, Status, Source, IsClaimed, UpdatedBy)
    OUTPUT inserted.Id INTO @Out
    VALUES (@Code, @ActorId, @Segment, LTRIM(RTRIM(@Name)), data.fn_UniqueShopSlug(@DistrictId, @Name, NULL),
            @Description, @NormPhone, @ProvinceId, @DistrictId, @NeighborhoodId, LTRIM(RTRIM(@Street)),
            ISNULL(NULLIF(LTRIM(RTRIM(@BuildingNo)), N''), N'-'), @AddressDetail, @Latitude, @Longitude,
            'approved', 'admin', 0, @ActorId);
    DECLARE @Id uniqueidentifier = (SELECT Id FROM @Out);
    DECLARE @EntityId nvarchar(64) = CONVERT(nvarchar(64), @Id);
    DECLARE @Details nvarchar(max) = (SELECT @Name AS name, @Code AS code FOR JSON PATH, WITHOUT_ARRAY_WRAPPER);
    EXEC data.usp_Log @ActorId, 'shop_create', 'shops', @EntityId, @Details;
  COMMIT;
  SELECT @Id AS Id, @Code AS Code;
END
GO

-- Dükkânı sil. Randevu/sipariş/yorum geçmişi varsa silinmez, "askıya alındı" yapılır.
CREATE OR ALTER PROCEDURE api.Admin_Shop_Delete @ActorId uniqueidentifier, @ShopId uniqueidentifier
AS
BEGIN
  SET NOCOUNT ON; SET XACT_ABORT ON;
  EXEC data.usp_RequireAdmin @ActorId;
  DECLARE @Name nvarchar(100) = (SELECT Name FROM data.Shops WHERE Id = @ShopId);
  IF @Name IS NULL THROW 50404, N'Dükkân bulunamadı.', 1;
  DECLARE @EntityId nvarchar(64) = CONVERT(nvarchar(64), @ShopId), @Details nvarchar(max), @Result varchar(10);

  BEGIN TRAN;
    IF EXISTS (SELECT 1 FROM data.Appointments WHERE ShopId = @ShopId)
       OR EXISTS (SELECT 1 FROM data.Orders WHERE ShopId = @ShopId)
       OR EXISTS (SELECT 1 FROM data.Reviews WHERE ShopId = @ShopId)
    BEGIN
      UPDATE data.Shops SET Status = 'suspended', StatusReason = N'Admin tarafından kaldırıldı', UpdatedBy = @ActorId,
                            UpdatedAt = SYSUTCDATETIME() WHERE Id = @ShopId;
      SET @Result = 'suspended';
    END
    ELSE
    BEGIN
      DELETE FROM data.Favorites WHERE ShopId = @ShopId;
      DELETE FROM data.ShopGallery WHERE ShopId = @ShopId;
      DELETE FROM data.ShopClosures WHERE ShopId = @ShopId;
      DELETE FROM data.Notifications WHERE CampaignId IN (SELECT Id FROM data.Campaigns WHERE ShopId = @ShopId);
      DELETE FROM data.Campaigns WHERE ShopId = @ShopId;
      DELETE FROM data.QueueEntries WHERE ShopId = @ShopId;
      DELETE FROM data.StaffServiceDurations WHERE StaffId IN (SELECT Id FROM data.Staff WHERE ShopId = @ShopId);
      DELETE FROM data.StaffBreaks WHERE StaffId IN (SELECT Id FROM data.Staff WHERE ShopId = @ShopId);
      DELETE FROM data.StaffDaysOff WHERE StaffId IN (SELECT Id FROM data.Staff WHERE ShopId = @ShopId);
      DELETE FROM data.Staff WHERE ShopId = @ShopId;
      DELETE FROM data.ShopServices WHERE ShopId = @ShopId;
      DELETE FROM data.Products WHERE ShopId = @ShopId;
      DELETE FROM data.Shops WHERE Id = @ShopId;   -- çalışma saatleri ve sıra özeti kendiliğinden silinir
      SET @Result = 'deleted';
    END
    SET @Details = (SELECT @Name AS name, @Result AS result FOR JSON PATH, WITHOUT_ARRAY_WRAPPER);
    EXEC data.usp_Log @ActorId, 'shop_delete', 'shops', @EntityId, @Details;
  COMMIT;
  SELECT @Result AS Result;   -- 'deleted' veya 'suspended'
END
GO

-- Katılmamış dükkânı bir kullanıcıya devret (dükkân sahibi katıldığında)
CREATE OR ALTER PROCEDURE api.Admin_Shop_AssignOwner @ActorId uniqueidentifier, @ShopId uniqueidentifier, @OwnerEmail nvarchar(254)
AS
BEGIN
  SET NOCOUNT ON; SET XACT_ABORT ON;
  EXEC data.usp_RequireAdmin @ActorId;
  DECLARE @OwnerId uniqueidentifier = (SELECT Id FROM data.Users
                                       WHERE Email = LOWER(LTRIM(RTRIM(@OwnerEmail)) COLLATE Latin1_General_CI_AS) AND IsActive = 1);
  IF @OwnerId IS NULL THROW 50404, N'Bu e-postayla kayıtlı kullanıcı bulunamadı. Önce siteye kayıt olmalı.', 1;
  IF NOT EXISTS (SELECT 1 FROM data.Shops WHERE Id = @ShopId) THROW 50404, N'Dükkân bulunamadı.', 1;
  BEGIN TRAN;
    UPDATE data.Shops SET OwnerId = @OwnerId, IsClaimed = 1, UpdatedBy = @ActorId, UpdatedAt = SYSUTCDATETIME() WHERE Id = @ShopId;
    UPDATE data.Users SET Role = 'shop_owner', UpdatedAt = SYSUTCDATETIME() WHERE Id = @OwnerId AND Role IN ('customer', 'staff');
    DECLARE @EntityId nvarchar(64) = CONVERT(nvarchar(64), @ShopId);
    DECLARE @Details nvarchar(max) = (SELECT @OwnerEmail AS owner FOR JSON PATH, WITHOUT_ARRAY_WRAPPER);
    EXEC data.usp_Log @ActorId, 'shop_owner', 'shops', @EntityId, @Details;
  COMMIT;
END
GO

-- ---------------------------------------------------------------------
-- OpenStreetMap içe aktarma (scripts/import-osm.mjs çalıştırır; site çağıramaz)
-- Aynı OSM kaydı tekrar gelirse: dükkân hâlâ katılmamışsa ve admin düzenlemediyse güncellenir.
-- ---------------------------------------------------------------------
CREATE OR ALTER PROCEDURE data.usp_ImportOsmShop
  @ExternalRef varchar(60), @Segment varchar(5), @Name nvarchar(100), @Phone nvarchar(40),
  @ProvinceId tinyint, @DistrictId int, @NeighborhoodId int, @Street nvarchar(120), @BuildingNo nvarchar(20),
  @Latitude decimal(9, 6), @Longitude decimal(9, 6), @NeedsReview bit, @Source varchar(8) = 'osm'   -- osm | overture
AS
BEGIN
  SET NOCOUNT ON; SET XACT_ABORT ON;
  DECLARE @NormPhone varchar(16) = data.fn_NormalizePhone(@Phone);
  SET @Street = ISNULL(NULLIF(LTRIM(RTRIM(@Street)), N''), N'Adres bilinmiyor');
  SET @BuildingNo = ISNULL(NULLIF(LTRIM(RTRIM(@BuildingNo)), N''), N'-');

  IF EXISTS (SELECT 1 FROM data.Shops WHERE ExternalRef = @ExternalRef)
  BEGIN
    UPDATE data.Shops
    SET Name = @Name, Phone = ISNULL(@NormPhone, Phone), Latitude = @Latitude, Longitude = @Longitude, UpdatedAt = SYSUTCDATETIME()
    WHERE ExternalRef = @ExternalRef AND IsClaimed = 0 AND UpdatedBy IS NULL;
    SELECT 'updated' AS Result;
    RETURN;
  END

  DECLARE @Seq int, @Code varchar(12);
  IF @Segment = 'erkek' SET @Seq = NEXT VALUE FOR data.ShopCodeErkek; ELSE SET @Seq = NEXT VALUE FOR data.ShopCodeKadin;
  SET @Code = data.fn_ShopCode(@Segment, @Seq);
  INSERT INTO data.Shops (Code, OwnerId, Segment, Name, Slug, Phone, ProvinceId, DistrictId, NeighborhoodId, Street, BuildingNo,
                          Latitude, Longitude, Status, Source, ExternalRef, IsClaimed, NeedsReview)
  VALUES (@Code, data.fn_SystemUserId(), @Segment, @Name, data.fn_UniqueShopSlug(@DistrictId, @Name, NULL), @NormPhone,
          @ProvinceId, @DistrictId, @NeighborhoodId, @Street, @BuildingNo, @Latitude, @Longitude,
          'approved', @Source, @ExternalRef, 0, @NeedsReview);
  SELECT 'inserted' AS Result;
END
GO

-- Erkek ↔ kadın bölümünü düzelt (OpenStreetMap tahmini yanlışsa). Hizmet eklenmiş dükkânda değiştirilemez.
CREATE OR ALTER PROCEDURE api.Admin_Shop_SetSegment @ActorId uniqueidentifier, @ShopId uniqueidentifier, @Segment varchar(5)
AS
BEGIN
  SET NOCOUNT ON; SET XACT_ABORT ON;
  EXEC data.usp_RequireAdmin @ActorId;
  IF @Segment NOT IN ('erkek', 'kadin') THROW 50400, N'Bölüm geçersiz.', 1;
  IF EXISTS (SELECT 1 FROM data.ShopServices WHERE ShopId = @ShopId)
    THROW 50409, N'Bu dükkânın hizmetleri var; bölümü değiştirmeden önce hizmetleri silin.', 1;
  BEGIN TRAN;
    UPDATE data.Shops SET Segment = @Segment, NeedsReview = 0, UpdatedBy = @ActorId, UpdatedAt = SYSUTCDATETIME() WHERE Id = @ShopId;
    IF @@ROWCOUNT = 0 THROW 50404, N'Dükkân bulunamadı.', 1;
    DECLARE @EntityId nvarchar(64) = CONVERT(nvarchar(64), @ShopId);
    DECLARE @Details nvarchar(max) = (SELECT @Segment AS segment FOR JSON PATH, WITHOUT_ARRAY_WRAPPER);
    EXEC data.usp_Log @ActorId, 'shop_segment', 'shops', @EntityId, @Details;
  COMMIT;
END
GO

-- Kontrol edildi olarak işaretle (bilgiler doğruysa)
CREATE OR ALTER PROCEDURE api.Admin_Shop_MarkReviewed @ActorId uniqueidentifier, @ShopId uniqueidentifier
AS
BEGIN
  SET NOCOUNT ON;
  EXEC data.usp_RequireAdmin @ActorId;
  UPDATE data.Shops SET NeedsReview = 0, UpdatedBy = @ActorId, UpdatedAt = SYSUTCDATETIME() WHERE Id = @ShopId;
END
GO

-- ---------------------------------------------------------------------
-- Admin haritası: tüm dükkânlar (silinmemiş), konum ve durumuyla
-- ---------------------------------------------------------------------
CREATE OR ALTER PROCEDURE api.Admin_Shop_MapPoints @ActorId uniqueidentifier, @Segment varchar(5) = NULL
AS
BEGIN
  SET NOCOUNT ON;
  EXEC data.usp_RequireAdmin @ActorId;
  SELECT s.Id, s.Code, s.Segment, s.Name, s.Status, s.IsClaimed, s.NeedsReview, s.Latitude, s.Longitude, d.Name AS District
  FROM data.Shops s JOIN data.Districts d ON d.Id = s.DistrictId
  WHERE (@Segment IS NULL OR s.Segment = @Segment);
END
GO

-- ---------------------------------------------------------------------
-- Hızlı kontrol: kontrol bekleyen sıradaki dükkân (atlananlar hariç) ve kalan sayı
--   @SkipIds: virgülle ayrılmış, bu oturumda "sonra bakarım" denen dükkânlar
-- ---------------------------------------------------------------------
CREATE OR ALTER PROCEDURE api.Admin_Shop_NextReview @ActorId uniqueidentifier, @SkipIds nvarchar(max) = NULL
AS
BEGIN
  SET NOCOUNT ON;
  EXEC data.usp_RequireAdmin @ActorId;
  DECLARE @Skip TABLE (Id uniqueidentifier PRIMARY KEY);
  INSERT INTO @Skip SELECT DISTINCT TRY_CAST(value AS uniqueidentifier) FROM STRING_SPLIT(ISNULL(@SkipIds, N''), N',')
  WHERE TRY_CAST(value AS uniqueidentifier) IS NOT NULL;
  SELECT TOP (1) s.Id, s.Code, s.Segment, s.Name, s.Status, s.Phone, s.Street, s.BuildingNo, s.Source, s.ExternalRef,
         n.Name AS Neighborhood, d.Name AS District, p.Name AS Province, s.Latitude, s.Longitude,
         (SELECT COUNT(*) FROM data.Shops WHERE NeedsReview = 1) AS Remaining
  FROM data.Shops s
  JOIN data.Provinces p ON p.Id = s.ProvinceId JOIN data.Districts d ON d.Id = s.DistrictId JOIN data.Neighborhoods n ON n.Id = s.NeighborhoodId
  WHERE s.NeedsReview = 1 AND s.Id NOT IN (SELECT Id FROM @Skip)
  ORDER BY s.CreatedAt, s.Id;
END
GO

-- ---------------------------------------------------------------------
-- Admin yönetimi: katılmamış dükkânı "Aktif yap" → admin sahibi olur, randevu ve sıra açılır.
--   Telefon, en az bir hizmet, bir personel ve çalışma saati girilmiş olmalı.
--   Pasif yap → randevu/sıra kapanır, dükkân admin panelinde kalır.
-- ---------------------------------------------------------------------
CREATE OR ALTER PROCEDURE api.Admin_Shop_SetActive @ActorId uniqueidentifier, @ShopId uniqueidentifier, @Active bit
AS
BEGIN
  SET NOCOUNT ON; SET XACT_ABORT ON;
  EXEC data.usp_RequireAdmin @ActorId;
  DECLARE @Owner uniqueidentifier, @Claimed bit, @Phone varchar(16), @Status varchar(10);
  SELECT @Owner = OwnerId, @Claimed = IsClaimed, @Phone = Phone, @Status = Status FROM data.Shops WHERE Id = @ShopId;
  IF @Owner IS NULL THROW 50404, N'Dükkân bulunamadı.', 1;
  IF @Claimed = 1 AND data.fn_IsAdmin(@Owner) = 0
    THROW 50409, N'Bu dükkânın sahibi var; sahibi yönetiyor.', 1;
  IF @Active = 1
  BEGIN
    IF @Status <> 'approved' THROW 50409, N'Önce dükkânı onaylayın (yayında olmalı).', 1;
    IF @Phone IS NULL THROW 50409, N'Aktif yapmak için dükkânın telefonunu girin.', 1;
    IF NOT EXISTS (SELECT 1 FROM data.ShopServices WHERE ShopId = @ShopId AND IsActive = 1)
      THROW 50409, N'Aktif yapmak için en az bir hizmet ve fiyat girin.', 1;
    IF NOT EXISTS (SELECT 1 FROM data.Staff WHERE ShopId = @ShopId AND IsActive = 1)
      THROW 50409, N'Aktif yapmak için en az bir personel ekleyin.', 1;
    IF NOT EXISTS (SELECT 1 FROM data.ShopHours WHERE ShopId = @ShopId AND IsClosed = 0)
      THROW 50409, N'Aktif yapmak için çalışma saatlerini girin.', 1;
  END
  BEGIN TRAN;
    UPDATE data.Shops
    SET OwnerId = CASE WHEN @Active = 1 AND data.fn_IsAdmin(OwnerId) = 0 THEN @ActorId ELSE OwnerId END,
        IsClaimed = @Active, NeedsReview = CASE WHEN @Active = 1 THEN 0 ELSE NeedsReview END,
        UpdatedBy = @ActorId, UpdatedAt = SYSUTCDATETIME()
    WHERE Id = @ShopId;
    DECLARE @EntityId nvarchar(64) = CONVERT(nvarchar(64), @ShopId);
    DECLARE @Details nvarchar(max) = (SELECT @Active AS active FOR JSON PATH, WITHOUT_ARRAY_WRAPPER);
    EXEC data.usp_Log @ActorId, 'shop_active', 'shops', @EntityId, @Details;
  COMMIT;
END
GO

-- Yönetimi üstlen: katılmamış dükkânı admin'in işletme paneline al (aktif yapmadan hizmet/personel girebilmek için)
CREATE OR ALTER PROCEDURE api.Admin_Shop_TakeOver @ActorId uniqueidentifier, @ShopId uniqueidentifier
AS
BEGIN
  SET NOCOUNT ON;
  EXEC data.usp_RequireAdmin @ActorId;
  UPDATE data.Shops SET OwnerId = @ActorId, UpdatedBy = @ActorId, UpdatedAt = SYSUTCDATETIME()
  WHERE Id = @ShopId AND IsClaimed = 0;
  IF @@ROWCOUNT = 0 THROW 50409, N'Bu dükkân zaten yönetiliyor ya da bulunamadı.', 1;
END
GO
