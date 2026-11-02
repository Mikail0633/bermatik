-- =====================================================================
-- Bermatik — Ek özellikler
--   Personel mola/izin · Dükkân kapalı günleri · Randevu hatırlatma
--   Favoriler + tekrar randevu · Çalışma fotoğrafları · Şikayetler
--   Dükkân ve platform istatistikleri
-- =====================================================================

-- ---------------------------------------------------------------------
-- Personel çalışma düzeni (personel kendisi veya dükkân sahibi ayarlar)
-- ---------------------------------------------------------------------
CREATE OR ALTER PROCEDURE api.Staff_Schedule @StaffId uniqueidentifier
AS
BEGIN
  SET NOCOUNT ON;
  -- Molalar ve izinler tek listede: Kind = 'break' | 'weekly_off' | 'leave'
  SELECT 'break' AS Kind, Id, Weekday, StartTime, EndTime, CAST(NULL AS date) AS StartDate, CAST(NULL AS date) AS EndDate, CAST(NULL AS nvarchar(100)) AS Note
  FROM data.StaffBreaks WHERE StaffId = @StaffId
  UNION ALL
  SELECT CASE WHEN Weekday IS NOT NULL THEN 'weekly_off' ELSE 'leave' END, Id, Weekday, NULL, NULL, StartDate, EndDate, Note
  FROM data.StaffDaysOff WHERE StaffId = @StaffId AND (EndDate IS NULL OR EndDate >= CAST(data.fn_IstanbulNow() AS date))
  ORDER BY Kind, Weekday, StartDate, StartTime;
END
GO

-- Molaları topluca kaydet. @BreaksJson: [{"weekday":null,"start":"13:00","end":"14:00"}, ...]  (weekday null = her gün)
CREATE OR ALTER PROCEDURE api.Staff_SetBreaks @ActorId uniqueidentifier, @StaffId uniqueidentifier, @BreaksJson nvarchar(max)
AS
BEGIN
  SET NOCOUNT ON; SET XACT_ABORT ON;
  IF data.fn_CanEditStaff(@ActorId, @StaffId) = 0 THROW 50403, N'Bu işlem için yetkiniz yok.', 1;
  IF ISJSON(@BreaksJson) = 0 THROW 50400, N'Mola listesi geçersiz.', 1;
  DECLARE @B TABLE (Weekday tinyint, StartTime time(0), EndTime time(0));
  INSERT INTO @B SELECT Weekday, StartTime, EndTime
  FROM OPENJSON(@BreaksJson) WITH (Weekday tinyint '$.weekday', StartTime time(0) '$.start', EndTime time(0) '$.end');
  IF (SELECT COUNT(*) FROM @B) > 20 THROW 50400, N'En fazla 20 mola eklenebilir.', 1;
  IF EXISTS (SELECT 1 FROM @B WHERE StartTime IS NULL OR EndTime IS NULL OR StartTime >= EndTime OR (Weekday IS NOT NULL AND Weekday NOT BETWEEN 1 AND 7))
    THROW 50400, N'Mola başlangıcı bitişinden önce olmalı.', 1;
  BEGIN TRAN;
    DELETE FROM data.StaffBreaks WHERE StaffId = @StaffId;
    INSERT INTO data.StaffBreaks (StaffId, Weekday, StartTime, EndTime) SELECT @StaffId, Weekday, StartTime, EndTime FROM @B;
  COMMIT;
END
GO

-- İzin ekle: haftalık izin günü (@Weekday) VEYA tarih aralığı (@StartDate–@EndDate)
-- O günlerde zaten alınmış randevu sayısı döner (personel müşterilerini arayabilsin diye)
CREATE OR ALTER PROCEDURE api.Staff_AddDayOff
  @ActorId uniqueidentifier, @StaffId uniqueidentifier, @Weekday tinyint = NULL,
  @StartDate date = NULL, @EndDate date = NULL, @Note nvarchar(100) = NULL
