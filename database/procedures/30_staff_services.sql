-- =====================================================================
-- Bermatik — Personel ve hizmetler (fiyat listesi)
-- =====================================================================

-- Herkes aktif personeli görür; dükkân üyeleri pasifleri ve hesap durumunu da görür.
-- Telefon: personel "müşterilere göster" dediyse herkese, demediyse yalnızca dükkân içi ve admin'e görünür.
CREATE OR ALTER PROCEDURE api.Staff_List @ShopId uniqueidentifier, @ActorId uniqueidentifier = NULL
AS
BEGIN
  SET NOCOUNT ON;
  DECLARE @IsMember bit = data.fn_IsShopMember(@ActorId, @ShopId);
  DECLARE @IsAdmin bit = data.fn_IsAdmin(@ActorId);
  IF data.fn_ShopIsPublic(@ShopId) = 0 AND @IsMember = 0 AND @IsAdmin = 0
    THROW 50404, N'Dükkân bulunamadı.', 1;
  SELECT Id, DisplayName, Title, PhotoPath, IsActive, QueueAvgMinutes,
         CASE WHEN ShowPhone = 1 OR @IsMember = 1 OR @IsAdmin = 1 THEN Phone END AS Phone,
         CASE WHEN @IsMember = 1 OR @IsAdmin = 1 THEN ShowPhone END AS ShowPhone,
         CASE WHEN @IsMember = 1 THEN CAST(CASE WHEN UserId IS NOT NULL THEN 1 ELSE 0 END AS bit) END AS HasAccount,
         CAST(CASE WHEN UserId = @ActorId THEN 1 ELSE 0 END AS bit) AS IsMe,
         CAST(CASE WHEN UserId IS NOT NULL AND EXISTS (SELECT 1 FROM data.Certificates c WHERE c.UserId = data.Staff.UserId AND c.Status = 'verified') THEN 1 ELSE 0 END AS bit) AS IsCertified
  FROM data.Staff
  WHERE ShopId = @ShopId AND (IsActive = 1 OR @IsMember = 1)
  ORDER BY DisplayName;
END
GO

-- Personel ekle (@StaffId NULL) veya güncelle — yalnızca dükkân sahibi
CREATE OR ALTER PROCEDURE api.Staff_Save
  @ActorId uniqueidentifier, @ShopId uniqueidentifier, @StaffId uniqueidentifier = NULL,
  @DisplayName nvarchar(60), @Title nvarchar(60) = NULL, @PhotoPath nvarchar(300) = NULL, @IsActive bit = 1,
  @Phone nvarchar(40) = NULL, @ShowPhone bit = 0
AS
BEGIN
  SET NOCOUNT ON;
  IF data.fn_CanManageShop(@ActorId, @ShopId) = 0 THROW 50403, N'Bu işlem için yetkiniz yok.', 1;
  DECLARE @NormPhone varchar(16) = data.fn_NormalizePhone(@Phone);
  IF NULLIF(LTRIM(RTRIM(@Phone)), N'') IS NOT NULL AND @NormPhone IS NULL
    THROW 50400, N'Geçerli bir telefon numarası girin.', 1;
  IF @NormPhone IS NULL SET @ShowPhone = 0;

  IF @StaffId IS NULL
  BEGIN
    IF (SELECT COUNT(*) FROM data.Staff WHERE ShopId = @ShopId) >= 50
      THROW 50409, N'Bir dükkâna en fazla 50 personel eklenebilir.', 1;
    DECLARE @Out TABLE (Id uniqueidentifier);
    INSERT INTO data.Staff (ShopId, DisplayName, Title, PhotoPath, IsActive, Phone, ShowPhone)
    OUTPUT inserted.Id INTO @Out
    VALUES (@ShopId, LTRIM(RTRIM(@DisplayName)), @Title, @PhotoPath, @IsActive, @NormPhone, @ShowPhone);
    SELECT Id FROM @Out;
  END
  ELSE
  BEGIN
    UPDATE data.Staff
    -- Fotoğraf burada boş gelirse korunur; değiştirmek/kaldırmak için api.Staff_SetPhoto
    SET DisplayName = LTRIM(RTRIM(@DisplayName)), Title = @Title, PhotoPath = ISNULL(@PhotoPath, PhotoPath), IsActive = @IsActive,
        Phone = @NormPhone, ShowPhone = @ShowPhone
    WHERE Id = @StaffId AND ShopId = @ShopId;
    IF @@ROWCOUNT = 0 THROW 50404, N'Personel bulunamadı.', 1;
    SELECT @StaffId AS Id;
  END
END
GO

