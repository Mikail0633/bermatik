-- =====================================================================
-- Bermatik — Randevular
-- Saatler sitede Türkiye saatiyle gelir/gider, veritabanında UTC saklanır.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Boş randevu saatleri: personelin süresine göre açılır.
-- Örn. süre 40 dk, dükkân 09:00'da açılıyorsa: 09:00, 09:40, 10:20 ...
-- Araya bir randevu girerse sıradaki saat o randevu biter bitmez açılır.
-- ---------------------------------------------------------------------
CREATE OR ALTER FUNCTION data.tvf_AvailableSlots(@StaffId uniqueidentifier, @Date date, @Minutes int)
RETURNS @Slots TABLE (StartsAtLocal datetime2(0) PRIMARY KEY, EndsAtLocal datetime2(0))
AS
BEGIN
  DECLARE @ShopId uniqueidentifier = (SELECT ShopId FROM data.Staff WHERE Id = @StaffId AND IsActive = 1);
  IF @ShopId IS NULL OR @Minutes IS NULL OR @Minutes < 5 RETURN;
  -- Dükkân özel kapalı günü, personelin izin günü veya tatili → boş saat yok
  IF data.fn_StaffWorksOn(@StaffId, @Date) = 0 RETURN;

  DECLARE @Weekday tinyint = (DATEDIFF(day, '19000101', @Date) % 7) + 1;
  DECLARE @Opens time(0), @Closes time(0);
  SELECT @Opens = OpensAt, @Closes = ClosesAt FROM data.ShopHours
  WHERE ShopId = @ShopId AND IsClosed = 0 AND Weekday = @Weekday;
  IF @Opens IS NULL RETURN;

  DECLARE @Day datetime2(0) = CAST(@Date AS datetime2(0));
  DECLARE @t datetime2(0) = DATEADD(second, DATEDIFF(second, CAST('00:00' AS time(0)), @Opens), @Day);
  DECLARE @End datetime2(0) = DATEADD(second, DATEDIFF(second, CAST('00:00' AS time(0)), @Closes), @Day);
  DECLARE @Earliest datetime2(0) = DATEADD(minute, 10, data.fn_IstanbulNow());

  DECLARE @Busy TABLE (S datetime2(0), E datetime2(0));
  INSERT INTO @Busy
  SELECT data.fn_ToIstanbul(StartsAt), data.fn_ToIstanbul(EndsAt) FROM data.Appointments
  WHERE StaffId = @StaffId AND Status IN ('pending', 'accepted')
    AND StartsAt < data.fn_ToUtc(@End) AND EndsAt > data.fn_ToUtc(@t);
  -- Personelin molaları (öğle arası vb.) dolu sayılır
  INSERT INTO @Busy
  SELECT DATEADD(second, DATEDIFF(second, CAST('00:00' AS time(0)), StartTime), @Day),
         DATEADD(second, DATEDIFF(second, CAST('00:00' AS time(0)), EndTime), @Day)
  FROM data.StaffBreaks WHERE StaffId = @StaffId AND (Weekday IS NULL OR Weekday = @Weekday);

  DECLARE @BusyEnd datetime2(0), @Guard int = 0;
  WHILE DATEADD(minute, @Minutes, @t) <= @End AND @Guard < 1000
  BEGIN
    SET @Guard += 1;
    SET @BusyEnd = (SELECT MAX(E) FROM @Busy WHERE S < DATEADD(minute, @Minutes, @t) AND E > @t);
    IF @BusyEnd IS NOT NULL
    BEGIN
      SET @t = @BusyEnd;   -- dolu: randevu bitince devam et
      CONTINUE;
    END
    IF @t >= @Earliest INSERT INTO @Slots VALUES (@t, DATEADD(minute, @Minutes, @t));
    SET @t = DATEADD(minute, @Minutes, @t);
  END
  RETURN;
END
GO

-- Seçilen hizmetlerin bu personeldeki toplam süresi (personelin süresi, yoksa dükkânın)
CREATE OR ALTER FUNCTION data.fn_StaffServicesMinutes(@StaffId uniqueidentifier, @ServiceIdsJson nvarchar(max))
RETURNS int AS
BEGIN
  RETURN (SELECT SUM(ISNULL(d.DurationMinutes, ss.DurationMinutes))
          FROM data.Staff st
          JOIN data.ShopServices ss ON ss.ShopId = st.ShopId AND ss.IsActive = 1
          LEFT JOIN data.StaffServiceDurations d ON d.StaffId = st.Id AND d.ShopServiceId = ss.Id
          WHERE st.Id = @StaffId
            AND ss.Id IN (SELECT TRY_CONVERT(uniqueidentifier, value) FROM OPENJSON(@ServiceIdsJson)));
