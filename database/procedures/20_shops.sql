-- =====================================================================
-- Bermatik — Adres listeleri, ayarlar, dükkânlar, çalışma saatleri, belgeler
-- =====================================================================

CREATE OR ALTER PROCEDURE api.Lookup_Provinces
AS
BEGIN
  SET NOCOUNT ON;
  SELECT Id, Name, Slug FROM data.Provinces ORDER BY Name;
END
GO

CREATE OR ALTER PROCEDURE api.Lookup_Districts @ProvinceId tinyint
AS
BEGIN
  SET NOCOUNT ON;
  SELECT Id, Name, Slug FROM data.Districts WHERE ProvinceId = @ProvinceId ORDER BY Name;
END
GO

CREATE OR ALTER PROCEDURE api.Lookup_Neighborhoods @DistrictId int
AS
BEGIN
  SET NOCOUNT ON;
  SELECT Id, Name FROM data.Neighborhoods WHERE DistrictId = @DistrictId ORDER BY Name;
END
GO

CREATE OR ALTER PROCEDURE api.Settings_Get
AS
BEGIN
  SET NOCOUNT ON;
  SELECT ReviewsEnabled, StoreEnabled, ServiceDescriptionsEnabled, CommercialConsentEnabled FROM data.PlatformSettings;
END
GO

CREATE OR ALTER PROCEDURE api.ServiceCategory_List @Segment varchar(5) = NULL
AS
BEGIN
  SET NOCOUNT ON;
  SELECT Id, Segment, Slug, Name, Description, SortOrder, RevisitDays
  FROM data.ServiceCategories
  WHERE IsActive = 1 AND (@Segment IS NULL OR Segment = @Segment)
  ORDER BY Segment, SortOrder;
END
GO

-- ---------------------------------------------------------------------
-- Dükkân başvurusu (durum her zaman 'pending' başlar, admin onaylar)
-- ---------------------------------------------------------------------
CREATE OR ALTER PROCEDURE api.Shop_Apply
  @ActorId uniqueidentifier, @Segment varchar(5), @Name nvarchar(100), @Description nvarchar(2000) = NULL,
  @Phone nvarchar(40), @ProvinceId tinyint, @DistrictId int, @NeighborhoodId int,
  @Street nvarchar(120), @BuildingNo nvarchar(20), @AddressDetail nvarchar(200) = NULL,
  @Latitude decimal(9, 6), @Longitude decimal(9, 6)
AS
BEGIN
  SET NOCOUNT ON; SET XACT_ABORT ON;
  EXEC data.usp_RequireUser @ActorId;
  IF NOT EXISTS (SELECT 1 FROM data.Users WHERE Id = @ActorId AND Role IN ('shop_owner', 'admin'))
    THROW 50403, N'Dükkân eklemek için işletme hesabı gerekir.', 1;
  IF EXISTS (SELECT 1 FROM data.Users WHERE Id = @ActorId AND EmailVerifiedAt IS NULL AND Role <> 'admin')
    THROW 50409, N'Önce e-posta adresinizi doğrulayın.', 1;
  DECLARE @NormPhone varchar(16) = data.fn_NormalizePhone(@Phone);
  IF @NormPhone IS NULL THROW 50400, N'Geçerli bir dükkân telefonu girin.', 1;
  IF @Segment NOT IN ('erkek', 'kadin') THROW 50400, N'Dükkân türü geçersiz.', 1;
  IF NOT EXISTS (SELECT 1 FROM data.Neighborhoods n JOIN data.Districts d ON d.Id = n.DistrictId
                 WHERE n.Id = @NeighborhoodId AND d.Id = @DistrictId AND d.ProvinceId = @ProvinceId)
    THROW 50400, N'İl, ilçe ve mahalle birbiriyle uyuşmuyor.', 1;
  IF (SELECT COUNT(*) FROM data.Shops WHERE OwnerId = @ActorId) >= 3
    THROW 50409, N'Bir hesapla en fazla 3 dükkân açılabilir.', 1;

  DECLARE @Seq int, @Code varchar(12);
  IF @Segment = 'erkek' SET @Seq = NEXT VALUE FOR data.ShopCodeErkek;
  ELSE SET @Seq = NEXT VALUE FOR data.ShopCodeKadin;
  SET @Code = data.fn_ShopCode(@Segment, @Seq);
  DECLARE @Out TABLE (Id uniqueidentifier);

  BEGIN TRAN;
    INSERT INTO data.Shops (Code, OwnerId, Segment, Name, Slug, Description, Phone, ProvinceId, DistrictId, NeighborhoodId,
                            Street, BuildingNo, AddressDetail, Latitude, Longitude, UpdatedBy)
    OUTPUT inserted.Id INTO @Out
    VALUES (@Code, @ActorId, @Segment, LTRIM(RTRIM(@Name)), data.fn_UniqueShopSlug(@DistrictId, @Name, NULL),
            @Description, @NormPhone, @ProvinceId, @DistrictId, @NeighborhoodId,
            LTRIM(RTRIM(@Street)), LTRIM(RTRIM(@BuildingNo)), @AddressDetail, @Latitude, @Longitude, @ActorId);
    UPDATE data.Users SET Role = 'shop_owner', UpdatedAt = SYSUTCDATETIME()
    WHERE Id = @ActorId AND Role IN ('customer', 'staff');
  COMMIT;

  SELECT Id, @Code AS Code FROM @Out;