AS
BEGIN
  SET NOCOUNT ON;
  IF data.fn_CanEditStaff(@ActorId, @StaffId) = 0 THROW 50403, N'Bu işlem için yetkiniz yok.', 1;
  IF NOT ((@Weekday BETWEEN 1 AND 7 AND @StartDate IS NULL AND @EndDate IS NULL)
       OR (@Weekday IS NULL AND @StartDate IS NOT NULL AND @EndDate IS NOT NULL AND @StartDate <= @EndDate))
    THROW 50400, N'Bir gün seçin ya da başlangıç ve bitiş tarihi girin.', 1;
  IF @EndDate > DATEADD(year, 1, CAST(data.fn_IstanbulNow() AS date)) THROW 50400, N'İzin en fazla 1 yıl sonrasına girilebilir.', 1;

  DECLARE @Out TABLE (Id uniqueidentifier);
  INSERT INTO data.StaffDaysOff (StaffId, Weekday, StartDate, EndDate, Note)
  OUTPUT inserted.Id INTO @Out
  VALUES (@StaffId, @Weekday, @StartDate, @EndDate, @Note);

  SELECT (SELECT Id FROM @Out) AS Id,
         (SELECT COUNT(*) FROM data.Appointments a
          WHERE a.StaffId = @StaffId AND a.Status IN ('pending', 'accepted') AND a.StartsAt > SYSUTCDATETIME()
            AND ((@Weekday IS NOT NULL AND (DATEDIFF(day, '19000101', CAST(data.fn_ToIstanbul(a.StartsAt) AS date)) % 7) + 1 = @Weekday)
              OR (@Weekday IS NULL AND CAST(data.fn_ToIstanbul(a.StartsAt) AS date) BETWEEN @StartDate AND @EndDate))) AS ConflictingAppointments;
END
GO

CREATE OR ALTER PROCEDURE api.Staff_RemoveDayOff @ActorId uniqueidentifier, @DayOffId uniqueidentifier
AS
BEGIN
  SET NOCOUNT ON;
  DECLARE @StaffId uniqueidentifier = (SELECT StaffId FROM data.StaffDaysOff WHERE Id = @DayOffId);
  IF @StaffId IS NULL OR data.fn_CanEditStaff(@ActorId, @StaffId) = 0 THROW 50403, N'Bu işlem için yetkiniz yok.', 1;
  DELETE FROM data.StaffDaysOff WHERE Id = @DayOffId;
END
GO

-- ---------------------------------------------------------------------
-- Dükkân özel kapalı günleri (yalnızca dükkân sahibi)
-- ---------------------------------------------------------------------
CREATE OR ALTER PROCEDURE api.ShopClosure_List @ShopId uniqueidentifier
AS
BEGIN
  SET NOCOUNT ON;
  SELECT Id, StartDate, EndDate, Reason FROM data.ShopClosures
  WHERE ShopId = @ShopId AND EndDate >= CAST(data.fn_IstanbulNow() AS date)
  ORDER BY StartDate;
END
GO

CREATE OR ALTER PROCEDURE api.ShopClosure_Add
  @ActorId uniqueidentifier, @ShopId uniqueidentifier, @StartDate date, @EndDate date, @Reason nvarchar(100) = NULL
AS
BEGIN
  SET NOCOUNT ON;
  IF data.fn_CanManageShop(@ActorId, @ShopId) = 0 THROW 50403, N'Bu işlem için yetkiniz yok.', 1;
  IF @StartDate IS NULL OR @EndDate IS NULL OR @StartDate > @EndDate THROW 50400, N'Başlangıç tarihi bitişten önce olmalı.', 1;
  IF DATEDIFF(day, @StartDate, @EndDate) > 90 THROW 50400, N'Kapalı dönem en fazla 90 gün olabilir.', 1;
  DECLARE @Out TABLE (Id uniqueidentifier);
  INSERT INTO data.ShopClosures (ShopId, StartDate, EndDate, Reason) OUTPUT inserted.Id INTO @Out
  VALUES (@ShopId, @StartDate, @EndDate, NULLIF(LTRIM(RTRIM(@Reason)), N''));
  -- O günlere alınmış randevular (sahip müşterileri arayıp iptal edebilsin)
  SELECT (SELECT Id FROM @Out) AS Id,
         (SELECT COUNT(*) FROM data.Appointments
          WHERE ShopId = @ShopId AND Status IN ('pending', 'accepted')
            AND CAST(data.fn_ToIstanbul(StartsAt) AS date) BETWEEN @StartDate AND @EndDate) AS ConflictingAppointments;
END
GO

CREATE OR ALTER PROCEDURE api.ShopClosure_Remove @ActorId uniqueidentifier, @ClosureId uniqueidentifier
AS
BEGIN
  SET NOCOUNT ON;
  DECLARE @ShopId uniqueidentifier = (SELECT ShopId FROM data.ShopClosures WHERE Id = @ClosureId);
  IF @ShopId IS NULL OR data.fn_CanManageShop(@ActorId, @ShopId) = 0 THROW 50403, N'Bu işlem için yetkiniz yok.', 1;
  DELETE FROM data.ShopClosures WHERE Id = @ClosureId;
END
GO