-- ---------------------------------------------------------------------
-- Personele göre süreler (personel kendisi veya dükkân sahibi ayarlar)
-- ---------------------------------------------------------------------
CREATE OR ALTER FUNCTION data.fn_CanEditStaff(@ActorId uniqueidentifier, @StaffId uniqueidentifier)
RETURNS bit AS
BEGIN
  RETURN CASE WHEN EXISTS (SELECT 1 FROM data.Staff st JOIN data.Shops s ON s.Id = st.ShopId
                           WHERE st.Id = @StaffId AND (st.UserId = @ActorId OR s.OwnerId = @ActorId))
                OR data.fn_IsAdmin(@ActorId) = 1
              THEN 1 ELSE 0 END;
END
GO

-- Personelin hizmetleri ve süreleri (randevu ekranı için herkese açık)
CREATE OR ALTER PROCEDURE api.Staff_ServiceDurations @StaffId uniqueidentifier
AS
BEGIN
  SET NOCOUNT ON;
  SELECT ss.Id AS ShopServiceId, ss.Name, ss.Price, ss.DurationMinutes AS ShopDurationMinutes,
         d.DurationMinutes AS StaffDurationMinutes,
         ISNULL(d.DurationMinutes, ss.DurationMinutes) AS DurationMinutes
  FROM data.Staff st
  JOIN data.ShopServices ss ON ss.ShopId = st.ShopId AND ss.IsActive = 1
  LEFT JOIN data.StaffServiceDurations d ON d.StaffId = st.Id AND d.ShopServiceId = ss.Id
  WHERE st.Id = @StaffId AND st.IsActive = 1 AND data.fn_ShopIsPublic(st.ShopId) = 1
  ORDER BY ss.SortOrder, ss.Name;
END
GO

-- Bir hizmet için personelin kendi süresi. @DurationMinutes NULL → dükkân süresine dön
CREATE OR ALTER PROCEDURE api.Staff_SetServiceDuration
  @ActorId uniqueidentifier, @StaffId uniqueidentifier, @ShopServiceId uniqueidentifier, @DurationMinutes smallint = NULL
AS
BEGIN
  SET NOCOUNT ON;
  IF data.fn_CanEditStaff(@ActorId, @StaffId) = 0 THROW 50403, N'Bu işlem için yetkiniz yok.', 1;
  IF NOT EXISTS (SELECT 1 FROM data.ShopServices ss JOIN data.Staff st ON st.ShopId = ss.ShopId
                 WHERE ss.Id = @ShopServiceId AND st.Id = @StaffId)
    THROW 50404, N'Hizmet bulunamadı.', 1;
  IF @DurationMinutes IS NOT NULL AND @DurationMinutes NOT BETWEEN 5 AND 600
    THROW 50400, N'Süre 5 ile 600 dakika arasında olmalı.', 1;

  IF @DurationMinutes IS NULL
    DELETE FROM data.StaffServiceDurations WHERE StaffId = @StaffId AND ShopServiceId = @ShopServiceId;
  ELSE
  BEGIN
    UPDATE data.StaffServiceDurations SET DurationMinutes = @DurationMinutes, UpdatedAt = SYSUTCDATETIME()
    WHERE StaffId = @StaffId AND ShopServiceId = @ShopServiceId;
    IF @@ROWCOUNT = 0
      INSERT INTO data.StaffServiceDurations (StaffId, ShopServiceId, DurationMinutes)
      VALUES (@StaffId, @ShopServiceId, @DurationMinutes);
  END
END
GO

-- Canlı sırada personelin müşteri başına ortalama süresi. NULL → dükkân ortalaması
CREATE OR ALTER PROCEDURE api.Staff_SetQueueAvg @ActorId uniqueidentifier, @StaffId uniqueidentifier, @Minutes smallint = NULL
AS
BEGIN
  SET NOCOUNT ON;
  IF data.fn_CanEditStaff(@ActorId, @StaffId) = 0 THROW 50403, N'Bu işlem için yetkiniz yok.', 1;
  IF @Minutes IS NOT NULL AND @Minutes NOT BETWEEN 5 AND 180
    THROW 50400, N'Süre 5 ile 180 dakika arasında olmalı.', 1;
  UPDATE data.Staff SET QueueAvgMinutes = @Minutes WHERE Id = @StaffId;
END
GO

-- Personel kendi telefonunu ve "müşterilere göster" seçimini değiştirir
CREATE OR ALTER PROCEDURE api.Staff_UpdateMyPhone
  @ActorId uniqueidentifier, @StaffId uniqueidentifier, @Phone nvarchar(40) = NULL, @ShowPhone bit = 0