END
GO

-- Dükkân bilgilerini güncelle (yalnızca sahip; durum değiştirilemez)
CREATE OR ALTER PROCEDURE api.Shop_Update
  @ActorId uniqueidentifier, @ShopId uniqueidentifier, @Name nvarchar(100), @Description nvarchar(2000) = NULL,
  @Phone nvarchar(40), @ProvinceId tinyint, @DistrictId int, @NeighborhoodId int,
  @Street nvarchar(120), @BuildingNo nvarchar(20), @AddressDetail nvarchar(200) = NULL,
  @Latitude decimal(9, 6), @Longitude decimal(9, 6),
  @IsTemporarilyClosed bit, @ShowServiceDescriptions bit, @StoreEnabled bit, @QueueAvgMinutes smallint,
  @CoverImagePath nvarchar(300) = NULL
AS
BEGIN
  SET NOCOUNT ON;
  IF data.fn_CanManageShop(@ActorId, @ShopId) = 0 THROW 50403, N'Bu işlem için yetkiniz yok.', 1;
  DECLARE @NormPhone varchar(16) = data.fn_NormalizePhone(@Phone);
  -- Katılmamış dükkânın telefonu bilinmeyebilir; katılmış dükkânda zorunlu
  IF @NormPhone IS NULL AND (NULLIF(LTRIM(RTRIM(@Phone)), N'') IS NOT NULL
                             OR EXISTS (SELECT 1 FROM data.Shops WHERE Id = @ShopId AND IsClaimed = 1))
    THROW 50400, N'Geçerli bir dükkân telefonu girin.', 1;
  IF NOT EXISTS (SELECT 1 FROM data.Neighborhoods n JOIN data.Districts d ON d.Id = n.DistrictId
                 WHERE n.Id = @NeighborhoodId AND d.Id = @DistrictId AND d.ProvinceId = @ProvinceId)
    THROW 50400, N'İl, ilçe ve mahalle birbiriyle uyuşmuyor.', 1;

  -- Sayfa adresi yalnızca isim veya ilçe değişince yenilenir (Google'daki adres sabit kalsın)
  DECLARE @Slug varchar(120) = (SELECT CASE WHEN Name = LTRIM(RTRIM(@Name)) AND DistrictId = @DistrictId THEN Slug
                                            ELSE data.fn_UniqueShopSlug(@DistrictId, @Name, @ShopId) END
                                FROM data.Shops WHERE Id = @ShopId);
  UPDATE data.Shops
  SET NeedsReview = 0,  -- düzenlenen dükkân kontrol edilmiş sayılır
      Name = LTRIM(RTRIM(@Name)), Slug = @Slug, Description = @Description, Phone = @NormPhone,
      ProvinceId = @ProvinceId, DistrictId = @DistrictId, NeighborhoodId = @NeighborhoodId,
      Street = LTRIM(RTRIM(@Street)), BuildingNo = LTRIM(RTRIM(@BuildingNo)), AddressDetail = @AddressDetail,
      Latitude = @Latitude, Longitude = @Longitude,
      IsTemporarilyClosed = @IsTemporarilyClosed, ShowServiceDescriptions = @ShowServiceDescriptions,
      StoreEnabled = @StoreEnabled, QueueAvgMinutes = @QueueAvgMinutes, CoverImagePath = ISNULL(@CoverImagePath, CoverImagePath),
      UpdatedAt = SYSUTCDATETIME(), UpdatedBy = @ActorId
  WHERE Id = @ShopId;
END
GO

-- Dükkân detay sayfası. Onaylı değilse yalnızca sahibi/personeli/admin görür.
CREATE OR ALTER PROCEDURE api.Shop_Get @ShopId uniqueidentifier, @ActorId uniqueidentifier = NULL
AS
BEGIN
  SET NOCOUNT ON;
  DECLARE @IsMember bit = data.fn_IsShopMember(@ActorId, @ShopId);
  DECLARE @IsAdmin bit = data.fn_IsAdmin(@ActorId);
  IF data.fn_ShopIsPublic(@ShopId) = 0 AND @IsMember = 0 AND @IsAdmin = 0
    THROW 50404, N'Dükkân bulunamadı.', 1;

  SELECT s.Id, s.Code, s.Segment, s.Name, s.Slug, p.Slug AS ProvinceSlug, d.Slug AS DistrictSlug, s.Description, s.Phone,
         s.ProvinceId, p.Name AS Province, s.DistrictId, d.Name AS District, s.NeighborhoodId, n.Name AS Neighborhood,
         s.Street, s.BuildingNo, s.AddressDetail, s.Latitude, s.Longitude, s.CoverImagePath,
         s.Status, CASE WHEN @IsMember = 1 OR @IsAdmin = 1 THEN s.StatusReason END AS StatusReason,
         s.IsTemporarilyClosed, s.QueueAvgMinutes, s.IsClaimed, s.Source, s.NeedsReview,
         o.IsOpen, o.OpensAt, o.ClosesAt, o.ClosedReason, o.ClosedUntil,
         data.fn_ShopIsCertified(s.Id) AS IsCertified,
         CAST(CASE WHEN ps.ServiceDescriptionsEnabled = 1 AND s.ShowServiceDescriptions = 1 THEN 1 ELSE 0 END AS bit) AS ShowServiceDescriptions,
         s.ShowServiceDescriptions AS ShopShowServiceDescriptions,
         data.fn_StoreEnabledFor(s.Id) AS StoreOpen,
         s.StoreEnabled AS ShopStoreEnabled,
         ps.ReviewsEnabled,
         r.AvgRating, ISNULL(r.ReviewCount, 0) AS ReviewCount,
         @IsMember AS IsMember, data.fn_IsShopOwner(@ActorId, s.Id) AS IsOwner,
         data.fn_IsAdmin(s.OwnerId) AS OwnerIsAdmin
  FROM data.Shops s
  JOIN data.Provinces p ON p.Id = s.ProvinceId
  JOIN data.Districts d ON d.Id = s.DistrictId
  JOIN data.Neighborhoods n ON n.Id = s.NeighborhoodId
  CROSS JOIN data.PlatformSettings ps
  CROSS APPLY data.tvf_ShopOpenStatus(s.Id) o
  OUTER APPLY (SELECT CAST(ROUND(AVG(CAST(Rating AS decimal(3, 1))), 1) AS decimal(2, 1)) AS AvgRating, COUNT(*) AS ReviewCount
               FROM data.Reviews WHERE ShopId = s.Id AND IsHidden = 0 AND ps.ReviewsEnabled = 1) r
  WHERE s.Id = @ShopId;
END
GO

-- Dükkân arama: konum verildiyse en yakınlar, yoksa il/ilçeye göre
CREATE OR ALTER PROCEDURE api.Shop_Search
  @Segment varchar(5), @Latitude float = NULL, @Longitude float = NULL, @RadiusKm float = 10,
  @ProvinceId tinyint = NULL, @DistrictId int = NULL, @Query nvarchar(100) = NULL, @Limit int = 50,
  @CategorySlug varchar(40) = NULL,  -- yalnızca bu hizmeti veren dükkânlar (örn. 'damat-trasi')
  @NeighborhoodId int = NULL,        -- yalnızca bu mahalledekiler
  @ExcludeDistrictId int = NULL      -- "yakın çevre" listesinde ilçenin kendi dükkânları tekrar çıkmasın
AS
BEGIN
  SET NOCOUNT ON;
  SET @RadiusKm = CASE WHEN @RadiusKm > 50 THEN 50 WHEN @RadiusKm < 1 THEN 1 ELSE @RadiusKm END;
  SET @Limit = CASE WHEN @Limit > 1000 THEN 1000 WHEN @Limit < 1 THEN 1 ELSE @Limit END;
  -- 1) Aday dükkânlar: konum varsa harita diziniyle (SX_Shops_Location), yoksa il/ilçe diziniyle
  DECLARE @Found TABLE (Id uniqueidentifier PRIMARY KEY, DistanceKm float NULL);
  IF @Latitude IS NOT NULL AND @Longitude IS NOT NULL
  BEGIN
    DECLARE @Here geography = geography::Point(@Latitude, @Longitude, 4326);
    INSERT INTO @Found
    SELECT Id, ROUND(Location.STDistance(@Here) / 1000.0, 2)
    FROM data.Shops
    WHERE Location.STDistance(@Here) <= @RadiusKm * 1000
      AND Status = 'approved' AND Segment = @Segment
      AND (@ProvinceId IS NULL OR ProvinceId = @ProvinceId)
      AND (@DistrictId IS NULL OR DistrictId = @DistrictId)
      AND (@NeighborhoodId IS NULL OR NeighborhoodId = @NeighborhoodId)
      AND (@ExcludeDistrictId IS NULL OR DistrictId <> @ExcludeDistrictId)
      AND (@Query IS NULL OR Name LIKE N'%' + @Query + N'%'   -- dükkân adı ya da ilçe/il adıyla arama
           OR DistrictId IN (SELECT Id FROM data.Districts WHERE Name LIKE @Query + N'%')
           OR ProvinceId IN (SELECT Id FROM data.Provinces WHERE Name LIKE @Query + N'%'))
      AND (@CategorySlug IS NULL OR EXISTS (SELECT 1 FROM data.ShopServices ss JOIN data.ServiceCategories c ON c.Id = ss.CategoryId
                                            WHERE ss.ShopId = data.Shops.Id AND ss.IsActive = 1 AND c.Slug = @CategorySlug));
  END
  ELSE
    INSERT INTO @Found
    SELECT Id, NULL
    FROM data.Shops
    WHERE Status = 'approved' AND Segment = @Segment
      AND (@ProvinceId IS NULL OR ProvinceId = @ProvinceId)
      AND (@DistrictId IS NULL OR DistrictId = @DistrictId)
      AND (@NeighborhoodId IS NULL OR NeighborhoodId = @NeighborhoodId)
      AND (@ExcludeDistrictId IS NULL OR DistrictId <> @ExcludeDistrictId)
      AND (@Query IS NULL OR Name LIKE N'%' + @Query + N'%'   -- dükkân adı ya da ilçe/il adıyla arama
           OR DistrictId IN (SELECT Id FROM data.Districts WHERE Name LIKE @Query + N'%')
           OR ProvinceId IN (SELECT Id FROM data.Provinces WHERE Name LIKE @Query + N'%'))
      AND (@CategorySlug IS NULL OR EXISTS (SELECT 1 FROM data.ShopServices ss JOIN data.ServiceCategories c ON c.Id = ss.CategoryId
                                            WHERE ss.ShopId = data.Shops.Id AND ss.IsActive = 1 AND c.Slug = @CategorySlug));

  DECLARE @DayFrom datetime2(0) = data.fn_ToUtc(CAST(CAST(data.fn_IstanbulNow() AS date) AS datetime2(0)));  -- bugün 00:00 (İstanbul), UTC

  -- 2) Ayrıntılar: en yakın önce; konumsuzsa açık olanlar ve yüksek puanlılar önce
  SELECT TOP (@Limit)
         s.Id, s.Code, s.Segment, s.Name, s.Slug, p.Slug AS ProvinceSlug, d.Slug AS DistrictSlug, s.Phone, s.Street, s.BuildingNo, n.Name AS Neighborhood, d.Name AS District, p.Name AS Province,
         s.Latitude, s.Longitude, s.CoverImagePath, f.DistanceKm,
         o.IsOpen, o.OpensAt, o.ClosesAt,
         data.fn_ShopIsCertified(s.Id) AS IsCertified,
         r.AvgRating, ISNULL(r.ReviewCount, 0) AS ReviewCount,
         ISNULL(t.TodayAppointments, 0) AS TodayAppointments,  -- bugünkü randevu sayısı (Sırayı gör)
         s.IsClaimed                                 -- 0 = henüz Bermatik'e katılmadı
  FROM @Found f
  JOIN data.Shops s ON s.Id = f.Id
  JOIN data.Provinces p ON p.Id = s.ProvinceId
  JOIN data.Districts d ON d.Id = s.DistrictId
  JOIN data.Neighborhoods n ON n.Id = s.NeighborhoodId
  CROSS JOIN data.PlatformSettings ps
  CROSS APPLY data.tvf_ShopOpenStatus(s.Id) o
  OUTER APPLY (SELECT CAST(ROUND(AVG(CAST(Rating AS decimal(3, 1))), 1) AS decimal(2, 1)) AS AvgRating, COUNT(*) AS ReviewCount
               FROM data.Reviews WHERE ShopId = s.Id AND IsHidden = 0 AND ps.ReviewsEnabled = 1) r
  OUTER APPLY (SELECT COUNT(*) AS TodayAppointments FROM data.Appointments
               WHERE ShopId = s.Id AND Status IN ('pending', 'accepted', 'completed', 'no_show')
                 AND StartsAt >= @DayFrom AND StartsAt < DATEADD(day, 1, @DayFrom)) t
  ORDER BY f.DistanceKm, s.IsClaimed DESC, o.IsOpen DESC, r.AvgRating DESC, s.Name, s.Id;   -- s.Id: aynı sırada olanlar her seferinde aynı sırada gelsin