-- ---------------------------------------------------------------------
-- Randevu hatırlatma (gönderim görevi birkaç dakikada bir çağırır)
--   • 1 gün kala (23–25 saat arası)   • 2 saat kala (1,5–2,5 saat arası)
-- Her randevuya her hatırlatma bir kez gider.
-- ---------------------------------------------------------------------
CREATE OR ALTER PROCEDURE api.Worker_EnqueueReminders
AS
BEGIN
  SET NOCOUNT ON; SET XACT_ABORT ON;
  DECLARE @Now datetime2(0) = SYSUTCDATETIME();
  DECLARE @Due TABLE (Id uniqueidentifier PRIMARY KEY, Which char(3));

  BEGIN TRAN;
    UPDATE data.Appointments WITH (UPDLOCK, READPAST) SET Reminder24hSentAt = @Now
    OUTPUT inserted.Id, '24h' INTO @Due
    WHERE Status = 'accepted' AND CustomerId IS NOT NULL AND Reminder24hSentAt IS NULL
      AND StartsAt BETWEEN DATEADD(hour, 23, @Now) AND DATEADD(hour, 25, @Now);

    UPDATE data.Appointments WITH (UPDLOCK, READPAST) SET Reminder2hSentAt = @Now
    OUTPUT inserted.Id, '2h ' INTO @Due
    WHERE Status = 'accepted' AND CustomerId IS NOT NULL AND Reminder2hSentAt IS NULL
      AND StartsAt BETWEEN DATEADD(minute, 90, @Now) AND DATEADD(minute, 150, @Now)
      AND Id NOT IN (SELECT Id FROM @Due);

    INSERT INTO data.Notifications (UserId, Kind, Title, Body, Url, AppointmentId, PushStatus)
    SELECT a.CustomerId, 'appointment_reminder',
           CASE d.Which WHEN '24h' THEN N'Yarın randevun var' ELSE N'Randevuna 2 saat kaldı' END,
           s.Name + N' – ' + FORMAT(data.fn_ToIstanbul(a.StartsAt), 'dd.MM HH:mm') + N', ' + st.DisplayName
             + N'. Gelemeyeceksen lütfen iptal et, başkası yararlansın.',
           N'/randevularim', a.Id,
           CASE WHEN u.PushOptIn = 1 AND EXISTS (SELECT 1 FROM data.PushSubscriptions WHERE UserId = u.Id) THEN 'queued' END
    FROM @Due d
    JOIN data.Appointments a ON a.Id = d.Id
    JOIN data.Shops s ON s.Id = a.ShopId
    JOIN data.Staff st ON st.Id = a.StaffId
    JOIN data.Users u ON u.Id = a.CustomerId AND u.IsActive = 1;
  COMMIT;
  SELECT COUNT(*) AS Enqueued FROM @Due;
END
GO

-- ---------------------------------------------------------------------
-- Favoriler ve "geçen seferki gibi" tekrar randevu
-- ---------------------------------------------------------------------
-- Favoriye ekle/çıkar; yeni durumu döner (1 = favoride)
CREATE OR ALTER PROCEDURE api.Favorite_Toggle @ActorId uniqueidentifier, @ShopId uniqueidentifier
AS
BEGIN
  SET NOCOUNT ON;
  EXEC data.usp_RequireUser @ActorId;
  IF EXISTS (SELECT 1 FROM data.Favorites WHERE UserId = @ActorId AND ShopId = @ShopId)
  BEGIN
    DELETE FROM data.Favorites WHERE UserId = @ActorId AND ShopId = @ShopId;
    SELECT CAST(0 AS bit) AS IsFavorite;
  END
  ELSE
  BEGIN
    IF data.fn_ShopIsPublic(@ShopId) = 0 THROW 50404, N'Dükkân bulunamadı.', 1;
    IF (SELECT COUNT(*) FROM data.Favorites WHERE UserId = @ActorId) >= 50 THROW 50409, N'En fazla 50 favori ekleyebilirsiniz.', 1;
    INSERT INTO data.Favorites (UserId, ShopId) VALUES (@ActorId, @ShopId);
    SELECT CAST(1 AS bit) AS IsFavorite;
  END
END
GO

CREATE OR ALTER PROCEDURE api.Favorite_ListMine @ActorId uniqueidentifier
AS
BEGIN
  SET NOCOUNT ON;
  SELECT s.Id, s.Code, s.Segment, s.Name, s.Slug, p.Slug AS ProvinceSlug, d.Slug AS DistrictSlug,
         d.Name AS District, p.Name AS Province, s.Phone, s.CoverImagePath, o.IsOpen, o.ClosesAt
  FROM data.Favorites f
  JOIN data.Shops s ON s.Id = f.ShopId AND s.Status = 'approved'
  JOIN data.Provinces p ON p.Id = s.ProvinceId JOIN data.Districts d ON d.Id = s.DistrictId
  CROSS APPLY data.tvf_ShopOpenStatus(s.Id) o
  WHERE f.UserId = @ActorId
  ORDER BY f.CreatedAt DESC;
