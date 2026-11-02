-- =====================================================================
-- Katılmamış dükkânlar için randevu / sıra talepleri (admin ayarlar)
-- =====================================================================

CREATE OR ALTER PROCEDURE api.Request_Create
  @ActorId uniqueidentifier, @ShopId uniqueidentifier, @Kind varchar(8), @CategoryId int = NULL,
  @PreferredAtLocal datetime2(0), @Note nvarchar(300) = NULL
AS
BEGIN
  SET NOCOUNT ON;
  EXEC data.usp_RequireUser @ActorId;
  IF @Kind NOT IN ('randevu', 'sira') THROW 50400, N'Talep türü geçersiz.', 1;
  IF NOT EXISTS (SELECT 1 FROM data.Shops WHERE Id = @ShopId AND Status = 'approved' AND IsClaimed = 0)
    THROW 50409, N'Bu dükkân için talep bırakılamaz; dükkânın kendi randevu sayfasını kullanın.', 1;
  IF NOT EXISTS (SELECT 1 FROM data.Users WHERE Id = @ActorId AND Phone IS NOT NULL)
    THROW 50400, N'Size ulaşabilmemiz için profilinize telefon numaranızı ekleyin.', 1;
  DECLARE @Now datetime2(0) = data.fn_IstanbulNow();
  IF @PreferredAtLocal < DATEADD(minute, -5, @Now) THROW 50400, N'Geçmiş bir saat seçilemez.', 1;
  IF @PreferredAtLocal > DATEADD(day, 30, @Now) THROW 50400, N'En fazla 30 gün sonrası için talep bırakılabilir.', 1;
  IF @CategoryId IS NOT NULL AND NOT EXISTS (SELECT 1 FROM data.ServiceCategories c JOIN data.Shops s ON s.Segment = c.Segment
                                             WHERE c.Id = @CategoryId AND s.Id = @ShopId AND c.IsActive = 1)
    THROW 50400, N'Hizmet geçersiz.', 1;
  IF EXISTS (SELECT 1 FROM data.BookingRequests WHERE CustomerId = @ActorId AND ShopId = @ShopId AND Status = 'open')
    THROW 50409, N'Bu dükkân için açık bir talebiniz var; Randevularım sayfasından takip edebilirsiniz.', 1;
  IF (SELECT COUNT(*) FROM data.BookingRequests WHERE CustomerId = @ActorId AND Status = 'open') >= 3
    THROW 50409, N'Aynı anda en fazla 3 açık talebiniz olabilir.', 1;
  DECLARE @Out TABLE (Id uniqueidentifier);
  INSERT INTO data.BookingRequests (ShopId, CustomerId, Kind, CategoryId, PreferredAtLocal, Note) OUTPUT inserted.Id INTO @Out
  VALUES (@ShopId, @ActorId, @Kind, @CategoryId, @PreferredAtLocal, NULLIF(LTRIM(RTRIM(@Note)), N''));
  SELECT Id FROM @Out;
END
GO

CREATE OR ALTER PROCEDURE api.Request_ListMine @ActorId uniqueidentifier
AS
BEGIN
  SET NOCOUNT ON;
  EXEC data.usp_RequireUser @ActorId;
  SELECT TOP (50) r.Id, r.Kind, r.Status, r.PreferredAtLocal, r.ConfirmedAtLocal, r.Note, r.AdminNote,
         data.fn_ToIstanbul(r.CreatedAt) AS CreatedAtLocal, c.Name AS CategoryName,
         s.Id AS ShopId, s.Name AS ShopName, s.Phone AS ShopPhone, s.Segment, s.Slug AS ShopSlug, p.Slug AS ProvinceSlug, d.Slug AS DistrictSlug, d.Name AS District
  FROM data.BookingRequests r
  JOIN data.Shops s ON s.Id = r.ShopId
  JOIN data.Provinces p ON p.Id = s.ProvinceId JOIN data.Districts d ON d.Id = s.DistrictId
  LEFT JOIN data.ServiceCategories c ON c.Id = r.CategoryId
  WHERE r.CustomerId = @ActorId
  ORDER BY CASE r.Status WHEN 'open' THEN 0 WHEN 'confirmed' THEN 1 ELSE 2 END, r.CreatedAt DESC;
END
GO

CREATE OR ALTER PROCEDURE api.Request_Cancel @ActorId uniqueidentifier, @RequestId uniqueidentifier
AS
BEGIN
  SET NOCOUNT ON;
  EXEC data.usp_RequireUser @ActorId;
  UPDATE data.BookingRequests SET Status = 'cancelled', ResolvedAt = SYSUTCDATETIME()
  WHERE Id = @RequestId AND CustomerId = @ActorId AND Status IN ('open', 'confirmed');
  IF @@ROWCOUNT = 0 THROW 50404, N'Talep bulunamadı.', 1;
END
GO