END
GO

-- SEO adresinden dükkânı bul: /erkek/istanbul/kadikoy/ahmet-usta-berber
CREATE OR ALTER PROCEDURE api.Shop_GetIdBySlug
  @Segment varchar(5), @ProvinceSlug varchar(40), @DistrictSlug varchar(60), @ShopSlug varchar(120)
AS
BEGIN
  SET NOCOUNT ON;
  SELECT s.Id
  FROM data.Shops s
  JOIN data.Provinces p ON p.Id = s.ProvinceId AND p.Slug = @ProvinceSlug
  JOIN data.Districts d ON d.Id = s.DistrictId AND d.Slug = @DistrictSlug
  WHERE s.Segment = @Segment AND s.Slug = @ShopSlug AND s.Status = 'approved';
END
GO

-- SEO il/ilçe sayfaları: /erkek/istanbul veya /erkek/istanbul/kadikoy
CREATE OR ALTER PROCEDURE api.Area_Resolve @ProvinceSlug varchar(40), @DistrictSlug varchar(60) = NULL
AS
BEGIN
  SET NOCOUNT ON;
  SELECT p.Id AS ProvinceId, p.Name AS Province, d.Id AS DistrictId, d.Name AS District
  FROM data.Provinces p
  LEFT JOIN data.Districts d ON d.ProvinceId = p.Id AND d.Slug = @DistrictSlug
  WHERE p.Slug = @ProvinceSlug AND (@DistrictSlug IS NULL OR d.Id IS NOT NULL);