END
GO

-- Tekrar randevu: önceki randevunun dükkânı, personeli ve hâlâ sunulan hizmetleri
CREATE OR ALTER PROCEDURE api.Appointment_RebookInfo @ActorId uniqueidentifier, @AppointmentId uniqueidentifier
AS
BEGIN
  SET NOCOUNT ON;
  SELECT a.ShopId, s.Name AS ShopName,
         CASE WHEN st.IsActive = 1 THEN a.StaffId END AS StaffId, st.DisplayName AS StaffName,
         (SELECT JSON_QUERY(N'[' + STRING_AGG(N'"' + CONVERT(nvarchar(36), ss.Id) + N'"', N',') + N']')
          FROM data.AppointmentServices aps JOIN data.ShopServices ss ON ss.Id = aps.ShopServiceId AND ss.IsActive = 1
          WHERE aps.AppointmentId = a.Id) AS ServiceIdsJson
  FROM data.Appointments a
  JOIN data.Shops s ON s.Id = a.ShopId AND s.Status = 'approved'
  JOIN data.Staff st ON st.Id = a.StaffId
  WHERE a.Id = @AppointmentId AND a.CustomerId = @ActorId;
END
GO

-- ---------------------------------------------------------------------
-- Çalışma fotoğrafları (galeri)
-- Dükkân sahibi her fotoğrafı, personel yalnızca kendi çalışmalarını ekler/siler.
-- Admin gizleyebilir. Dükkân başına en fazla 60 fotoğraf.
-- ---------------------------------------------------------------------
CREATE OR ALTER PROCEDURE api.Gallery_List @ShopId uniqueidentifier, @StaffId uniqueidentifier = NULL, @ActorId uniqueidentifier = NULL
AS
BEGIN
  SET NOCOUNT ON;
  DECLARE @CanSeeHidden bit = CASE WHEN data.fn_IsShopMember(@ActorId, @ShopId) = 1 OR data.fn_IsAdmin(@ActorId) = 1 THEN 1 ELSE 0 END;
  IF data.fn_ShopIsPublic(@ShopId) = 0 AND @CanSeeHidden = 0 RETURN;
  SELECT g.Id, g.Path, g.Caption, g.StaffId, st.DisplayName AS StaffName, g.IsHidden, data.fn_ToIstanbul(g.CreatedAt) AS CreatedAtLocal
  FROM data.ShopGallery g LEFT JOIN data.Staff st ON st.Id = g.StaffId
  WHERE g.ShopId = @ShopId AND (@StaffId IS NULL OR g.StaffId = @StaffId) AND (g.IsHidden = 0 OR @CanSeeHidden = 1)
  ORDER BY g.CreatedAt DESC;
END
GO

CREATE OR ALTER PROCEDURE api.Gallery_Add
  @ActorId uniqueidentifier, @ShopId uniqueidentifier, @Path nvarchar(300), @Caption nvarchar(150) = NULL, @StaffId uniqueidentifier = NULL
AS
BEGIN
  SET NOCOUNT ON;
  DECLARE @IsOwner bit = data.fn_CanManageShop(@ActorId, @ShopId);   -- sahip veya admin
  DECLARE @MyStaffId uniqueidentifier = (SELECT Id FROM data.Staff WHERE ShopId = @ShopId AND UserId = @ActorId AND IsActive = 1);
  IF @IsOwner = 0 AND @MyStaffId IS NULL THROW 50403, N'Bu işlem için yetkiniz yok.', 1;
  IF @IsOwner = 0 SET @StaffId = @MyStaffId;   -- personel yalnızca kendi adına ekler
  IF @StaffId IS NOT NULL AND NOT EXISTS (SELECT 1 FROM data.Staff WHERE Id = @StaffId AND ShopId = @ShopId)
    THROW 50404, N'Personel bulunamadı.', 1;
  IF NULLIF(LTRIM(RTRIM(@Path)), N'') IS NULL THROW 50400, N'Fotoğraf yolu boş olamaz.', 1;
  IF (SELECT COUNT(*) FROM data.ShopGallery WHERE ShopId = @ShopId) >= 60 THROW 50409, N'Galeride en fazla 60 fotoğraf olabilir.', 1;
  DECLARE @Out TABLE (Id uniqueidentifier);
  INSERT INTO data.ShopGallery (ShopId, StaffId, Path, Caption, UploadedBy) OUTPUT inserted.Id INTO @Out
  VALUES (@ShopId, @StaffId, @Path, NULLIF(LTRIM(RTRIM(@Caption)), N''), @ActorId);
  SELECT Id FROM @Out;