-- Admin: açık talepler (müşteri ve dükkân iletişim bilgileriyle)
CREATE OR ALTER PROCEDURE api.Admin_Request_List @ActorId uniqueidentifier, @Status varchar(10) = 'open'
AS
BEGIN
  SET NOCOUNT ON;
  EXEC data.usp_RequireAdmin @ActorId;
  SELECT TOP (300) r.Id, r.Kind, r.Status, r.PreferredAtLocal, r.ConfirmedAtLocal, r.Note, r.AdminNote,
         data.fn_ToIstanbul(r.CreatedAt) AS CreatedAtLocal, c.Name AS CategoryName,
         u.FirstName + N' ' + u.LastName AS CustomerName, u.Phone AS CustomerPhone, u.Email AS CustomerEmail,
         s.Id AS ShopId, s.Code, s.Name AS ShopName, s.Phone AS ShopPhone, d.Name AS District
  FROM data.BookingRequests r
  JOIN data.Users u ON u.Id = r.CustomerId
  JOIN data.Shops s ON s.Id = r.ShopId JOIN data.Districts d ON d.Id = s.DistrictId
  LEFT JOIN data.ServiceCategories c ON c.Id = r.CategoryId
  WHERE @Status IS NULL OR r.Status = @Status
  ORDER BY r.PreferredAtLocal;
END
GO

CREATE OR ALTER PROCEDURE api.Admin_Request_Count @ActorId uniqueidentifier
AS
BEGIN
  SET NOCOUNT ON;
  EXEC data.usp_RequireAdmin @ActorId;
  SELECT COUNT(*) AS OpenRequests FROM data.BookingRequests WHERE Status = 'open';
END
GO

-- Admin dükkânla görüştü: onayla (kesin saatle) ya da reddet → müşteriye bildirim
CREATE OR ALTER PROCEDURE api.Admin_Request_Resolve
  @ActorId uniqueidentifier, @RequestId uniqueidentifier, @Status varchar(10),
  @ConfirmedAtLocal datetime2(0) = NULL, @Note nvarchar(300) = NULL
AS
BEGIN
  SET NOCOUNT ON; SET XACT_ABORT ON;
  EXEC data.usp_RequireAdmin @ActorId;
  IF @Status NOT IN ('confirmed', 'rejected') THROW 50400, N'Durum geçersiz.', 1;
  DECLARE @Customer uniqueidentifier, @Shop nvarchar(100), @Kind varchar(8), @Pref datetime2(0);
  SELECT @Customer = r.CustomerId, @Shop = s.Name, @Kind = r.Kind, @Pref = r.PreferredAtLocal
  FROM data.BookingRequests r JOIN data.Shops s ON s.Id = r.ShopId WHERE r.Id = @RequestId AND r.Status = 'open';
  IF @Customer IS NULL THROW 50404, N'Açık talep bulunamadı.', 1;
  SET @ConfirmedAtLocal = CASE WHEN @Status = 'confirmed' THEN ISNULL(@ConfirmedAtLocal, @Pref) END;
  DECLARE @When nvarchar(30) = FORMAT(@ConfirmedAtLocal, 'dd.MM HH:mm');
  DECLARE @Title nvarchar(80) = CASE WHEN @Status = 'confirmed'
    THEN CASE @Kind WHEN 'sira' THEN N'Sıranız ayarlandı' ELSE N'Randevunuz ayarlandı' END
    ELSE CASE @Kind WHEN 'sira' THEN N'Sıra talebiniz ayarlanamadı' ELSE N'Randevu talebiniz ayarlanamadı' END END;
  DECLARE @Body nvarchar(300) = CASE WHEN @Status = 'confirmed'
    THEN @Shop + N' – ' + @When + N'. Gelemeyecekseniz lütfen Randevularım sayfasından iptal edin.'
    ELSE @Shop + N': ' + ISNULL(@Note, N'Dükkân bu saat için uygun değil. Başka bir saat deneyebilirsiniz.') END;
  BEGIN TRAN;
    UPDATE data.BookingRequests
    SET Status = @Status, ConfirmedAtLocal = @ConfirmedAtLocal, AdminNote = @Note, ResolvedBy = @ActorId, ResolvedAt = SYSUTCDATETIME()
    WHERE Id = @RequestId;
    DECLARE @NotifyKind varchar(24) = CASE WHEN @Status = 'confirmed' THEN 'appointment_accepted' ELSE 'appointment_rejected' END;
    EXEC data.usp_Enqueue @Customer, @NotifyKind, @Title, @Body, N'/randevularim';
    DECLARE @EntityId nvarchar(64) = CONVERT(nvarchar(64), @RequestId);
    DECLARE @Details nvarchar(max) = (SELECT @Status AS status, @ConfirmedAtLocal AS at FOR JSON PATH, WITHOUT_ARRAY_WRAPPER);
    EXEC data.usp_Log @ActorId, 'request_resolve', 'booking_requests', @EntityId, @Details;
  COMMIT;
END
GO
