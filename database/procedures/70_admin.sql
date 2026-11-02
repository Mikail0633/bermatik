-- =====================================================================
-- Bermatik — Admin paneli (her işlem data.AuditLog'a kaydedilir)
-- =====================================================================

CREATE OR ALTER PROCEDURE api.Admin_Dashboard @ActorId uniqueidentifier
AS
BEGIN
  SET NOCOUNT ON;
  EXEC data.usp_RequireAdmin @ActorId;
  DECLARE @TodayUtc datetime2(0) = data.fn_ToUtc(CAST(CAST(data.fn_IstanbulNow() AS date) AS datetime2(0)));
  SELECT
    (SELECT COUNT(*) FROM data.Users) AS UserCount,
    (SELECT COUNT(*) FROM data.Shops WHERE Status = 'approved') AS ApprovedShops,
    (SELECT COUNT(*) FROM data.Shops WHERE Status = 'pending') AS PendingShops,
    (SELECT COUNT(*) FROM data.Certificates WHERE Status = 'pending') AS PendingCertificates,
    (SELECT COUNT(*) FROM data.Appointments WHERE CreatedAt >= @TodayUtc) AS AppointmentsToday,
    (SELECT COUNT(*) FROM data.QueueEntries WHERE CreatedAt >= @TodayUtc) AS QueueEntriesToday,
    (SELECT COUNT(*) FROM data.Orders WHERE CreatedAt >= @TodayUtc) AS OrdersToday,
    (SELECT COUNT(*) FROM data.Reviews WHERE CreatedAt >= @TodayUtc) AS ReviewsToday,
    (SELECT COUNT(*) FROM data.ShopClaims WHERE Status = 'open') AS OpenClaims,
    (SELECT COUNT(*) FROM data.ShopSuggestions WHERE Status = 'open') AS OpenSuggestions,
    (SELECT COUNT(*) FROM data.Reports WHERE Status = 'open') AS OpenReports,
    (SELECT COUNT(*) FROM data.Shops WHERE NeedsReview = 1) AS NeedsReviewShops;
END
GO

-- Admin dükkân listesi: arama + filtreler (durum, bölüm, il/ilçe, katılmış mı, kontrol bekleyen)
CREATE OR ALTER PROCEDURE api.Admin_Shop_List
  @ActorId uniqueidentifier, @Status varchar(10) = NULL, @Segment varchar(5) = NULL, @Search nvarchar(100) = NULL,
  @ProvinceId tinyint = NULL, @DistrictId int = NULL, @Claimed bit = NULL, @NeedsReview bit = NULL, @Top int = 300
AS
BEGIN
  SET NOCOUNT ON;
  EXEC data.usp_RequireAdmin @ActorId;
  SELECT TOP (CASE WHEN @Top > 1000 THEN 1000 ELSE @Top END)
         s.Id, s.Code, s.Segment, s.Name, s.Slug, s.Status, s.StatusReason, s.Phone, s.Source, s.IsClaimed, s.NeedsReview,
         p.Name AS Province, p.Slug AS ProvinceSlug, d.Name AS District, d.Slug AS DistrictSlug, n.Name AS Neighborhood,
         CASE WHEN s.IsClaimed = 1 THEN u.FirstName + N' ' + u.LastName END AS OwnerName,
         CASE WHEN s.IsClaimed = 1 THEN u.Email COLLATE DATABASE_DEFAULT END AS OwnerEmail,
         data.fn_ShopIsCertified(s.Id) AS IsCertified, data.fn_ToIstanbul(s.CreatedAt) AS CreatedAtLocal
  FROM data.Shops s
  JOIN data.Users u ON u.Id = s.OwnerId
  JOIN data.Provinces p ON p.Id = s.ProvinceId
  JOIN data.Districts d ON d.Id = s.DistrictId
  JOIN data.Neighborhoods n ON n.Id = s.NeighborhoodId
  WHERE (@Status IS NULL OR s.Status = @Status)
    AND (@Segment IS NULL OR s.Segment = @Segment)
    AND (@ProvinceId IS NULL OR s.ProvinceId = @ProvinceId)
    AND (@DistrictId IS NULL OR s.DistrictId = @DistrictId)
    AND (@Claimed IS NULL OR s.IsClaimed = @Claimed)
    AND (@NeedsReview IS NULL OR s.NeedsReview = @NeedsReview)
    AND (@Search IS NULL OR s.Name LIKE N'%' + @Search + N'%' OR s.Code LIKE N'%' + @Search + N'%'
         OR u.Email LIKE N'%' + @Search + N'%' OR s.Phone LIKE '%' + @Search + '%')
  ORDER BY CASE s.Status WHEN 'pending' THEN 0 ELSE 1 END, s.NeedsReview DESC, s.CreatedAt DESC;
END
GO

CREATE OR ALTER PROCEDURE api.Admin_Shop_SetStatus
  @ActorId uniqueidentifier, @ShopId uniqueidentifier, @Status varchar(10), @Reason nvarchar(300) = NULL
AS
BEGIN
  SET NOCOUNT ON; SET XACT_ABORT ON;
  EXEC data.usp_RequireAdmin @ActorId;
  BEGIN TRAN;
    UPDATE data.Shops SET Status = @Status, StatusReason = @Reason, UpdatedAt = SYSUTCDATETIME(), UpdatedBy = @ActorId WHERE Id = @ShopId;
    IF @@ROWCOUNT = 0 THROW 50404, N'Dükkân bulunamadı.', 1;
    DECLARE @Details nvarchar(max) = (SELECT @Status AS status, @Reason AS reason FOR JSON PATH, WITHOUT_ARRAY_WRAPPER);
    DECLARE @EntityId nvarchar(64) = CONVERT(nvarchar(64), @ShopId);
    EXEC data.usp_Log @ActorId, 'shop_status', 'shops', @EntityId, @Details;
  COMMIT;
END
GO

CREATE OR ALTER PROCEDURE api.Admin_Certificate_List @ActorId uniqueidentifier, @Status varchar(10) = 'pending'
AS
BEGIN
  SET NOCOUNT ON;
  EXEC data.usp_RequireAdmin @ActorId;
  SELECT c.Id, c.Type, c.SerialNo, c.IssuedBy, c.Status, c.ReviewNote, data.fn_ToIstanbul(c.CreatedAt) AS CreatedAtLocal,
         u.Id AS UserId, u.FirstName + N' ' + u.LastName AS UserName, u.BirthYear, u.Email,
         (SELECT STRING_AGG(s.Code + N' ' + s.Name, N', ') FROM data.Shops s WHERE s.OwnerId = u.Id) AS Shops
  FROM data.Certificates c JOIN data.Users u ON u.Id = c.UserId
  WHERE @Status IS NULL OR c.Status = @Status
  ORDER BY c.CreatedAt;
END
GO

CREATE OR ALTER PROCEDURE api.Admin_Certificate_Review
  @ActorId uniqueidentifier, @CertificateId uniqueidentifier, @Status varchar(10), @Note nvarchar(300) = NULL
AS
BEGIN
  SET NOCOUNT ON; SET XACT_ABORT ON;
  EXEC data.usp_RequireAdmin @ActorId;
  BEGIN TRAN;
    UPDATE data.Certificates SET Status = @Status, ReviewNote = @Note, ReviewedBy = @ActorId, ReviewedAt = SYSUTCDATETIME()
    WHERE Id = @CertificateId;
    IF @@ROWCOUNT = 0 THROW 50404, N'Belge bulunamadı.', 1;
    DECLARE @Details nvarchar(max) = (SELECT @Status AS status, @Note AS note FOR JSON PATH, WITHOUT_ARRAY_WRAPPER);
    DECLARE @EntityId nvarchar(64) = CONVERT(nvarchar(64), @CertificateId);
    EXEC data.usp_Log @ActorId, 'certificate_review', 'certificates', @EntityId, @Details;
  COMMIT;
END
GO

CREATE OR ALTER PROCEDURE api.Admin_User_List @ActorId uniqueidentifier, @Search nvarchar(100) = NULL, @Role varchar(12) = NULL
AS
BEGIN
  SET NOCOUNT ON;
  EXEC data.usp_RequireAdmin @ActorId;
  SELECT TOP (200) Id, Email, Role, FirstName, LastName, BirthYear, Phone, IsActive,
         data.fn_ToIstanbul(CreatedAt) AS CreatedAtLocal
  FROM data.Users
  WHERE (@Role IS NULL OR Role = @Role)
    AND (@Search IS NULL OR Email LIKE N'%' + @Search + N'%' OR FirstName + N' ' + LastName LIKE N'%' + @Search + N'%'
         OR Phone LIKE '%' + @Search + '%')
  ORDER BY CreatedAt DESC;
END
GO

CREATE OR ALTER PROCEDURE api.Admin_User_SetRole @ActorId uniqueidentifier, @UserId uniqueidentifier, @Role varchar(12)
AS
BEGIN
  SET NOCOUNT ON; SET XACT_ABORT ON;
  EXEC data.usp_RequireAdmin @ActorId;
  IF @UserId = @ActorId THROW 50409, N'Kendi rolünüzü değiştiremezsiniz.', 1;
  BEGIN TRAN;
    UPDATE data.Users SET Role = @Role, UpdatedAt = SYSUTCDATETIME() WHERE Id = @UserId;
    IF @@ROWCOUNT = 0 THROW 50404, N'Kullanıcı bulunamadı.', 1;
    DELETE FROM data.Sessions WHERE UserId = @UserId;   -- yeni yetkiyle tekrar giriş yapsın
    DECLARE @Details nvarchar(max) = (SELECT @Role AS role FOR JSON PATH, WITHOUT_ARRAY_WRAPPER);
    DECLARE @EntityId nvarchar(64) = CONVERT(nvarchar(64), @UserId);
    EXEC data.usp_Log @ActorId, 'user_role', 'users', @EntityId, @Details;
  COMMIT;
END
GO

-- Kullanıcıyı engelle / engeli kaldır
CREATE OR ALTER PROCEDURE api.Admin_User_SetActive @ActorId uniqueidentifier, @UserId uniqueidentifier, @IsActive bit
AS
BEGIN
  SET NOCOUNT ON; SET XACT_ABORT ON;
  EXEC data.usp_RequireAdmin @ActorId;
  IF @UserId = @ActorId THROW 50409, N'Kendi hesabınızı engelleyemezsiniz.', 1;
  BEGIN TRAN;
    UPDATE data.Users SET IsActive = @IsActive, UpdatedAt = SYSUTCDATETIME() WHERE Id = @UserId;
    IF @@ROWCOUNT = 0 THROW 50404, N'Kullanıcı bulunamadı.', 1;
    IF @IsActive = 0 DELETE FROM data.Sessions WHERE UserId = @UserId;
    DECLARE @Details nvarchar(max) = (SELECT @IsActive AS active FOR JSON PATH, WITHOUT_ARRAY_WRAPPER);
    DECLARE @EntityId nvarchar(64) = CONVERT(nvarchar(64), @UserId);
    EXEC data.usp_Log @ActorId, 'user_active', 'users', @EntityId, @Details;
  COMMIT;
END
GO

CREATE OR ALTER PROCEDURE api.Admin_Review_List @ActorId uniqueidentifier, @ShopId uniqueidentifier = NULL
AS
BEGIN
  SET NOCOUNT ON;
  EXEC data.usp_RequireAdmin @ActorId;
  SELECT TOP (200) r.Id, r.Rating, r.Comment, r.IsHidden, data.fn_ToIstanbul(r.CreatedAt) AS CreatedAtLocal,
         s.Code, s.Name AS ShopName, u.FirstName + N' ' + u.LastName AS CustomerName, u.Email
  FROM data.Reviews r JOIN data.Shops s ON s.Id = r.ShopId JOIN data.Users u ON u.Id = r.CustomerId
  WHERE @ShopId IS NULL OR r.ShopId = @ShopId
  ORDER BY r.CreatedAt DESC;
END
GO

CREATE OR ALTER PROCEDURE api.Admin_Review_SetHidden @ActorId uniqueidentifier, @ReviewId uniqueidentifier, @Hidden bit
AS
BEGIN
  SET NOCOUNT ON; SET XACT_ABORT ON;
  EXEC data.usp_RequireAdmin @ActorId;
  BEGIN TRAN;
    UPDATE data.Reviews SET IsHidden = @Hidden WHERE Id = @ReviewId;
    IF @@ROWCOUNT = 0 THROW 50404, N'Yorum bulunamadı.', 1;
    DECLARE @Details nvarchar(max) = (SELECT @Hidden AS hidden FOR JSON PATH, WITHOUT_ARRAY_WRAPPER);
    DECLARE @EntityId nvarchar(64) = CONVERT(nvarchar(64), @ReviewId);
    EXEC data.usp_Log @ActorId, 'review_hidden', 'reviews', @EntityId, @Details;
  COMMIT;
END
GO

-- Platform anahtarları: yorumlar, ürün satışı, hizmet açıklamaları (NULL = değiştirme)
CREATE OR ALTER PROCEDURE api.Admin_Settings_Update
  @ActorId uniqueidentifier, @ReviewsEnabled bit = NULL, @StoreEnabled bit = NULL, @ServiceDescriptionsEnabled bit = NULL,
  @CommercialConsentEnabled bit = NULL
AS
BEGIN
  SET NOCOUNT ON; SET XACT_ABORT ON;
  EXEC data.usp_RequireAdmin @ActorId;
  BEGIN TRAN;
    UPDATE data.PlatformSettings
    SET ReviewsEnabled = ISNULL(@ReviewsEnabled, ReviewsEnabled),
        StoreEnabled = ISNULL(@StoreEnabled, StoreEnabled),
        ServiceDescriptionsEnabled = ISNULL(@ServiceDescriptionsEnabled, ServiceDescriptionsEnabled),
        CommercialConsentEnabled = ISNULL(@CommercialConsentEnabled, CommercialConsentEnabled),
        UpdatedAt = SYSUTCDATETIME(), UpdatedBy = @ActorId;
    DECLARE @Details nvarchar(max) = (SELECT @ReviewsEnabled AS reviews, @StoreEnabled AS store,
                                             @ServiceDescriptionsEnabled AS descriptions,
                                             @CommercialConsentEnabled AS commercialConsent FOR JSON PATH, WITHOUT_ARRAY_WRAPPER);
    EXEC data.usp_Log @ActorId, 'settings', 'platform_settings', NULL, @Details;
  COMMIT;
END
GO

-- Hizmet kategorisi ekle/güncelle (açıklamalar dahil)
CREATE OR ALTER PROCEDURE api.Admin_ServiceCategory_Save
  @ActorId uniqueidentifier, @CategoryId int = NULL, @Segment varchar(5), @Slug varchar(40), @Name nvarchar(60),
  @Description nvarchar(1000) = NULL, @SortOrder int = 0, @IsActive bit = 1, @RevisitDays smallint = NULL
AS
BEGIN
  SET NOCOUNT ON; SET XACT_ABORT ON;
  EXEC data.usp_RequireAdmin @ActorId;
  BEGIN TRAN;
    IF @CategoryId IS NULL
    BEGIN
      INSERT INTO data.ServiceCategories (Segment, Slug, Name, Description, SortOrder, IsActive, RevisitDays)
      VALUES (@Segment, @Slug, @Name, @Description, @SortOrder, @IsActive, @RevisitDays);
      SET @CategoryId = SCOPE_IDENTITY();
    END
    ELSE
    BEGIN
      UPDATE data.ServiceCategories
      SET Segment = @Segment, Slug = @Slug, Name = @Name, Description = @Description, SortOrder = @SortOrder, IsActive = @IsActive,
          RevisitDays = @RevisitDays
      WHERE Id = @CategoryId;
      IF @@ROWCOUNT = 0 THROW 50404, N'Kategori bulunamadı.', 1;
    END
    DECLARE @Details nvarchar(max) = (SELECT @Name AS name, @IsActive AS active FOR JSON PATH, WITHOUT_ARRAY_WRAPPER);
    DECLARE @EntityId nvarchar(64) = CONVERT(nvarchar(64), @CategoryId);
    EXEC data.usp_Log @ActorId, 'service_category', 'service_categories', @EntityId, @Details;
  COMMIT;
  SELECT @CategoryId AS Id;
END
GO

CREATE OR ALTER PROCEDURE api.Admin_AuditLog_List @ActorId uniqueidentifier, @Top int = 100
AS
BEGIN
  SET NOCOUNT ON;
  EXEC data.usp_RequireAdmin @ActorId;
  SELECT TOP (CASE WHEN @Top > 500 THEN 500 ELSE @Top END)
         l.Id, l.Action, l.Entity, l.EntityId, l.Details, data.fn_ToIstanbul(l.CreatedAt) AS CreatedAtLocal,
         u.FirstName + N' ' + u.LastName AS ActorName
  FROM data.AuditLog l LEFT JOIN data.Users u ON u.Id = l.ActorId
  ORDER BY l.Id DESC;
END
GO

-- SEO: site haritası (sitemap.xml) için tüm herkese açık sayfalar
CREATE OR ALTER PROCEDURE api.Seo_SitemapEntries
AS
BEGIN
  SET NOCOUNT ON;
  -- Dükkân sayfaları
  SELECT s.Segment, p.Slug AS ProvinceSlug, d.Slug AS DistrictSlug, s.Slug AS ShopSlug, s.UpdatedAt
  FROM data.Shops s JOIN data.Provinces p ON p.Id = s.ProvinceId JOIN data.Districts d ON d.Id = s.DistrictId
  WHERE s.Status = 'approved';
  -- En az bir onaylı dükkânı olan il/ilçe sayfaları
  SELECT DISTINCT s.Segment, p.Slug AS ProvinceSlug, d.Slug AS DistrictSlug
  FROM data.Shops s JOIN data.Provinces p ON p.Id = s.ProvinceId JOIN data.Districts d ON d.Id = s.DistrictId
  WHERE s.Status = 'approved';
END
GO

-- Ayarlar sayfası: pasifler dahil tüm hizmet kategorileri ve kaç dükkânda kullanıldıkları
CREATE OR ALTER PROCEDURE api.Admin_ServiceCategory_List @ActorId uniqueidentifier
AS
BEGIN
  SET NOCOUNT ON;
  EXEC data.usp_RequireAdmin @ActorId;
  SELECT c.Id, c.Segment, c.Slug, c.Name, c.Description, c.SortOrder, c.IsActive, c.RevisitDays,
         (SELECT COUNT(*) FROM data.ShopServices ss WHERE ss.CategoryId = c.Id) AS UsageCount
  FROM data.ServiceCategories c
  ORDER BY c.Segment, c.SortOrder, c.Name;
END
GO