END
GO

-- Silinen dosyanın yolu döner (site dosyayı diskten de siler)
CREATE OR ALTER PROCEDURE api.Gallery_Remove @ActorId uniqueidentifier, @PhotoId uniqueidentifier
AS
BEGIN
  SET NOCOUNT ON; SET XACT_ABORT ON;
  DECLARE @ShopId uniqueidentifier, @StaffId uniqueidentifier, @Path nvarchar(300);
  SELECT @ShopId = ShopId, @StaffId = StaffId, @Path = Path FROM data.ShopGallery WHERE Id = @PhotoId;
  IF @ShopId IS NULL THROW 50404, N'Fotoğraf bulunamadı.', 1;
  DECLARE @IsAdmin bit = data.fn_IsAdmin(@ActorId);
  IF data.fn_IsShopOwner(@ActorId, @ShopId) = 0 AND @IsAdmin = 0
     AND NOT EXISTS (SELECT 1 FROM data.Staff WHERE Id = @StaffId AND UserId = @ActorId)
    THROW 50403, N'Bu işlem için yetkiniz yok.', 1;
  BEGIN TRAN;
    DELETE FROM data.ShopGallery WHERE Id = @PhotoId;
    IF @IsAdmin = 1 AND data.fn_IsShopMember(@ActorId, @ShopId) = 0
    BEGIN
      DECLARE @EntityId nvarchar(64) = CONVERT(nvarchar(64), @PhotoId);
      DECLARE @Details nvarchar(max) = (SELECT @ShopId AS shopId FOR JSON PATH, WITHOUT_ARRAY_WRAPPER);
      EXEC data.usp_Log @ActorId, 'gallery_remove', 'shop_gallery', @EntityId, @Details;
    END
  COMMIT;
  SELECT @Path AS Path;
END
GO

CREATE OR ALTER PROCEDURE api.Admin_Gallery_SetHidden @ActorId uniqueidentifier, @PhotoId uniqueidentifier, @Hidden bit
AS
BEGIN
  SET NOCOUNT ON; SET XACT_ABORT ON;
  EXEC data.usp_RequireAdmin @ActorId;
  BEGIN TRAN;
    UPDATE data.ShopGallery SET IsHidden = @Hidden WHERE Id = @PhotoId;
    IF @@ROWCOUNT = 0 THROW 50404, N'Fotoğraf bulunamadı.', 1;
    DECLARE @EntityId nvarchar(64) = CONVERT(nvarchar(64), @PhotoId);
    DECLARE @Details nvarchar(max) = (SELECT @Hidden AS hidden FOR JSON PATH, WITHOUT_ARRAY_WRAPPER);
    EXEC data.usp_Log @ActorId, 'gallery_hidden', 'shop_gallery', @EntityId, @Details;
  COMMIT;
END
GO

-- ---------------------------------------------------------------------
-- Şikayet / bildir
-- Bir kişi günde en fazla 10 şikayet gönderebilir.
-- ---------------------------------------------------------------------
CREATE OR ALTER PROCEDURE api.Report_Create
  @ActorId uniqueidentifier, @TargetType varchar(10), @TargetId uniqueidentifier, @Reason varchar(16), @Note nvarchar(500) = NULL
AS
BEGIN
  SET NOCOUNT ON;
  EXEC data.usp_RequireUser @ActorId;
  IF @TargetType NOT IN ('shop', 'review', 'photo', 'product', 'user') THROW 50400, N'Bildirim türü geçersiz.', 1;
  IF @Reason NOT IN ('spam', 'uygunsuz', 'sahte', 'dolandiricilik', 'diger') THROW 50400, N'Bildirim nedeni geçersiz.', 1;
  IF NOT EXISTS (
       SELECT 1 FROM data.Shops WHERE @TargetType = 'shop' AND Id = @TargetId
       UNION ALL SELECT 1 FROM data.Reviews WHERE @TargetType = 'review' AND Id = @TargetId
       UNION ALL SELECT 1 FROM data.ShopGallery WHERE @TargetType = 'photo' AND Id = @TargetId
       UNION ALL SELECT 1 FROM data.Products WHERE @TargetType = 'product' AND Id = @TargetId
       UNION ALL SELECT 1 FROM data.Users WHERE @TargetType = 'user' AND Id = @TargetId)
    THROW 50404, N'Bildirilen içerik bulunamadı.', 1;
  IF (SELECT COUNT(*) FROM data.Reports WHERE ReporterId = @ActorId AND CreatedAt > DATEADD(day, -1, SYSUTCDATETIME())) >= 10
    THROW 50409, N'Bugün için bildirim sınırına ulaştınız.', 1;
  IF EXISTS (SELECT 1 FROM data.Reports WHERE ReporterId = @ActorId AND TargetType = @TargetType AND TargetId = @TargetId AND Status = 'open')
    THROW 50409, N'Bunu zaten bildirdiniz, inceleniyor.', 1;
  DECLARE @Out TABLE (Id uniqueidentifier);
  INSERT INTO data.Reports (ReporterId, TargetType, TargetId, Reason, Note) OUTPUT inserted.Id INTO @Out
  VALUES (@ActorId, @TargetType, @TargetId, @Reason, NULLIF(LTRIM(RTRIM(@Note)), N''));
  SELECT Id FROM @Out;