END
GO

CREATE OR ALTER PROCEDURE api.Shop_ListMine @ActorId uniqueidentifier
AS
BEGIN
  SET NOCOUNT ON;
  SELECT s.Id, s.Code, s.Segment, s.Name, s.Status, s.StatusReason, CAST(1 AS bit) AS IsOwner
  FROM data.Shops s WHERE s.OwnerId = @ActorId
  UNION ALL
  SELECT s.Id, s.Code, s.Segment, s.Name, s.Status, NULL, CAST(0 AS bit)
  FROM data.Staff st JOIN data.Shops s ON s.Id = st.ShopId
  WHERE st.UserId = @ActorId AND st.IsActive = 1 AND s.OwnerId <> @ActorId
  ORDER BY Name;
END
GO

-- ---------------------------------------------------------------------
-- Çalışma saatleri
-- ---------------------------------------------------------------------
CREATE OR ALTER PROCEDURE api.ShopHours_Get @ShopId uniqueidentifier
AS
BEGIN
  SET NOCOUNT ON;
  SELECT Weekday, IsClosed, OpensAt, ClosesAt FROM data.ShopHours WHERE ShopId = @ShopId ORDER BY Weekday;
END
GO

-- @HoursJson: [{"weekday":1,"isClosed":false,"opensAt":"09:00","closesAt":"21:00"}, ...] (7 gün)
CREATE OR ALTER PROCEDURE api.ShopHours_Set @ActorId uniqueidentifier, @ShopId uniqueidentifier, @HoursJson nvarchar(max)
AS
BEGIN
  SET NOCOUNT ON; SET XACT_ABORT ON;
  IF data.fn_CanManageShop(@ActorId, @ShopId) = 0 THROW 50403, N'Bu işlem için yetkiniz yok.', 1;
  IF ISJSON(@HoursJson) = 0 THROW 50400, N'Çalışma saatleri geçersiz.', 1;

  DECLARE @Hours TABLE (Weekday tinyint PRIMARY KEY, IsClosed bit, OpensAt time(0), ClosesAt time(0));
  INSERT INTO @Hours
  SELECT Weekday, ISNULL(IsClosed, 0), OpensAt, ClosesAt
  FROM OPENJSON(@HoursJson) WITH (Weekday tinyint '$.weekday', IsClosed bit '$.isClosed',
                                  OpensAt time(0) '$.opensAt', ClosesAt time(0) '$.closesAt');
  IF (SELECT COUNT(*) FROM @Hours WHERE Weekday BETWEEN 1 AND 7) <> 7
    THROW 50400, N'Haftanın 7 günü için saat girilmeli.', 1;
  IF EXISTS (SELECT 1 FROM @Hours WHERE IsClosed = 0 AND (OpensAt IS NULL OR ClosesAt IS NULL OR OpensAt >= ClosesAt))
    THROW 50400, N'Açılış saati kapanış saatinden önce olmalı.', 1;

  BEGIN TRAN;
    DELETE FROM data.ShopHours WHERE ShopId = @ShopId;
    INSERT INTO data.ShopHours (ShopId, Weekday, IsClosed, OpensAt, ClosesAt)
    SELECT @ShopId, Weekday, IsClosed, CASE WHEN IsClosed = 0 THEN OpensAt END, CASE WHEN IsClosed = 0 THEN ClosesAt END
    FROM @Hours;
  COMMIT;