END
GO

-- Randevu ekranı: seçilen personel + hizmetler için o günün boş saatleri
CREATE OR ALTER PROCEDURE api.Appointment_AvailableSlots @StaffId uniqueidentifier, @Date date, @ServiceIdsJson nvarchar(max)
AS
BEGIN
  SET NOCOUNT ON;
  IF ISJSON(@ServiceIdsJson) = 0 THROW 50400, N'En az bir hizmet seçmelisiniz.', 1;
  DECLARE @Minutes int = data.fn_StaffServicesMinutes(@StaffId, @ServiceIdsJson);
  SELECT StartsAtLocal, EndsAtLocal, @Minutes AS DurationMinutes
  FROM data.tvf_AvailableSlots(@StaffId, @Date, @Minutes)
  ORDER BY StartsAtLocal;
END
GO

-- Müşteri online randevu alır (onay bekler, personel kabul eder).
-- Dükkân sahibi/personel çağırırsa telefonla alınan randevu olarak kaydedilir (direkt onaylı).
-- @ServiceIdsJson: ["guid", "guid"]
CREATE OR ALTER PROCEDURE api.Appointment_Book
  @ActorId uniqueidentifier, @ShopId uniqueidentifier, @StaffId uniqueidentifier, @ServiceIdsJson nvarchar(max),
  @StartsAtLocal datetime2(0), @Note nvarchar(500) = NULL,
  @CustomerName nvarchar(121) = NULL, @CustomerPhone nvarchar(40) = NULL