END
GO

CREATE OR ALTER PROCEDURE api.Admin_Report_List @ActorId uniqueidentifier, @Status varchar(10) = 'open'
AS
BEGIN
  SET NOCOUNT ON;
  EXEC data.usp_RequireAdmin @ActorId;
  SELECT TOP (300) r.Id, r.TargetType, r.TargetId, r.Reason, r.Note, r.Status, r.ResolutionNote,
         data.fn_ToIstanbul(r.CreatedAt) AS CreatedAtLocal,
         u.FirstName + N' ' + u.LastName AS ReporterName, u.Email AS ReporterEmail,
         -- Bildirilen içeriğin kısa özeti
         COALESCE(
           (SELECT s.Code + N' ' + s.Name FROM data.Shops s WHERE r.TargetType = 'shop' AND s.Id = r.TargetId),
           (SELECT CONCAT(rv.Rating, N'★ ', LEFT(rv.Comment, 100)) FROM data.Reviews rv WHERE r.TargetType = 'review' AND rv.Id = r.TargetId),
           (SELECT g.Path FROM data.ShopGallery g WHERE r.TargetType = 'photo' AND g.Id = r.TargetId),
           (SELECT p.Name FROM data.Products p WHERE r.TargetType = 'product' AND p.Id = r.TargetId),
           (SELECT x.FirstName + N' ' + x.LastName + N' (' + x.Email COLLATE DATABASE_DEFAULT + N')' FROM data.Users x WHERE r.TargetType = 'user' AND x.Id = r.TargetId)
         ) AS TargetSummary,
         (SELECT COUNT(*) FROM data.Reports r2 WHERE r2.TargetType = r.TargetType AND r2.TargetId = r.TargetId) AS TimesReported
  FROM data.Reports r JOIN data.Users u ON u.Id = r.ReporterId
  WHERE @Status IS NULL OR r.Status = @Status
  ORDER BY r.CreatedAt;
END
GO

-- Şikayeti kapat: 'resolved' (gereği yapıldı) veya 'dismissed' (geçersiz).
-- Aynı içerik için açık olan tüm şikayetler birlikte kapanır.
CREATE OR ALTER PROCEDURE api.Admin_Report_Resolve
  @ActorId uniqueidentifier, @ReportId uniqueidentifier, @Status varchar(10), @Note nvarchar(300) = NULL
AS
BEGIN
  SET NOCOUNT ON; SET XACT_ABORT ON;
  EXEC data.usp_RequireAdmin @ActorId;
  IF @Status NOT IN ('resolved', 'dismissed') THROW 50400, N'Durum geçersiz.', 1;
  DECLARE @TargetType varchar(10), @TargetId uniqueidentifier;
  SELECT @TargetType = TargetType, @TargetId = TargetId FROM data.Reports WHERE Id = @ReportId;
  IF @TargetType IS NULL THROW 50404, N'Şikayet bulunamadı.', 1;
  BEGIN TRAN;
    UPDATE data.Reports SET Status = @Status, ResolutionNote = @Note, ResolvedBy = @ActorId, ResolvedAt = SYSUTCDATETIME()
    WHERE TargetType = @TargetType AND TargetId = @TargetId AND Status = 'open';
    DECLARE @EntityId nvarchar(64) = CONVERT(nvarchar(64), @ReportId);
    DECLARE @Details nvarchar(max) = (SELECT @Status AS status, @TargetType AS targetType, @TargetId AS targetId, @Note AS note
                                      FOR JSON PATH, WITHOUT_ARRAY_WRAPPER);
    EXEC data.usp_Log @ActorId, 'report_resolve', 'reports', @EntityId, @Details;
  COMMIT;
