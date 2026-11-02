-- =====================================================================
-- Bermatik — Yardımcı fonksiyonlar (data şeması; site doğrudan çağıramaz)
-- Hata kodları: 50400 geçersiz istek, 50401 giriş gerekli, 50403 yetki yok,
--               50404 bulunamadı, 50409 çakışma / kural ihlali
-- =====================================================================

-- Türkiye saati (UTC+3)
CREATE OR ALTER FUNCTION data.fn_IstanbulNow()
RETURNS datetime2(0) AS
BEGIN
  RETURN CONVERT(datetime2(0), SYSUTCDATETIME() AT TIME ZONE 'UTC' AT TIME ZONE 'Turkey Standard Time');
END
GO

CREATE OR ALTER FUNCTION data.fn_ToIstanbul(@Utc datetime2(0))
RETURNS datetime2(0) AS
BEGIN
  RETURN CONVERT(datetime2(0), @Utc AT TIME ZONE 'UTC' AT TIME ZONE 'Turkey Standard Time');
END
GO

CREATE OR ALTER FUNCTION data.fn_ToUtc(@Local datetime2(0))
RETURNS datetime2(0) AS
BEGIN
  RETURN CONVERT(datetime2(0), @Local AT TIME ZONE 'Turkey Standard Time' AT TIME ZONE 'UTC');
END
GO

-- "0555 111 22 33" → "05551112233"; geçersizse NULL
CREATE OR ALTER FUNCTION data.fn_NormalizePhone(@Phone nvarchar(40))
RETURNS varchar(16) AS
BEGIN
  DECLARE @p nvarchar(40) = REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(LTRIM(RTRIM(@Phone)), ' ', ''), '-', ''), '(', ''), ')', ''), '.', '');
  IF @p IS NULL OR @p LIKE '%[^0-9+]%' OR LEN(@p) NOT BETWEEN 10 AND 16 RETURN NULL;
  RETURN CONVERT(varchar(16), @p);
END
GO

-- "Ahmet Usta Berber & Kuaför" → "ahmet-usta-berber-kuafor" (Google için sayfa adresi)
CREATE OR ALTER FUNCTION data.fn_Slugify(@Text nvarchar(200))
RETURNS varchar(120) AS
BEGIN
  DECLARE @s nvarchar(200) = LOWER(TRANSLATE(LTRIM(RTRIM(@Text)) COLLATE Turkish_CS_AS,
                                             N'çÇğĞıIİöÖşŞüÜâÂîÎûÛ', N'ccggiiioossuuaaiiuu'));
  SET @s = LOWER(@s COLLATE Latin1_General_CI_AS);
  DECLARE @out varchar(200) = '', @i int = 1, @c nchar(1), @dash bit = 0;
  WHILE @i <= LEN(@s)
  BEGIN
    SET @c = SUBSTRING(@s, @i, 1);
    IF @c COLLATE Latin1_General_BIN LIKE '[a-z0-9]'
    BEGIN
      IF @dash = 1 AND LEN(@out) > 0 SET @out += '-';
      SET @out += CONVERT(varchar(1), @c);
      SET @dash = 0;
    END
    ELSE SET @dash = 1;
    SET @i += 1;
  END
  RETURN LEFT(CASE WHEN @out = '' THEN 'dukkan' ELSE @out END, 100);
END
GO

-- İlçe içinde benzersiz dükkân adresi: ahmet-usta, ahmet-usta-2, ...
CREATE OR ALTER FUNCTION data.fn_UniqueShopSlug(@DistrictId int, @Name nvarchar(100), @ExcludeShopId uniqueidentifier)
RETURNS varchar(120) AS
BEGIN
  DECLARE @base varchar(120) = data.fn_Slugify(@Name), @slug varchar(120), @n int = 1;
  SET @slug = @base;
  WHILE EXISTS (SELECT 1 FROM data.Shops WHERE DistrictId = @DistrictId AND Slug = @slug
                AND (@ExcludeShopId IS NULL OR Id <> @ExcludeShopId))
  BEGIN
    SET @n += 1;
    SET @slug = @base + '-' + CAST(@n AS varchar(10));
  END
  RETURN @slug;
END
GO

CREATE OR ALTER FUNCTION data.fn_IsAdmin(@UserId uniqueidentifier)
RETURNS bit AS
BEGIN
  RETURN CASE WHEN EXISTS (SELECT 1 FROM data.Users WHERE Id = @UserId AND Role = 'admin' AND IsActive = 1) THEN 1 ELSE 0 END;
END
GO

CREATE OR ALTER FUNCTION data.fn_IsShopOwner(@UserId uniqueidentifier, @ShopId uniqueidentifier)
RETURNS bit AS
BEGIN
  RETURN CASE WHEN EXISTS (SELECT 1 FROM data.Shops WHERE Id = @ShopId AND OwnerId = @UserId) THEN 1 ELSE 0 END;
