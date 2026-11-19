-- =====================================================================
-- İşletme paneli: gelir/randevu raporu, müşteri listesi, yorumlara cevap (migration 0028)
--   Dükkân sahibi (ve admin) dükkânın tamamını görür; personel yalnızca kendi randevularını,
--   kendi müşterilerini ve kendisi hakkındaki yorumları görür (site sahibinin kararı).
--   Türkiye 2016'dan beri sabit UTC+3: yerel saat = UTC + 3 saat.
-- =====================================================================

-- Kişinin bu dükkânda tamamını mı (sahip/admin) yoksa yalnızca kendini mi (personel) gördüğü
CREATE OR ALTER FUNCTION data.fn_PanelFullView(@ActorId uniqueidentifier, @ShopId uniqueidentifier)
RETURNS bit AS
BEGIN
  RETURN CASE WHEN data.fn_IsShopOwner(@ActorId, @ShopId) = 1 OR data.fn_IsAdmin(@ActorId) = 1 THEN 1 ELSE 0 END;
END
GO

-- ---------------------------------------------------------------------
-- Rapor: @Period 'gun' | 'hafta' (Pazartesi başlar) | 'ay'; @Date dönemin içindeki herhangi bir gün.
-- Gelir = "Tamamlandı" işaretlenen randevular; Beklenen = onaylı ama henüz tamamlanmamış randevular.
-- Tek satır döner; grafik, personel ve hizmet kırılımları JSON sütunlarda.
-- ---------------------------------------------------------------------
CREATE OR ALTER PROCEDURE api.Panel_Report
  @ActorId uniqueidentifier, @ShopId uniqueidentifier, @Period varchar(5) = 'hafta', @Date date = NULL