END
GO

-- ---------------------------------------------------------------------
-- Dükkân istatistikleri (dükkân sahibi; son @Days gün)
-- Tek satır: sayılar + en çok tercih edilen hizmet ve personel (JSON)
-- ---------------------------------------------------------------------
CREATE OR ALTER PROCEDURE api.Shop_Stats @ActorId uniqueidentifier, @ShopId uniqueidentifier, @Days int = 7
AS
BEGIN
  SET NOCOUNT ON;
  IF data.fn_IsShopOwner(@ActorId, @ShopId) = 0 AND data.fn_IsAdmin(@ActorId) = 0 THROW 50403, N'Bu işlem için yetkiniz yok.', 1;
  SET @Days = CASE WHEN @Days > 365 THEN 365 WHEN @Days < 1 THEN 1 ELSE @Days END;
  DECLARE @From datetime2(0) = DATEADD(day, -@Days, SYSUTCDATETIME());

  SELECT
    (SELECT COUNT(*) FROM data.Appointments WHERE ShopId = @ShopId AND Status = 'completed' AND StartsAt >= @From) AS CompletedAppointments,
    (SELECT ISNULL(SUM(TotalPrice), 0) FROM data.Appointments WHERE ShopId = @ShopId AND Status = 'completed' AND StartsAt >= @From) AS AppointmentRevenue,
    (SELECT COUNT(*) FROM data.Appointments WHERE ShopId = @ShopId AND Status = 'no_show' AND StartsAt >= @From) AS NoShows,
    (SELECT COUNT(*) FROM data.Appointments WHERE ShopId = @ShopId AND Status = 'cancelled' AND StartsAt >= @From) AS Cancellations,
    (SELECT COUNT(*) FROM data.QueueEntries WHERE ShopId = @ShopId AND Status = 'done' AND CreatedAt >= @From) AS QueueServed,
    (SELECT ISNULL(SUM(Total), 0) FROM data.Orders WHERE ShopId = @ShopId AND Status = 'picked_up' AND CreatedAt >= @From) AS ProductRevenue,
    (SELECT COUNT(DISTINCT CustomerId) FROM data.Appointments WHERE ShopId = @ShopId AND Status = 'completed' AND StartsAt >= @From) AS UniqueCustomers,
    (SELECT TOP (5) aps.Name AS name, COUNT(*) AS count
     FROM data.Appointments a JOIN data.AppointmentServices aps ON aps.AppointmentId = a.Id
     WHERE a.ShopId = @ShopId AND a.Status = 'completed' AND a.StartsAt >= @From
     GROUP BY aps.Name ORDER BY COUNT(*) DESC FOR JSON PATH) AS TopServicesJson,
    (SELECT TOP (5) st.DisplayName AS name, COUNT(*) AS count, SUM(a.TotalPrice) AS revenue
     FROM data.Appointments a JOIN data.Staff st ON st.Id = a.StaffId
     WHERE a.ShopId = @ShopId AND a.Status = 'completed' AND a.StartsAt >= @From
     GROUP BY st.DisplayName ORDER BY COUNT(*) DESC FOR JSON PATH) AS TopStaffJson;
END
GO