END
GO

-- ---------------------------------------------------------------------
-- Ustalık / kalfalık belgesi
-- ---------------------------------------------------------------------
CREATE OR ALTER PROCEDURE api.Certificate_Add
  @ActorId uniqueidentifier, @Type varchar(20), @SerialNo nvarchar(50), @IssuedBy nvarchar(120) = NULL, @FilePath nvarchar(300)
AS
BEGIN
  SET NOCOUNT ON;
  EXEC data.usp_RequireUser @ActorId;
  SET @SerialNo = UPPER(LTRIM(RTRIM(@SerialNo)));
  IF EXISTS (SELECT 1 FROM data.Certificates WHERE Type = @Type AND SerialNo = @SerialNo)
    THROW 50409, N'Bu seri numarasıyla kayıtlı bir belge zaten var.', 1;
  IF (SELECT COUNT(*) FROM data.Certificates WHERE UserId = @ActorId) >= 5
    THROW 50409, N'En fazla 5 belge yükleyebilirsiniz.', 1;

  DECLARE @Out TABLE (Id uniqueidentifier);
  INSERT INTO data.Certificates (UserId, Type, SerialNo, IssuedBy, FilePath)
  OUTPUT inserted.Id INTO @Out
  VALUES (@ActorId, @Type, @SerialNo, @IssuedBy, @FilePath);
  SELECT Id FROM @Out;