AS
BEGIN
  SET NOCOUNT ON;
  EXEC data.usp_RequireUser @ActorId;
  DECLARE @NormPhone varchar(16) = data.fn_NormalizePhone(@Phone);
  IF NULLIF(LTRIM(RTRIM(@Phone)), N'') IS NOT NULL AND @NormPhone IS NULL
    THROW 50400, N'Geçerli bir telefon numarası girin.', 1;
  IF @NormPhone IS NULL SET @ShowPhone = 0;
  UPDATE data.Staff SET Phone = @NormPhone, ShowPhone = @ShowPhone
  WHERE Id = @StaffId AND UserId = @ActorId;
  IF @@ROWCOUNT = 0 THROW 50403, N'Bu işlem için yetkiniz yok.', 1;
END
GO

-- Sahip davet kodu üretir; çalışan bu kodu girerek hesabını bağlar
CREATE OR ALTER PROCEDURE api.Staff_CreateInvite @ActorId uniqueidentifier, @StaffId uniqueidentifier
AS
BEGIN
  SET NOCOUNT ON;
  DECLARE @ShopId uniqueidentifier = (SELECT ShopId FROM data.Staff WHERE Id = @StaffId);
  IF @ShopId IS NULL OR data.fn_CanManageShop(@ActorId, @ShopId) = 0 THROW 50403, N'Bu işlem için yetkiniz yok.', 1;
  DECLARE @Code char(12) = UPPER(LEFT(REPLACE(CONVERT(varchar(36), NEWID()), '-', ''), 12));
  UPDATE data.Staff SET InviteCode = @Code WHERE Id = @StaffId AND UserId IS NULL;
  IF @@ROWCOUNT = 0 THROW 50409, N'Bu personel zaten bir hesaba bağlı.', 1;
  SELECT @Code AS InviteCode;
END
GO

CREATE OR ALTER PROCEDURE api.Staff_ClaimInvite @ActorId uniqueidentifier, @Code varchar(20)
AS
BEGIN
  SET NOCOUNT ON; SET XACT_ABORT ON;
  EXEC data.usp_RequireUser @ActorId;
  DECLARE @Out TABLE (Id uniqueidentifier, ShopId uniqueidentifier);
  BEGIN TRAN;
    UPDATE data.Staff SET UserId = @ActorId, InviteCode = NULL
    OUTPUT inserted.Id, inserted.ShopId INTO @Out
    WHERE InviteCode = UPPER(LTRIM(RTRIM(@Code))) AND UserId IS NULL
      AND NOT EXISTS (SELECT 1 FROM data.Staff s2 WHERE s2.ShopId = data.Staff.ShopId AND s2.UserId = @ActorId);
    IF NOT EXISTS (SELECT 1 FROM @Out) THROW 50400, N'Davet kodu geçersiz.', 1;
    UPDATE data.Users SET Role = 'staff', UpdatedAt = SYSUTCDATETIME()
    WHERE Id = @ActorId AND (Role = 'customer' OR (Role = 'shop_owner' AND NOT EXISTS (SELECT 1 FROM data.Shops WHERE OwnerId = @ActorId)));
  COMMIT;
  SELECT Id AS StaffId, ShopId FROM @Out;
END
GO

-- Giriş yapan kişinin personel kayıtları (personel paneli)
CREATE OR ALTER PROCEDURE api.Staff_Mine @ActorId uniqueidentifier
AS
BEGIN
  SET NOCOUNT ON;
  SELECT st.Id AS StaffId, st.DisplayName, s.Id AS ShopId, s.Name AS ShopName, s.Code
  FROM data.Staff st JOIN data.Shops s ON s.Id = st.ShopId
  WHERE st.UserId = @ActorId AND st.IsActive = 1;
END
GO