AS
BEGIN
  SET NOCOUNT ON; SET XACT_ABORT ON;
  EXEC data.usp_RequireUser @ActorId;
  IF data.fn_ShopIsPublic(@ShopId) = 0 THROW 50404, N'Dükkân bulunamadı.', 1;
  IF EXISTS (SELECT 1 FROM data.Shops WHERE Id = @ShopId AND IsClaimed = 0)
    THROW 50409, N'Bu dükkân henüz Bermatik''e katılmadı. Telefonla arayabilirsiniz.', 1;
  IF NOT EXISTS (SELECT 1 FROM data.Staff WHERE Id = @StaffId AND ShopId = @ShopId AND IsActive = 1)
    THROW 50404, N'Personel bulunamadı.', 1;

  DECLARE @NowLocal datetime2(0) = data.fn_IstanbulNow();
  IF @StartsAtLocal < DATEADD(minute, 10, @NowLocal) OR @StartsAtLocal > DATEADD(day, 60, @NowLocal)
    THROW 50400, N'Bu tarihe randevu alınamaz.', 1;
  IF ISJSON(@ServiceIdsJson) = 0 THROW 50400, N'En az bir hizmet seçmelisiniz.', 1;

  DECLARE @Ids TABLE (Id uniqueidentifier PRIMARY KEY);
  INSERT INTO @Ids SELECT DISTINCT TRY_CONVERT(uniqueidentifier, value) FROM OPENJSON(@ServiceIdsJson)
  WHERE TRY_CONVERT(uniqueidentifier, value) IS NOT NULL;
  DECLARE @Requested int = (SELECT COUNT(*) FROM @Ids);
  IF @Requested NOT BETWEEN 1 AND 10 THROW 50400, N'En az bir hizmet seçmelisiniz.', 1;

  -- Süre: personelin kendi süresi, yoksa dükkânın hizmet süresi
  DECLARE @Count int, @Total decimal(10, 2), @Minutes int;
  SELECT @Count = COUNT(*), @Total = SUM(ss.Price), @Minutes = SUM(ISNULL(d.DurationMinutes, ss.DurationMinutes))
  FROM data.ShopServices ss
  LEFT JOIN data.StaffServiceDurations d ON d.StaffId = @StaffId AND d.ShopServiceId = ss.Id
  WHERE ss.ShopId = @ShopId AND ss.IsActive = 1 AND ss.Id IN (SELECT Id FROM @Ids);
  IF @Count <> @Requested THROW 50400, N'Geçersiz hizmet seçimi.', 1;

  DECLARE @EndsAtLocal datetime2(0) = DATEADD(minute, @Minutes, @StartsAtLocal);
  DECLARE @Weekday tinyint = (DATEDIFF(day, '19000101', CAST(@StartsAtLocal AS date)) % 7) + 1;
  IF NOT EXISTS (SELECT 1 FROM data.ShopHours
                 WHERE ShopId = @ShopId AND Weekday = @Weekday AND IsClosed = 0
                   AND CAST(@StartsAtLocal AS time(0)) >= OpensAt
                   AND CAST(@EndsAtLocal AS time(0)) <= ClosesAt
                   AND CAST(@EndsAtLocal AS date) = CAST(@StartsAtLocal AS date))
    THROW 50400, N'Seçilen saat dükkânın çalışma saatleri dışında.', 1;
  IF EXISTS (SELECT 1 FROM data.ShopClosures WHERE ShopId = @ShopId AND CAST(@StartsAtLocal AS date) BETWEEN StartDate AND EndDate)
    THROW 50400, N'Dükkân bu tarihte kapalı.', 1;

  -- Online randevu yalnızca listedeki boş saatlerden alınabilir (personelin süresine göre açılan saatler)
  IF data.fn_CanWorkShop(@ActorId, @ShopId) = 0
     AND NOT EXISTS (SELECT 1 FROM data.tvf_AvailableSlots(@StaffId, CAST(@StartsAtLocal AS date), @Minutes)
                     WHERE StartsAtLocal = @StartsAtLocal)
    THROW 50409, N'Bu saat dolu veya uygun değil, lütfen listeden bir saat seçin.', 1;

  DECLARE @StartsAt datetime2(0) = data.fn_ToUtc(@StartsAtLocal), @EndsAt datetime2(0) = data.fn_ToUtc(@EndsAtLocal);
  DECLARE @IsMember bit = data.fn_CanWorkShop(@ActorId, @ShopId);
  DECLARE @Name nvarchar(121), @Phone varchar(16), @CustomerId uniqueidentifier, @Status varchar(10), @Source varchar(6);

  IF @IsMember = 1
  BEGIN
    -- Telefonla alınan randevu
    SET @Phone = data.fn_NormalizePhone(@CustomerPhone);
    SET @Name = NULLIF(LTRIM(RTRIM(@CustomerName)), N'');
    IF @Name IS NULL OR @Phone IS NULL THROW 50400, N'Müşteri adı ve geçerli telefon numarası gerekli.', 1;
    SELECT @Status = 'accepted', @Source = 'phone';
  END
  ELSE
  BEGIN
    -- Kötüye kullanım sınırı
    IF (SELECT COUNT(*) FROM data.Appointments
        WHERE CustomerId = @ActorId AND Status IN ('pending', 'accepted') AND StartsAt > SYSUTCDATETIME()) >= 3
      THROW 50409, N'En fazla 3 aktif randevunuz olabilir.', 1;
    SELECT @CustomerId = Id, @Name = FirstName + N' ' + LastName, @Phone = Phone FROM data.Users WHERE Id = @ActorId;
    SELECT @Status = 'pending', @Source = 'online';
  END

  DECLARE @Out TABLE (Id uniqueidentifier);
  BEGIN TRAN;
    -- Aynı personel için aynı anda yalnızca bir randevu işlemi (çakışmayı kesin önler)
    DECLARE @Lock nvarchar(100) = N'staff:' + CONVERT(nvarchar(36), @StaffId);
    EXEC sp_getapplock @Resource = @Lock, @LockMode = 'Exclusive', @LockOwner = 'Transaction', @LockTimeout = 10000;

    IF EXISTS (SELECT 1 FROM data.Appointments
               WHERE StaffId = @StaffId AND Status IN ('pending', 'accepted')
                 AND StartsAt < @EndsAt AND EndsAt > @StartsAt)
      THROW 50409, N'Bu saat dolu, lütfen başka bir saat seçin.', 1;

    INSERT INTO data.Appointments (ShopId, StaffId, CustomerId, CustomerName, CustomerPhone, Source, StartsAt, EndsAt,
                                   Status, TotalPrice, Note, RespondedAt)
    OUTPUT inserted.Id INTO @Out
    VALUES (@ShopId, @StaffId, @CustomerId, @Name, @Phone, @Source, @StartsAt, @EndsAt,
            @Status, @Total, LEFT(@Note, 500), CASE WHEN @Status = 'accepted' THEN SYSUTCDATETIME() END);

    INSERT INTO data.AppointmentServices (AppointmentId, ShopServiceId, Name, Price, DurationMinutes)
    SELECT (SELECT Id FROM @Out), ss.Id, ss.Name, ss.Price, ISNULL(d.DurationMinutes, ss.DurationMinutes)
    FROM data.ShopServices ss
    LEFT JOIN data.StaffServiceDurations d ON d.StaffId = @StaffId AND d.ShopServiceId = ss.Id
    WHERE ss.Id IN (SELECT Id FROM @Ids);

    -- Online talep → personele ve dükkân sahibine anlık bildirim
    IF @Status = 'pending'
    BEGIN
      DECLARE @NewId uniqueidentifier = (SELECT Id FROM @Out);
      EXEC data.usp_NotifyAppointmentEvent @NewId, 'appointment_new', @ActorId;
    END
  COMMIT;

  SELECT Id FROM @Out;