END
GO

CREATE OR ALTER PROCEDURE api.Certificate_ListMine @ActorId uniqueidentifier
AS
BEGIN
  SET NOCOUNT ON;
  SELECT Id, Type, SerialNo, IssuedBy, Status, ReviewNote, CreatedAt
  FROM data.Certificates WHERE UserId = @ActorId ORDER BY CreatedAt DESC;
END
GO

-- Belge dosyasını görme izni (sahibi veya admin)
CREATE OR ALTER PROCEDURE api.Certificate_GetFile @ActorId uniqueidentifier, @CertificateId uniqueidentifier
AS
BEGIN
  SET NOCOUNT ON;
  SELECT FilePath FROM data.Certificates
  WHERE Id = @CertificateId AND (UserId = @ActorId OR data.fn_IsAdmin(@ActorId) = 1);
END
GO

-- ---------------------------------------------------------------------
-- İlçe / mahalle merkez konumu (bilinmiyorsa Lat NULL döner)
-- ---------------------------------------------------------------------
CREATE OR ALTER PROCEDURE api.Area_GetCenter @DistrictId int, @NeighborhoodId int = NULL
AS
BEGIN
  SET NOCOUNT ON;
  SELECT p.Name AS Province, d.Name AS District, n.Name AS Neighborhood, n.Id AS NeighborhoodId,
         d.Latitude AS DistrictLat, d.Longitude AS DistrictLng, n.Latitude AS NeighborhoodLat, n.Longitude AS NeighborhoodLng
  FROM data.Districts d
  JOIN data.Provinces p ON p.Id = d.ProvinceId
  LEFT JOIN data.Neighborhoods n ON n.Id = @NeighborhoodId AND n.DistrictId = d.Id
  WHERE d.Id = @DistrictId;