AS
BEGIN
  SET NOCOUNT ON;
  EXEC data.usp_RequireUser @ActorId;
  DECLARE @Full bit = data.fn_PanelFullView(@ActorId, @ShopId);
  IF @Full = 0 AND data.fn_IsShopMember(@ActorId, @ShopId) = 0 THROW 50403, N'Bu işlem için yetkiniz yok.', 1;
  IF @Period NOT IN ('gun', 'hafta', 'ay') THROW 50400, N'Dönem geçersiz.', 1;
  SET @Date = ISNULL(@Date, CAST(data.fn_IstanbulNow() AS date));

  DECLARE @From date, @To date, @PrevFrom date, @Buckets int;
  IF @Period = 'gun'
    SELECT @From = @Date, @To = DATEADD(day, 1, @Date), @PrevFrom = DATEADD(day, -1, @Date), @Buckets = 24;
  ELSE IF @Period = 'hafta'
  BEGIN
    SET @From = DATEADD(day, -(DATEDIFF(day, '19000101', @Date) % 7), @Date); -- 1900-01-01 Pazartesi
    SELECT @To = DATEADD(day, 7, @From), @PrevFrom = DATEADD(day, -7, @From), @Buckets = 7;
  END
  ELSE
  BEGIN
    SET @From = DATEFROMPARTS(YEAR(@Date), MONTH(@Date), 1);
    SELECT @To = DATEADD(month, 1, @From), @PrevFrom = DATEADD(month, -1, @From);
    SET @Buckets = DATEDIFF(day, @From, @To);
  END
  DECLARE @FromUtc datetime2(0) = DATEADD(hour, -3, CAST(@From AS datetime2(0))),
          @ToUtc datetime2(0) = DATEADD(hour, -3, CAST(@To AS datetime2(0))),
          @PrevUtc datetime2(0) = DATEADD(hour, -3, CAST(@PrevFrom AS datetime2(0)));

  DECLARE @Mine TABLE (Id uniqueidentifier PRIMARY KEY);
  INSERT @Mine SELECT Id FROM data.Staff WHERE ShopId = @ShopId AND UserId = @ActorId;

  -- Bu dönem + önceki dönem randevuları (kapsam: sahip → tümü, personel → kendisi)
  CREATE TABLE #A (
    Id uniqueidentifier PRIMARY KEY, StaffId uniqueidentifier, CustKey nvarchar(160), Status varchar(10),
    Price decimal(10, 2), Source varchar(6), LocalAt datetime2(0), Cur bit
  );
  INSERT #A
  SELECT a.Id, a.StaffId,
         COALESCE(CONVERT(nvarchar(40), a.CustomerId), N't:' + a.CustomerPhone, N'n:' + a.CustomerName),
         a.Status, a.TotalPrice, a.Source, DATEADD(hour, 3, a.StartsAt), CASE WHEN a.StartsAt >= @FromUtc THEN 1 ELSE 0 END
  FROM data.Appointments a
  WHERE a.ShopId = @ShopId AND a.StartsAt >= @PrevUtc AND a.StartsAt < @ToUtc
    AND (@Full = 1 OR a.StaffId IN (SELECT Id FROM @Mine));

  -- Dönemde gelen müşterilerden ilk kez gelenler (kapsamdaki tüm geçmişe bakılır)
  DECLARE @NewCustomers int = (
    SELECT COUNT(*) FROM (
      SELECT DISTINCT CustKey FROM #A WHERE Cur = 1 AND Status IN ('completed', 'accepted')
    ) c
    WHERE NOT EXISTS (
      SELECT 1 FROM data.Appointments a
      WHERE a.ShopId = @ShopId AND a.StartsAt < @FromUtc AND a.Status IN ('completed', 'accepted')
        AND (@Full = 1 OR a.StaffId IN (SELECT Id FROM @Mine))
        AND COALESCE(CONVERT(nvarchar(40), a.CustomerId), N't:' + a.CustomerPhone, N'n:' + a.CustomerName) = c.CustKey));

  SELECT
    @Period AS Period, @From AS FromDate, DATEADD(day, -1, @To) AS ToDate, @Full AS FullView,
    (SELECT COUNT(*) FROM #A WHERE Cur = 1 AND Status IN ('completed', 'accepted')) AS Appointments,
    (SELECT COUNT(*) FROM #A WHERE Cur = 1 AND Status = 'completed') AS Completed,
    (SELECT COUNT(*) FROM #A WHERE Cur = 1 AND Status = 'accepted') AS Accepted,
    (SELECT COUNT(*) FROM #A WHERE Cur = 1 AND Status = 'pending') AS Pending,
    (SELECT COUNT(*) FROM #A WHERE Cur = 1 AND Status IN ('cancelled', 'rejected')) AS Cancelled,
    (SELECT COUNT(*) FROM #A WHERE Cur = 1 AND Status = 'no_show') AS NoShows,
    (SELECT ISNULL(SUM(Price), 0) FROM #A WHERE Cur = 1 AND Status = 'completed') AS Revenue,
    (SELECT ISNULL(SUM(Price), 0) FROM #A WHERE Cur = 1 AND Status = 'accepted') AS ExpectedRevenue,
    (SELECT COUNT(DISTINCT CustKey) FROM #A WHERE Cur = 1 AND Status IN ('completed', 'accepted')) AS Customers,
    @NewCustomers AS NewCustomers,
    (SELECT COUNT(*) FROM #A WHERE Cur = 1 AND Status IN ('completed', 'accepted') AND Source = 'phone') AS PhoneBookings,
    CASE WHEN @Full = 1 THEN (SELECT ISNULL(SUM(Total), 0) FROM data.Orders
      WHERE ShopId = @ShopId AND Status = 'picked_up' AND CreatedAt >= @FromUtc AND CreatedAt < @ToUtc) END AS ProductRevenue,
    (SELECT COUNT(*) FROM #A WHERE Cur = 0 AND Status IN ('completed', 'accepted')) AS PrevAppointments,
    (SELECT ISNULL(SUM(Price), 0) FROM #A WHERE Cur = 0 AND Status = 'completed') AS PrevRevenue,
    (SELECT COUNT(DISTINCT CustKey) FROM #A WHERE Cur = 0 AND Status IN ('completed', 'accepted')) AS PrevCustomers,
    -- Grafik: gün → saat saat (0-23), hafta → 7 gün, ay → ayın günleri
    (SELECT b.i, ISNULL(x.n, 0) AS n, ISNULL(x.revenue, 0) AS revenue
     FROM (SELECT TOP (@Buckets) ROW_NUMBER() OVER (ORDER BY (SELECT NULL)) - 1 AS i FROM sys.all_objects) b
     LEFT JOIN (
       SELECT CASE WHEN @Period = 'gun' THEN DATEPART(hour, LocalAt) ELSE DATEDIFF(day, @From, CAST(LocalAt AS date)) END AS i,
              COUNT(*) AS n, SUM(CASE WHEN Status = 'completed' THEN Price ELSE 0 END) AS revenue
       FROM #A WHERE Cur = 1 AND Status IN ('completed', 'accepted')
       GROUP BY CASE WHEN @Period = 'gun' THEN DATEPART(hour, LocalAt) ELSE DATEDIFF(day, @From, CAST(LocalAt AS date)) END
     ) x ON x.i = b.i
     ORDER BY b.i FOR JSON PATH) AS SeriesJson,
    -- Personel kırılımı (yalnızca dükkân sahibi)
    CASE WHEN @Full = 1 THEN (
      SELECT st.DisplayName AS name, COUNT(*) AS n,
             SUM(CASE WHEN a.Status = 'completed' THEN 1 ELSE 0 END) AS completed,
             SUM(CASE WHEN a.Status = 'completed' THEN a.Price ELSE 0 END) AS revenue
      FROM #A a JOIN data.Staff st ON st.Id = a.StaffId
      WHERE a.Cur = 1 AND a.Status IN ('completed', 'accepted')
      GROUP BY st.DisplayName ORDER BY COUNT(*) DESC FOR JSON PATH) END AS StaffJson,
    (SELECT TOP (8) s.Name AS name, COUNT(*) AS n, SUM(s.Price) AS revenue
     FROM #A a JOIN data.AppointmentServices s ON s.AppointmentId = a.Id
     WHERE a.Cur = 1 AND a.Status IN ('completed', 'accepted')
     GROUP BY s.Name ORDER BY COUNT(*) DESC FOR JSON PATH) AS ServicesJson;
END
GO

-- ---------------------------------------------------------------------
-- Müşteri listesi: geliş sayısı (tamamlanan + saati geçmiş onaylı), son/ilk geliş, harcama, sıradaki randevu.
-- Telefonla eklenen (hesabı olmayan) müşteriler telefon numarasına göre birleştirilir.
-- ---------------------------------------------------------------------
CREATE OR ALTER PROCEDURE api.Panel_Customers
  @ActorId uniqueidentifier, @ShopId uniqueidentifier, @Search nvarchar(60) = NULL
AS
BEGIN
  SET NOCOUNT ON;
  EXEC data.usp_RequireUser @ActorId;
  DECLARE @Full bit = data.fn_PanelFullView(@ActorId, @ShopId);
  IF @Full = 0 AND data.fn_IsShopMember(@ActorId, @ShopId) = 0 THROW 50403, N'Bu işlem için yetkiniz yok.', 1;
  DECLARE @Now datetime2(0) = SYSUTCDATETIME();
  SET @Search = NULLIF(LTRIM(RTRIM(@Search)), N'');

  WITH a AS (
    SELECT a.StartsAt, a.Status, a.TotalPrice, a.CustomerId, st.DisplayName AS StaffName,
           COALESCE(CONVERT(nvarchar(40), a.CustomerId), N't:' + a.CustomerPhone, N'n:' + a.CustomerName) AS CustKey,
           COALESCE(u.FirstName + N' ' + u.LastName, a.CustomerName) AS Name,
           COALESCE(a.CustomerPhone, u.Phone) AS Phone,
           CASE WHEN a.Status = 'completed' OR (a.Status = 'accepted' AND a.StartsAt < @Now) THEN 1 ELSE 0 END AS Came,
           CASE WHEN a.Status IN ('accepted', 'pending') AND a.StartsAt >= @Now THEN 1 ELSE 0 END AS Upcoming
    FROM data.Appointments a
    JOIN data.Staff st ON st.Id = a.StaffId
    LEFT JOIN data.Users u ON u.Id = a.CustomerId
    WHERE a.ShopId = @ShopId
      AND (@Full = 1 OR st.UserId = @ActorId)
  ),
  g AS (
    SELECT CustKey, MAX(Name) AS Name, MAX(Phone) AS Phone,
           CAST(MAX(CASE WHEN CustomerId IS NULL THEN 0 ELSE 1 END) AS bit) AS HasAccount,
           SUM(Came) AS Visits,
           MAX(CASE WHEN Came = 1 THEN StartsAt END) AS LastVisit,
           MIN(CASE WHEN Came = 1 THEN StartsAt END) AS FirstVisit,
           SUM(CASE WHEN Status = 'completed' THEN TotalPrice ELSE 0 END) AS TotalSpent,
           SUM(CASE WHEN Status = 'no_show' THEN 1 ELSE 0 END) AS NoShows,
           MIN(CASE WHEN Upcoming = 1 THEN StartsAt END) AS NextAppointment
    FROM a GROUP BY CustKey
  )
  SELECT TOP (500) g.CustKey, g.Name, g.Phone, g.HasAccount, g.Visits, g.TotalSpent, g.NoShows,
         data.fn_ToIstanbul(g.LastVisit) AS LastVisitLocal, data.fn_ToIstanbul(g.FirstVisit) AS FirstVisitLocal,
         data.fn_ToIstanbul(g.NextAppointment) AS NextAppointmentLocal,
         (SELECT TOP (1) a.StaffName FROM a WHERE a.CustKey = g.CustKey AND a.Came = 1 ORDER BY a.StartsAt DESC) AS LastStaffName
  FROM g
  WHERE (g.Visits > 0 OR g.NextAppointment IS NOT NULL)
    AND (@Search IS NULL OR g.Name LIKE N'%' + @Search + N'%' OR g.Phone LIKE N'%' + REPLACE(@Search, N' ', N'') + N'%')
  ORDER BY CASE WHEN g.LastVisit IS NULL THEN 1 ELSE 0 END, g.LastVisit DESC, g.NextAppointment;
END
GO

-- ---------------------------------------------------------------------
-- Paneldeki yorumlar (admin'in gizledikleri hariç). Sahip: tümü; personel: kendisi hakkındakiler.
-- ---------------------------------------------------------------------
CREATE OR ALTER PROCEDURE api.Panel_Reviews @ActorId uniqueidentifier, @ShopId uniqueidentifier
AS
BEGIN
  SET NOCOUNT ON;
  EXEC data.usp_RequireUser @ActorId;
  DECLARE @Full bit = data.fn_PanelFullView(@ActorId, @ShopId);
  IF @Full = 0 AND data.fn_IsShopMember(@ActorId, @ShopId) = 0 THROW 50403, N'Bu işlem için yetkiniz yok.', 1;
  SELECT TOP (300) r.Id, r.Rating, r.Comment, data.fn_ToIstanbul(r.CreatedAt) AS CreatedAtLocal,
         u.FirstName + N' ' + LEFT(u.LastName, 1) + N'.' AS CustomerName, st.DisplayName AS StaffName,
         r.ReplyText, data.fn_ToIstanbul(r.ReplyAt) AS ReplyAtLocal, ru.FirstName + N' ' + ru.LastName AS ReplyByName
  FROM data.Reviews r
  JOIN data.Users u ON u.Id = r.CustomerId
  LEFT JOIN data.Staff st ON st.Id = r.StaffId
  LEFT JOIN data.Users ru ON ru.Id = r.ReplyBy
  WHERE r.ShopId = @ShopId AND r.IsHidden = 0
    AND (@Full = 1 OR st.UserId = @ActorId)
  ORDER BY CASE WHEN r.ReplyText IS NULL THEN 0 ELSE 1 END, r.CreatedAt DESC;
END
GO

-- Yoruma cevap yaz / düzelt / sil (@Text boş → cevap silinir). İlk cevapta müşteriye bildirim gider.
CREATE OR ALTER PROCEDURE api.Review_Reply @ActorId uniqueidentifier, @ReviewId uniqueidentifier, @Text nvarchar(1000) = NULL
AS
BEGIN
  SET NOCOUNT ON; SET XACT_ABORT ON;
  EXEC data.usp_RequireUser @ActorId;
  DECLARE @ShopId uniqueidentifier, @StaffId uniqueidentifier, @CustomerId uniqueidentifier, @Hidden bit, @Old nvarchar(1000);
  SELECT @ShopId = ShopId, @StaffId = StaffId, @CustomerId = CustomerId, @Hidden = IsHidden, @Old = ReplyText
  FROM data.Reviews WHERE Id = @ReviewId;
  IF @ShopId IS NULL THROW 50404, N'Yorum bulunamadı.', 1;
  IF data.fn_PanelFullView(@ActorId, @ShopId) = 0
     AND NOT EXISTS (SELECT 1 FROM data.Staff WHERE Id = @StaffId AND ShopId = @ShopId AND UserId = @ActorId AND IsActive = 1)
    THROW 50403, N'Yalnızca kendiniz hakkındaki yorumlara cevap yazabilirsiniz.', 1;
  IF @Hidden = 1 THROW 50409, N'Bu yorum Bermatik ekibi tarafından gizlendi; cevap yazılamaz.', 1;
  SET @Text = NULLIF(LTRIM(RTRIM(@Text)), N'');
  IF @Text IS NOT NULL AND LEN(@Text) < 2 THROW 50400, N'Cevap çok kısa.', 1;

  BEGIN TRAN;
    UPDATE data.Reviews
    SET ReplyText = @Text,
        ReplyAt = CASE WHEN @Text IS NULL THEN NULL ELSE SYSUTCDATETIME() END,
        ReplyBy = CASE WHEN @Text IS NULL THEN NULL ELSE @ActorId END
    WHERE Id = @ReviewId;
    IF @Old IS NULL AND @Text IS NOT NULL
    BEGIN
      DECLARE @ShopName nvarchar(100), @Url nvarchar(300);
      SELECT @ShopName = s.Name, @Url = N'/' + s.Segment + N'/' + p.Slug + N'/' + d.Slug + N'/' + s.Slug
      FROM data.Shops s JOIN data.Districts d ON d.Id = s.DistrictId JOIN data.Provinces p ON p.Id = d.ProvinceId
      WHERE s.Id = @ShopId;
      DECLARE @Body nvarchar(300) = @ShopName + N': ' + LEFT(@Text, 200);
      EXEC data.usp_Enqueue @CustomerId, 'review_reply', N'Yorumunuza cevap geldi', @Body, @Url;
    END
    DECLARE @EntityId nvarchar(64) = CONVERT(nvarchar(64), @ReviewId);
    DECLARE @Details nvarchar(max) = (SELECT CASE WHEN @Text IS NULL THEN 'deleted' ELSE 'saved' END AS reply FOR JSON PATH, WITHOUT_ARRAY_WRAPPER);
    EXEC data.usp_Log @ActorId, 'review_reply', 'reviews', @EntityId, @Details;
  COMMIT;
END
GO