END
GO

-- Randevu durumu:
--   personel/sahip: pending → accepted | rejected | cancelled ; accepted → completed | no_show | cancelled
--   müşteri: kendi randevusunu başlangıçtan en geç 1 saat önce iptal edebilir
CREATE OR ALTER PROCEDURE api.Appointment_SetStatus
  @ActorId uniqueidentifier, @AppointmentId uniqueidentifier, @Status varchar(10)
AS
BEGIN
  SET NOCOUNT ON; SET XACT_ABORT ON;
  DECLARE @ShopId uniqueidentifier, @StaffId uniqueidentifier, @CustomerId uniqueidentifier,
          @Current varchar(10), @StartsAt datetime2(0);
  BEGIN TRAN;
    SELECT @ShopId = ShopId, @StaffId = StaffId, @CustomerId = CustomerId, @Current = Status, @StartsAt = StartsAt
    FROM data.Appointments WITH (UPDLOCK, ROWLOCK) WHERE Id = @AppointmentId;
    IF @ShopId IS NULL THROW 50404, N'Randevu bulunamadı.', 1;

    IF data.fn_IsShopOwner(@ActorId, @ShopId) = 1 OR data.fn_IsAdmin(@ActorId) = 1
       OR EXISTS (SELECT 1 FROM data.Staff WHERE Id = @StaffId AND UserId = @ActorId AND IsActive = 1)
    BEGIN
      IF NOT ((@Current = 'pending' AND @Status IN ('accepted', 'rejected', 'cancelled'))
           OR (@Current = 'accepted' AND @Status IN ('completed', 'no_show', 'cancelled')))
        THROW 50409, N'Bu durum değişikliği yapılamaz.', 1;
    END
    ELSE IF @CustomerId = @ActorId
    BEGIN
      IF @Status <> 'cancelled' OR @Current NOT IN ('pending', 'accepted')
        THROW 50409, N'Bu durum değişikliği yapılamaz.', 1;
      IF @StartsAt < DATEADD(hour, 1, SYSUTCDATETIME())
        THROW 50409, N'Randevuya 1 saatten az kaldığı için iptal edilemez, lütfen dükkânı arayın.', 1;
    END
    ELSE
      THROW 50403, N'Bu işlem için yetkiniz yok.', 1;

    UPDATE data.Appointments
    SET Status = @Status, UpdatedAt = SYSUTCDATETIME(),
        RespondedAt = CASE WHEN @Status IN ('accepted', 'rejected') THEN SYSUTCDATETIME() ELSE RespondedAt END
    WHERE Id = @AppointmentId;

    -- Anlık bildirimler
    IF @Status IN ('accepted', 'rejected', 'cancelled')
    BEGIN
      DECLARE @Kind varchar(24) = 'appointment_' + @Status;
      EXEC data.usp_NotifyAppointmentEvent @AppointmentId, @Kind, @ActorId;
    END
    -- Yer boşaldı → yalnızca zamanı gelen müşterilere haber
    IF @Status IN ('rejected', 'cancelled')
      EXEC data.usp_NotifySlotOpened @AppointmentId;
  COMMIT;