-- ---------------------------------------------------------------------
-- Hizmetler / fiyat listesi
-- Açıklama: dükkânın kendi açıklaması, yoksa kategori açıklaması.
-- Açıklamalar admin VE dükkân açık tutuyorsa gösterilir.
-- ---------------------------------------------------------------------
CREATE OR ALTER PROCEDURE api.ShopService_List @ShopId uniqueidentifier, @ActorId uniqueidentifier = NULL
AS
BEGIN
  SET NOCOUNT ON;
  DECLARE @IsMember bit = data.fn_IsShopMember(@ActorId, @ShopId);
  IF data.fn_ShopIsPublic(@ShopId) = 0 AND @IsMember = 0 AND data.fn_IsAdmin(@ActorId) = 0
    THROW 50404, N'Dükkân bulunamadı.', 1;
  DECLARE @ShowDesc bit = (SELECT CASE WHEN ps.ServiceDescriptionsEnabled = 1 AND s.ShowServiceDescriptions = 1 THEN 1 ELSE 0 END
                           FROM data.Shops s CROSS JOIN data.PlatformSettings ps WHERE s.Id = @ShopId);

  SELECT ss.Id, ss.CategoryId, c.Name AS CategoryName, c.Slug AS CategorySlug, ss.Name,
         CASE WHEN @ShowDesc = 1 OR @IsMember = 1 THEN COALESCE(ss.Description, c.Description) END AS Description,
         CASE WHEN @IsMember = 1 THEN ss.Description END AS OwnDescription,
         ss.Price, ss.DurationMinutes, ss.IsActive, ss.SortOrder
  FROM data.ShopServices ss
  JOIN data.ServiceCategories c ON c.Id = ss.CategoryId
  WHERE ss.ShopId = @ShopId AND (ss.IsActive = 1 OR @IsMember = 1)
  ORDER BY c.SortOrder, ss.SortOrder, ss.Name;
END
GO

-- Hizmet ekle/güncelle — fiyatı dükkân sahibi belirler
CREATE OR ALTER PROCEDURE api.ShopService_Save
  @ActorId uniqueidentifier, @ShopId uniqueidentifier, @ServiceId uniqueidentifier = NULL,
  @CategoryId int, @Name nvarchar(80), @Description nvarchar(1000) = NULL,
  @Price decimal(10, 2), @DurationMinutes smallint, @IsActive bit = 1, @SortOrder int = 0
AS
BEGIN
  SET NOCOUNT ON;
  IF data.fn_CanManageShop(@ActorId, @ShopId) = 0 THROW 50403, N'Bu işlem için yetkiniz yok.', 1;
  IF NOT EXISTS (SELECT 1 FROM data.ServiceCategories c JOIN data.Shops s ON s.Segment = c.Segment
                 WHERE c.Id = @CategoryId AND s.Id = @ShopId AND c.IsActive = 1)
    THROW 50400, N'Hizmet kategorisi bu dükkân için geçersiz.', 1;
  SET @Description = NULLIF(LTRIM(RTRIM(@Description)), N'');

  IF @ServiceId IS NULL
  BEGIN
    IF (SELECT COUNT(*) FROM data.ShopServices WHERE ShopId = @ShopId) >= 100
      THROW 50409, N'Bir dükkâna en fazla 100 hizmet eklenebilir.', 1;
    DECLARE @Out TABLE (Id uniqueidentifier);
    INSERT INTO data.ShopServices (ShopId, CategoryId, Name, Description, Price, DurationMinutes, IsActive, SortOrder, UpdatedBy)
    OUTPUT inserted.Id INTO @Out
    VALUES (@ShopId, @CategoryId, LTRIM(RTRIM(@Name)), @Description, @Price, @DurationMinutes, @IsActive, @SortOrder, @ActorId);
    SELECT Id FROM @Out;
  END
  ELSE
  BEGIN
    UPDATE data.ShopServices
    SET CategoryId = @CategoryId, Name = LTRIM(RTRIM(@Name)), Description = @Description, Price = @Price,
        DurationMinutes = @DurationMinutes, IsActive = @IsActive, SortOrder = @SortOrder, UpdatedBy = @ActorId
    WHERE Id = @ServiceId AND ShopId = @ShopId;
    IF @@ROWCOUNT = 0 THROW 50404, N'Hizmet bulunamadı.', 1;
    SELECT @ServiceId AS Id;
  END
END
GO

-- Randevularda kullanılmışsa silinmez, pasif yapılır (geçmiş kayıtlar bozulmasın)
CREATE OR ALTER PROCEDURE api.ShopService_Delete @ActorId uniqueidentifier, @ServiceId uniqueidentifier
AS
BEGIN
  SET NOCOUNT ON;
  DECLARE @ShopId uniqueidentifier = (SELECT ShopId FROM data.ShopServices WHERE Id = @ServiceId);
  IF @ShopId IS NULL OR data.fn_CanManageShop(@ActorId, @ShopId) = 0 THROW 50403, N'Bu işlem için yetkiniz yok.', 1;
  IF EXISTS (SELECT 1 FROM data.AppointmentServices WHERE ShopServiceId = @ServiceId)
    UPDATE data.ShopServices SET IsActive = 0, UpdatedBy = @ActorId WHERE Id = @ServiceId;
  ELSE
    DELETE FROM data.ShopServices WHERE Id = @ServiceId;
END
GO