END
GO

-- Dükkân sahibi veya o dükkânda aktif personel
CREATE OR ALTER FUNCTION data.fn_IsShopMember(@UserId uniqueidentifier, @ShopId uniqueidentifier)
RETURNS bit AS
BEGIN
  RETURN CASE WHEN EXISTS (SELECT 1 FROM data.Shops WHERE Id = @ShopId AND OwnerId = @UserId)
                OR EXISTS (SELECT 1 FROM data.Staff WHERE ShopId = @ShopId AND UserId = @UserId AND IsActive = 1)
              THEN 1 ELSE 0 END;
END
GO

-- Dükkânın günlük işleri (randevu, sıra, telefonla randevu): sahip, personel veya admin
CREATE OR ALTER FUNCTION data.fn_CanWorkShop(@UserId uniqueidentifier, @ShopId uniqueidentifier)
RETURNS bit AS
BEGIN
  RETURN CASE WHEN data.fn_IsShopMember(@UserId, @ShopId) = 1 OR data.fn_IsAdmin(@UserId) = 1 THEN 1 ELSE 0 END;
END
GO

CREATE OR ALTER FUNCTION data.fn_ShopIsPublic(@ShopId uniqueidentifier)
RETURNS bit AS
BEGIN
  RETURN CASE WHEN EXISTS (SELECT 1 FROM data.Shops WHERE Id = @ShopId AND Status = 'approved') THEN 1 ELSE 0 END;
END
GO

-- Ürün satışı hem platformda hem dükkânda açık mı?
CREATE OR ALTER FUNCTION data.fn_StoreEnabledFor(@ShopId uniqueidentifier)
RETURNS bit AS
BEGIN
  RETURN CASE WHEN EXISTS (SELECT 1 FROM data.PlatformSettings WHERE StoreEnabled = 1)
               AND EXISTS (SELECT 1 FROM data.Shops WHERE Id = @ShopId AND Status = 'approved' AND StoreEnabled = 1)
              THEN 1 ELSE 0 END;
END
GO

-- Dükkân sahibinin onaylı belgesi var mı?
CREATE OR ALTER FUNCTION data.fn_ShopIsCertified(@ShopId uniqueidentifier)
RETURNS bit AS
BEGIN
  RETURN CASE WHEN EXISTS (SELECT 1 FROM data.Shops s
                           JOIN data.Certificates c ON c.UserId = s.OwnerId AND c.Status = 'verified'
                           WHERE s.Id = @ShopId)
              THEN 1 ELSE 0 END;
END
GO

-- Açık / Kapalı rozeti: "Şu an Açık – Kapanış 23:00" veya "Bugün kapalı: Bayram tatili"
CREATE OR ALTER FUNCTION data.tvf_ShopOpenStatus(@ShopId uniqueidentifier)
RETURNS TABLE AS RETURN
  WITH n AS (SELECT data.fn_IstanbulNow() AS Ts)
  SELECT
    CAST(CASE WHEN s.IsTemporarilyClosed = 0 AND h.IsClosed = 0 AND cl.Id IS NULL
                   AND CAST(n.Ts AS time(0)) >= h.OpensAt AND CAST(n.Ts AS time(0)) < h.ClosesAt
              THEN 1 ELSE 0 END AS bit) AS IsOpen,
    h.OpensAt,
    h.ClosesAt,
    cl.Reason AS ClosedReason,
    cl.EndDate AS ClosedUntil
  FROM data.Shops s
  CROSS JOIN n
  LEFT JOIN data.ShopHours h
    ON h.ShopId = s.Id
   AND h.Weekday = (DATEDIFF(day, '19000101', CAST(n.Ts AS date)) % 7) + 1   -- 1900-01-01 Pazartesi
  OUTER APPLY (SELECT TOP (1) Id, Reason, EndDate FROM data.ShopClosures
               WHERE ShopId = s.Id AND CAST(n.Ts AS date) BETWEEN StartDate AND EndDate ORDER BY EndDate DESC) cl
  WHERE s.Id = @ShopId;
GO

-- Personel o gün çalışıyor mu? (dükkân özel kapalı günü, haftalık izin, tatil)
CREATE OR ALTER FUNCTION data.fn_StaffWorksOn(@StaffId uniqueidentifier, @Date date)
RETURNS bit AS
BEGIN
  DECLARE @ShopId uniqueidentifier = (SELECT ShopId FROM data.Staff WHERE Id = @StaffId AND IsActive = 1);
  IF @ShopId IS NULL RETURN 0;
  IF EXISTS (SELECT 1 FROM data.ShopClosures WHERE ShopId = @ShopId AND @Date BETWEEN StartDate AND EndDate) RETURN 0;
  IF EXISTS (SELECT 1 FROM data.StaffDaysOff WHERE StaffId = @StaffId
             AND (Weekday = (DATEDIFF(day, '19000101', @Date) % 7) + 1 OR @Date BETWEEN StartDate AND EndDate)) RETURN 0;
  RETURN 1;