END
GO

-- Bir personelin o günkü dolu saatleri (isim içermez, randevu ekranı için)
CREATE OR ALTER PROCEDURE api.Appointment_BusySlots @StaffId uniqueidentifier, @Date date
AS
BEGIN
  SET NOCOUNT ON;
  DECLARE @From datetime2(0) = data.fn_ToUtc(CAST(@Date AS datetime2(0)));
  DECLARE @To datetime2(0) = DATEADD(day, 1, @From);
  SELECT data.fn_ToIstanbul(StartsAt) AS StartsAtLocal, data.fn_ToIstanbul(EndsAt) AS EndsAtLocal
  FROM data.Appointments
  WHERE StaffId = @StaffId AND Status IN ('pending', 'accepted') AND StartsAt < @To AND EndsAt > @From
  ORDER BY StartsAt;
END
GO

-- "Sırayı gör": dükkânın bugünkü randevuları saat sırasıyla (müşteri adı/telefonu içermez, herkese açık)
-- IsPast: bitti / süresi geçti. Yalnızca yayındaki, Bermatik'e katılmış dükkânlar.
CREATE OR ALTER PROCEDURE api.Shop_DaySchedule @ShopId uniqueidentifier
AS
BEGIN
  SET NOCOUNT ON;
  DECLARE @From datetime2(0) = data.fn_ToUtc(CAST(CAST(data.fn_IstanbulNow() AS date) AS datetime2(0)));
  SELECT data.fn_ToIstanbul(a.StartsAt) AS StartsAtLocal, data.fn_ToIstanbul(a.EndsAt) AS EndsAtLocal, st.DisplayName AS StaffName,
         CAST(CASE WHEN a.Status IN ('completed', 'no_show') OR a.EndsAt <= SYSUTCDATETIME() THEN 1 ELSE 0 END AS bit) AS IsPast
  FROM data.Appointments a
  JOIN data.Shops s ON s.Id = a.ShopId AND s.Status = 'approved' AND s.IsClaimed = 1
  JOIN data.Staff st ON st.Id = a.StaffId
  WHERE a.ShopId = @ShopId AND a.Status IN ('pending', 'accepted', 'completed', 'no_show')
    AND a.StartsAt >= @From AND a.StartsAt < DATEADD(day, 1, @From)
  ORDER BY a.StartsAt, st.DisplayName;
END
GO

-- Müşterinin randevuları
CREATE OR ALTER PROCEDURE api.Appointment_ListMine @ActorId uniqueidentifier
AS
BEGIN
  SET NOCOUNT ON;
  SELECT a.Id, a.Status, data.fn_ToIstanbul(a.StartsAt) AS StartsAtLocal, data.fn_ToIstanbul(a.EndsAt) AS EndsAtLocal,
         a.TotalPrice, a.Note, s.Id AS ShopId, s.Name AS ShopName, s.Phone AS ShopPhone, st.DisplayName AS StaffName,
         a.StaffId, s.Segment, s.Slug AS ShopSlug, pv.Slug AS ProvinceSlug, ds.Slug AS DistrictSlug,
         (SELECT STRING_AGG(Name, N', ') FROM data.AppointmentServices WHERE AppointmentId = a.Id) AS Services,
         CAST(CASE WHEN a.Status = 'completed' AND r.Id IS NULL THEN 1 ELSE 0 END AS bit) AS CanReview
  FROM data.Appointments a
  JOIN data.Shops s ON s.Id = a.ShopId
  JOIN data.Staff st ON st.Id = a.StaffId
  JOIN data.Provinces pv ON pv.Id = s.ProvinceId
  JOIN data.Districts ds ON ds.Id = s.DistrictId
  LEFT JOIN data.Reviews r ON r.AppointmentId = a.Id
  WHERE a.CustomerId = @ActorId
  ORDER BY a.StartsAt DESC;
END
GO

-- Dükkânın randevuları: sahip hepsini, personel yalnızca kendisininkileri görür
CREATE OR ALTER PROCEDURE api.Appointment_ListForShop
  @ActorId uniqueidentifier, @ShopId uniqueidentifier, @Date date = NULL, @Status varchar(10) = NULL