END
GO

-- Site, Nominatim ile bulduğu merkezi kaydeder: yalnızca boşsa yazılır, Türkiye sınırları içinde olmalı
CREATE OR ALTER PROCEDURE api.Area_SetCenter @DistrictId int, @NeighborhoodId int = NULL, @Latitude decimal(9, 6), @Longitude decimal(9, 6)
AS
BEGIN
  SET NOCOUNT ON;
  IF @Latitude NOT BETWEEN 35.5 AND 42.5 OR @Longitude NOT BETWEEN 25.5 AND 45.0 THROW 50400, N'Konum Türkiye dışında.', 1;
  IF @NeighborhoodId IS NULL
    UPDATE data.Districts SET Latitude = @Latitude, Longitude = @Longitude WHERE Id = @DistrictId AND Latitude IS NULL;
  ELSE
    UPDATE data.Neighborhoods SET Latitude = @Latitude, Longitude = @Longitude
    WHERE Id = @NeighborhoodId AND DistrictId = @DistrictId AND Latitude IS NULL;
END
GO

-- Konuma en yakın mahalle (merkezi bilinenler arasından); adres eşleşmeyince yedek olarak kullanılır
CREATE OR ALTER PROCEDURE api.Area_NearestNeighborhood @DistrictId int, @Latitude decimal(9, 6), @Longitude decimal(9, 6)
AS
BEGIN
  SET NOCOUNT ON;
  SELECT TOP (1) Id, Name
  FROM data.Neighborhoods
  WHERE DistrictId = @DistrictId AND Latitude IS NOT NULL
  ORDER BY SQUARE(Latitude - @Latitude) + SQUARE((Longitude - @Longitude) * COS(RADIANS(@Latitude)));
END
GO