END
GO

-- İki nokta arası km (Haversine)
CREATE OR ALTER FUNCTION data.fn_DistanceKm(@Lat1 float, @Lng1 float, @Lat2 float, @Lng2 float)
RETURNS float AS
BEGIN
  RETURN 6371.0 * 2 * ASIN(SQRT(
    POWER(SIN(RADIANS(@Lat2 - @Lat1) / 2), 2)
    + COS(RADIANS(@Lat1)) * COS(RADIANS(@Lat2)) * POWER(SIN(RADIANS(@Lng2 - @Lng1) / 2), 2)));
END
GO

CREATE OR ALTER PROCEDURE data.usp_RequireUser @ActorId uniqueidentifier
AS
BEGIN
  SET NOCOUNT ON;
  IF @ActorId IS NULL OR NOT EXISTS (SELECT 1 FROM data.Users WHERE Id = @ActorId AND IsActive = 1)
    THROW 50401, N'Bu işlem için giriş yapmalısınız.', 1;
END
GO

CREATE OR ALTER PROCEDURE data.usp_RequireAdmin @ActorId uniqueidentifier
AS
BEGIN
  SET NOCOUNT ON;
  IF data.fn_IsAdmin(@ActorId) = 0
    THROW 50403, N'Bu işlem için yetkiniz yok.', 1;
END
GO

CREATE OR ALTER PROCEDURE data.usp_Log
  @ActorId uniqueidentifier, @Action varchar(40), @Entity varchar(40), @EntityId nvarchar(64), @Details nvarchar(max)
AS
BEGIN
  SET NOCOUNT ON;
  INSERT INTO data.AuditLog (ActorId, Action, Entity, EntityId, Details)
  VALUES (@ActorId, @Action, @Entity, @EntityId, @Details);
END
GO

-- Sıra özetini yeniler (her sıra değişikliğinden sonra çağrılır)
CREATE OR ALTER PROCEDURE data.usp_RefreshQueueState @ShopId uniqueidentifier
AS
BEGIN
  SET NOCOUNT ON;
  DECLARE @Today date = CAST(data.fn_IstanbulNow() AS date);
  DECLARE @Current int = (SELECT MAX(TicketNo) FROM data.QueueEntries
                          WHERE ShopId = @ShopId AND QueueDate = @Today AND Status IN ('serving', 'done', 'no_show'));
  DECLARE @Waiting int = (SELECT COUNT(*) FROM data.QueueEntries
                          WHERE ShopId = @ShopId AND QueueDate = @Today AND Status = 'waiting');

  UPDATE data.ShopQueueState
  SET QueueDate = @Today, CurrentTicket = @Current, WaitingCount = @Waiting, Version = Version + 1, UpdatedAt = SYSUTCDATETIME()
  WHERE ShopId = @ShopId;
  IF @@ROWCOUNT = 0
    INSERT INTO data.ShopQueueState (ShopId, QueueDate, CurrentTicket, WaitingCount, Version)
    VALUES (@ShopId, @Today, @Current, @Waiting, 1);
END
GO

-- Dükkânı yönetebilir mi? (sahibi veya admin) — bilgi, saat, hizmet, personel, kapalı gün düzenleme
CREATE OR ALTER FUNCTION data.fn_CanManageShop(@UserId uniqueidentifier, @ShopId uniqueidentifier)
RETURNS bit AS
BEGIN
  RETURN CASE WHEN data.fn_IsShopOwner(@UserId, @ShopId) = 1 OR data.fn_IsAdmin(@UserId) = 1 THEN 1 ELSE 0 END;
END
GO

-- Katılmamış dükkânların sahibi olan sistem hesabı
CREATE OR ALTER FUNCTION data.fn_SystemUserId()
RETURNS uniqueidentifier AS
BEGIN
  RETURN (SELECT Id FROM data.Users WHERE Email = 'sistem@bermatik.local');
END
GO

-- Dükkân kodu: BRM-E-0001 … BRM-E-9999, sonra BRM-E-10000 … (en fazla 12 karakter, 999.999'a kadar)
CREATE OR ALTER FUNCTION data.fn_ShopCode(@Segment varchar(5), @Seq int)
RETURNS varchar(12) AS
BEGIN
  RETURN 'BRM-' + CASE @Segment WHEN 'erkek' THEN 'E' ELSE 'K' END + '-'
       + CASE WHEN @Seq < 10000 THEN RIGHT('0000' + CAST(@Seq AS varchar(10)), 4) ELSE CAST(@Seq AS varchar(10)) END;
END
GO