AS
BEGIN
  SET NOCOUNT ON;
  DECLARE @IsOwner bit = data.fn_IsShopOwner(@ActorId, @ShopId);
  IF @IsOwner = 0 AND data.fn_IsShopMember(@ActorId, @ShopId) = 0 AND data.fn_IsAdmin(@ActorId) = 0
    THROW 50403, N'Bu işlem için yetkiniz yok.', 1;
  DECLARE @From datetime2(0) = CASE WHEN @Date IS NOT NULL THEN data.fn_ToUtc(CAST(@Date AS datetime2(0))) END;

  SELECT a.Id, a.Status, a.Source, data.fn_ToIstanbul(a.StartsAt) AS StartsAtLocal, data.fn_ToIstanbul(a.EndsAt) AS EndsAtLocal,
         a.CustomerName, a.CustomerPhone, a.TotalPrice, a.Note, a.StaffId, st.DisplayName AS StaffName,
         (SELECT STRING_AGG(Name, N', ') FROM data.AppointmentServices WHERE AppointmentId = a.Id) AS Services
  FROM data.Appointments a
  JOIN data.Staff st ON st.Id = a.StaffId
  WHERE a.ShopId = @ShopId
    AND (@IsOwner = 1 OR data.fn_IsAdmin(@ActorId) = 1 OR st.UserId = @ActorId)
    AND (@From IS NULL OR (a.StartsAt >= @From AND a.StartsAt < DATEADD(day, 1, @From)))
    AND (@Status IS NULL OR a.Status = @Status)
  ORDER BY a.StartsAt;
END
GO

-- Personelin müşterileri (randevusu kabul edilmiş/tamamlanmış müşteriler)
CREATE OR ALTER PROCEDURE api.Staff_Customers @ActorId uniqueidentifier, @ShopId uniqueidentifier
AS
BEGIN
  SET NOCOUNT ON;
  DECLARE @IsOwner bit = data.fn_IsShopOwner(@ActorId, @ShopId);
  IF @IsOwner = 0 AND data.fn_IsShopMember(@ActorId, @ShopId) = 0 THROW 50403, N'Bu işlem için yetkiniz yok.', 1;

  SELECT a.StaffId, st.DisplayName AS StaffName, a.CustomerId,
         MAX(a.CustomerName) AS CustomerName, MAX(a.CustomerPhone) AS CustomerPhone,
         COUNT(*) AS VisitCount, data.fn_ToIstanbul(MAX(a.StartsAt)) AS LastVisitLocal
  FROM data.Appointments a
  JOIN data.Staff st ON st.Id = a.StaffId
  WHERE a.ShopId = @ShopId AND a.CustomerId IS NOT NULL AND a.Status IN ('accepted', 'completed')
    AND (@IsOwner = 1 OR st.UserId = @ActorId)
  GROUP BY a.StaffId, st.DisplayName, a.CustomerId
  ORDER BY MAX(a.StartsAt) DESC;
END
GO

-- "Personel fark etmez": tüm personelin boş saatleri birleşik; her saat için o saatte boş
-- olan personellerden biri önerilir (en erken bitiren, eşitse sıralı)
CREATE OR ALTER PROCEDURE api.Appointment_AvailableSlotsAnyStaff @ShopId uniqueidentifier, @Date date, @ServiceIdsJson nvarchar(max)
AS
BEGIN
  SET NOCOUNT ON;
  IF ISJSON(@ServiceIdsJson) = 0 THROW 50400, N'En az bir hizmet seçmelisiniz.', 1;
  WITH s AS (
    SELECT st.Id AS StaffId, st.DisplayName AS StaffName, x.StartsAtLocal, x.EndsAtLocal,
           ROW_NUMBER() OVER (PARTITION BY x.StartsAtLocal ORDER BY x.EndsAtLocal, st.DisplayName) AS rn
    FROM data.Staff st
    CROSS APPLY data.tvf_AvailableSlots(st.Id, @Date, data.fn_StaffServicesMinutes(st.Id, @ServiceIdsJson)) x
    WHERE st.ShopId = @ShopId AND st.IsActive = 1 AND data.fn_ShopIsPublic(@ShopId) = 1
  )
  SELECT StartsAtLocal, EndsAtLocal, StaffId, StaffName,
         DATEDIFF(minute, StartsAtLocal, EndsAtLocal) AS DurationMinutes
  FROM s WHERE rn = 1
  ORDER BY StartsAtLocal;
END
GO