-- ---------------------------------------------------------------------
-- Platform istatistikleri (admin): günlük grafik + en aktif iller
-- ---------------------------------------------------------------------
CREATE OR ALTER PROCEDURE api.Admin_StatsDaily @ActorId uniqueidentifier, @Days int = 30
AS
BEGIN
  SET NOCOUNT ON;
  EXEC data.usp_RequireAdmin @ActorId;
  SET @Days = CASE WHEN @Days > 365 THEN 365 WHEN @Days < 1 THEN 1 ELSE @Days END;
  DECLARE @Today date = CAST(data.fn_IstanbulNow() AS date);
  DECLARE @FromDay date = DATEADD(day, 1 - @Days, @Today);
  -- Türkiye 2016'dan beri sabit UTC+3 (yaz saati yok): gün sınırı UTC'de 21:00.
  -- Her tablo tek seferde, tarih aralığıyla süzülüp güne göre sayılır (eskiden her gün için tüm tablo taranıyordu;
  -- 40 bin dükkânla sayfa zaman aşımına düşüyordu).
  DECLARE @FromUtc datetime2(0) = DATEADD(hour, -3, CAST(@FromDay AS datetime2(0)));
  WITH d AS (
    SELECT TOP (@Days) DATEADD(day, 1 - ROW_NUMBER() OVER (ORDER BY (SELECT NULL)), @Today) AS Day
    FROM sys.all_objects
  ),
  u AS (SELECT CAST(DATEADD(hour, 3, CreatedAt) AS date) AS Day, COUNT(*) AS n FROM data.Users
        WHERE CreatedAt >= @FromUtc AND DeletedAt IS NULL GROUP BY CAST(DATEADD(hour, 3, CreatedAt) AS date)),
  s AS (SELECT CAST(DATEADD(hour, 3, CreatedAt) AS date) AS Day, COUNT(*) AS n FROM data.Shops
        WHERE CreatedAt >= @FromUtc GROUP BY CAST(DATEADD(hour, 3, CreatedAt) AS date)),
  a AS (SELECT CAST(DATEADD(hour, 3, CreatedAt) AS date) AS Day, COUNT(*) AS n FROM data.Appointments
        WHERE CreatedAt >= @FromUtc GROUP BY CAST(DATEADD(hour, 3, CreatedAt) AS date)),
  c AS (SELECT CAST(DATEADD(hour, 3, StartsAt) AS date) AS Day, COUNT(*) AS n FROM data.Appointments
        WHERE Status = 'completed' AND StartsAt >= @FromUtc GROUP BY CAST(DATEADD(hour, 3, StartsAt) AS date)),
  q AS (SELECT QueueDate AS Day, COUNT(*) AS n FROM data.QueueEntries WHERE QueueDate >= @FromDay GROUP BY QueueDate)
  SELECT d.Day, ISNULL(u.n, 0) AS NewUsers, ISNULL(s.n, 0) AS NewShops, ISNULL(a.n, 0) AS NewAppointments,
         ISNULL(c.n, 0) AS CompletedAppointments, ISNULL(q.n, 0) AS QueueEntries
  FROM d
  LEFT JOIN u ON u.Day = d.Day LEFT JOIN s ON s.Day = d.Day LEFT JOIN a ON a.Day = d.Day
  LEFT JOIN c ON c.Day = d.Day LEFT JOIN q ON q.Day = d.Day
  ORDER BY d.Day;
END
GO

CREATE OR ALTER PROCEDURE api.Admin_StatsTopProvinces @ActorId uniqueidentifier, @Days int = 30
AS
BEGIN
  SET NOCOUNT ON;
  EXEC data.usp_RequireAdmin @ActorId;
  DECLARE @From datetime2(0) = DATEADD(day, -@Days, SYSUTCDATETIME());
  SELECT TOP (10) p.Name AS Province,
         COUNT(DISTINCT s.Id) AS Shops,
         COUNT(a.Id) AS Appointments
  FROM data.Provinces p
  JOIN data.Shops s ON s.ProvinceId = p.Id AND s.Status = 'approved'
  LEFT JOIN data.Appointments a ON a.ShopId = s.Id AND a.CreatedAt >= @From
  GROUP BY p.Name
  ORDER BY COUNT(a.Id) DESC, COUNT(DISTINCT s.Id) DESC;
END
GO

-- İşletme paneli: personel listesi, molaları ve ileriye dönük izinleriyle (yalnızca sahip / admin)
CREATE OR ALTER PROCEDURE api.Staff_ListForPanel @ActorId uniqueidentifier, @ShopId uniqueidentifier
AS
BEGIN
  SET NOCOUNT ON;
  IF data.fn_CanManageShop(@ActorId, @ShopId) = 0 THROW 50403, N'Bu işlem için yetkiniz yok.', 1;
  DECLARE @Today date = CAST(data.fn_IstanbulNow() AS date);
  SELECT st.Id, st.DisplayName, st.Title, st.PhotoPath, st.Phone, st.ShowPhone, st.IsActive,
         CAST(CASE WHEN st.UserId IS NOT NULL THEN 1 ELSE 0 END AS bit) AS HasAccount,
         (SELECT CONVERT(char(5), b.StartTime, 108) AS start, CONVERT(char(5), b.EndTime, 108) AS [end], b.Weekday AS weekday
          FROM data.StaffBreaks b WHERE b.StaffId = st.Id ORDER BY b.StartTime FOR JSON PATH) AS BreaksJson,
         (SELECT d.Id AS id, d.Weekday AS weekday, d.StartDate AS startDate, d.EndDate AS endDate, d.Note AS note
          FROM data.StaffDaysOff d WHERE d.StaffId = st.Id AND (d.Weekday IS NOT NULL OR d.EndDate >= @Today)
          ORDER BY d.Weekday, d.StartDate FOR JSON PATH) AS DaysOffJson
  FROM data.Staff st
  WHERE st.ShopId = @ShopId
  ORDER BY st.IsActive DESC, st.DisplayName;
END
GO
