-- =====================================================================
-- Bermatik — Bildirimler, kampanyalar, "saç uzama" zamanlayıcısı
-- Bildirimler yalnızca telefon/tarayıcı bildirimi (push) olarak gider.
-- Gönderimi sitedeki bir arka plan görevi yapar (api.Worker_* işlemleri):
-- kuyruktan alır → bildirimi gönderir → sonucu yazar.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Zamanlayıcı: müşterinin bir sonraki "zamanı geldi" tarihi
--   Her hizmet kategorisi için: son ziyaret + (müşterinin kendi ortalama aralığı
--   en az 2 ziyaret varsa, yoksa kategorinin RevisitDays değeri).
--   Birden çok hizmet varsa en erken tarih alınır.
--   @ShopId NULL = tüm dükkânlardaki ziyaretler
-- ---------------------------------------------------------------------
CREATE OR ALTER FUNCTION data.tvf_CustomerDue(@ShopId uniqueidentifier)
RETURNS TABLE AS RETURN
  WITH v AS (
    SELECT DISTINCT a.CustomerId, a.Id AS AppointmentId, a.StartsAt, c.Id AS CategoryId, c.RevisitDays
    FROM data.Appointments a
    JOIN data.AppointmentServices aps ON aps.AppointmentId = a.Id
    JOIN data.ShopServices ss ON ss.Id = aps.ShopServiceId
    JOIN data.ServiceCategories c ON c.Id = ss.CategoryId
    WHERE a.Status = 'completed' AND a.CustomerId IS NOT NULL AND c.RevisitDays IS NOT NULL
      AND (@ShopId IS NULL OR a.ShopId = @ShopId)
  ),
  g AS (
    SELECT CustomerId, CategoryId, RevisitDays, StartsAt,
           DATEDIFF(day, LAG(StartsAt) OVER (PARTITION BY CustomerId, CategoryId ORDER BY StartsAt), StartsAt) AS Gap
    FROM v
  ),
  c AS (
    SELECT CustomerId, CategoryId, MAX(StartsAt) AS LastVisit, MAX(RevisitDays) AS DefaultDays,
           AVG(CASE WHEN Gap BETWEEN 3 AND 365 THEN Gap END) AS PersonalDays
    FROM g GROUP BY CustomerId, CategoryId
  )
  SELECT CustomerId,
         MAX(LastVisit) AS LastVisit,
         MIN(DATEADD(day, ISNULL(PersonalDays, DefaultDays), LastVisit)) AS DueAt
  FROM c GROUP BY CustomerId;
GO

-- ---------------------------------------------------------------------
-- Kuyruğa bildirim ekle. Müşteri bildirimleri açtıysa ve kayıtlı cihazı
-- varsa telefona gönderilir; yoksa yalnızca uygulamadaki zil listesine düşer.
-- ---------------------------------------------------------------------
CREATE OR ALTER PROCEDURE data.usp_Enqueue
  @UserId uniqueidentifier, @Kind varchar(24), @Title nvarchar(80), @Body nvarchar(300), @Url nvarchar(300) = NULL,
  @CampaignId uniqueidentifier = NULL, @AppointmentId uniqueidentifier = NULL
AS
BEGIN
  SET NOCOUNT ON;
  INSERT INTO data.Notifications (UserId, Kind, Title, Body, Url, CampaignId, AppointmentId, PushStatus)
  SELECT u.Id, @Kind, LEFT(@Title, 80), LEFT(@Body, 300), @Url, @CampaignId, @AppointmentId,
         CASE WHEN u.PushOptIn = 1 AND EXISTS (SELECT 1 FROM data.PushSubscriptions WHERE UserId = u.Id) THEN 'queued' END
  FROM data.Users u
  WHERE u.Id = @UserId AND u.IsActive = 1;
END
GO

-- Randevu olaylarında anlık bildirim (yeni / onaylandı / reddedildi / iptal)
CREATE OR ALTER PROCEDURE data.usp_NotifyAppointmentEvent
  @AppointmentId uniqueidentifier, @Kind varchar(24), @ActorId uniqueidentifier
AS
BEGIN
  SET NOCOUNT ON;
  DECLARE @ShopId uniqueidentifier, @ShopName nvarchar(100), @OwnerId uniqueidentifier, @StaffUserId uniqueidentifier,
          @StaffName nvarchar(60), @CustomerId uniqueidentifier, @CustomerName nvarchar(121), @When nvarchar(20);
  SELECT @ShopId = s.Id, @ShopName = s.Name, @OwnerId = s.OwnerId, @StaffUserId = st.UserId, @StaffName = st.DisplayName,
         @CustomerId = a.CustomerId, @CustomerName = a.CustomerName,
         @When = FORMAT(data.fn_ToIstanbul(a.StartsAt), 'dd.MM.yyyy HH:mm')
  FROM data.Appointments a JOIN data.Shops s ON s.Id = a.ShopId JOIN data.Staff st ON st.Id = a.StaffId
  WHERE a.Id = @AppointmentId;
  IF @ShopId IS NULL RETURN;

  DECLARE @Body nvarchar(300);
  IF @Kind = 'appointment_new'
  BEGIN
    SET @Body = @CustomerName + N', ' + @When + N' için ' + @StaffName + N' adına randevu istedi. Onaylamak için tıkla.';
    IF @StaffUserId IS NOT NULL EXEC data.usp_Enqueue @StaffUserId, @Kind, N'Yeni randevu talebi', @Body, N'/panel/randevular', NULL, @AppointmentId;
    IF @OwnerId IS DISTINCT FROM @StaffUserId EXEC data.usp_Enqueue @OwnerId, @Kind, N'Yeni randevu talebi', @Body, N'/panel/randevular', NULL, @AppointmentId;
  END
  ELSE IF @Kind IN ('appointment_accepted', 'appointment_rejected') AND @CustomerId IS NOT NULL
  BEGIN
    SET @Body = @ShopName + N' – ' + @When + N' randevunuz ' + CASE @Kind WHEN 'appointment_accepted' THEN N'onaylandı.' ELSE N'kabul edilemedi. Başka bir saat seçebilirsiniz.' END;
    DECLARE @Title nvarchar(80) = CASE @Kind WHEN 'appointment_accepted' THEN N'Randevunuz onaylandı' ELSE N'Randevunuz kabul edilemedi' END;
    EXEC data.usp_Enqueue @CustomerId, @Kind, @Title, @Body, N'/randevularim', NULL, @AppointmentId;
  END
  ELSE IF @Kind = 'appointment_cancelled'
  BEGIN
    IF @ActorId = @CustomerId
    BEGIN
      -- Müşteri iptal etti → personel ve dükkân sahibi
      SET @Body = @CustomerName + N', ' + @When + N' randevusunu iptal etti.';
      IF @StaffUserId IS NOT NULL EXEC data.usp_Enqueue @StaffUserId, @Kind, N'Randevu iptal edildi', @Body, N'/panel/randevular', NULL, @AppointmentId;
      IF @OwnerId IS DISTINCT FROM @StaffUserId EXEC data.usp_Enqueue @OwnerId, @Kind, N'Randevu iptal edildi', @Body, N'/panel/randevular', NULL, @AppointmentId;
    END
    ELSE IF @CustomerId IS NOT NULL
    BEGIN
      -- Dükkân iptal etti → müşteri
      SET @Body = @ShopName + N' – ' + @When + N' randevunuz dükkân tarafından iptal edildi.';
      EXEC data.usp_Enqueue @CustomerId, @Kind, N'Randevunuz iptal edildi', @Body, N'/randevularim', NULL, @AppointmentId;
    END
  END
END
GO

-- Boşalan randevu: yalnızca zamanı gelen müşterilere haber ver.
--   • Bu dükkândan daha önce hizmet almış olmalı
--   • "Boşalan randevu" haberlerine izin vermiş olmalı
--   • Boşalan saatte "zamanı gelmiş" olmalı (en fazla 3 gün erken)
--   • Bu dükkânda ileri tarihli randevusu olmamalı
--   • Son 24 saatte bu tür haber almamış olmalı
--   • En fazla 20 kişi, en çok geciken önce
CREATE OR ALTER PROCEDURE data.usp_NotifySlotOpened @AppointmentId uniqueidentifier
AS
BEGIN
  SET NOCOUNT ON;
  DECLARE @ShopId uniqueidentifier, @ShopName nvarchar(100), @StaffName nvarchar(60), @StartsAt datetime2(0),
          @CancelledBy uniqueidentifier, @Url nvarchar(300), @Body nvarchar(300);
  SELECT @ShopId = s.Id, @ShopName = s.Name, @StaffName = st.DisplayName, @StartsAt = a.StartsAt, @CancelledBy = a.CustomerId,
         @Url = N'/' + s.Segment + N'/' + p.Slug + N'/' + d.Slug + N'/' + s.Slug
  FROM data.Appointments a
  JOIN data.Shops s ON s.Id = a.ShopId JOIN data.Staff st ON st.Id = a.StaffId
  JOIN data.Provinces p ON p.Id = s.ProvinceId JOIN data.Districts d ON d.Id = s.DistrictId
  WHERE a.Id = @AppointmentId AND s.Status = 'approved';
  IF @ShopId IS NULL OR @StartsAt < DATEADD(hour, 1, SYSUTCDATETIME()) RETURN;

  SET @Body = @ShopName + N' – ' + FORMAT(data.fn_ToIstanbul(@StartsAt), 'dd.MM HH:mm') + N' için ' + @StaffName
            + N' adına yer açıldı. Kapmak için hemen randevu al!';

  DECLARE @Targets TABLE (UserId uniqueidentifier PRIMARY KEY);
  INSERT INTO @Targets
  SELECT TOP (20) due.CustomerId
  FROM data.tvf_CustomerDue(@ShopId) due
  JOIN data.Users u ON u.Id = due.CustomerId AND u.IsActive = 1 AND u.SlotAlertsOptIn = 1
  WHERE due.DueAt <= DATEADD(day, 3, @StartsAt)
    AND due.CustomerId IS DISTINCT FROM @CancelledBy
    AND NOT EXISTS (SELECT 1 FROM data.Appointments x
                    WHERE x.CustomerId = due.CustomerId AND x.ShopId = @ShopId
                      AND x.Status IN ('pending', 'accepted') AND x.StartsAt > SYSUTCDATETIME())
    AND NOT EXISTS (SELECT 1 FROM data.Notifications n
                    WHERE n.UserId = due.CustomerId AND n.Kind = 'slot_opened' AND n.CreatedAt > DATEADD(hour, -24, SYSUTCDATETIME()))
  ORDER BY due.DueAt;

  DECLARE @U uniqueidentifier;
  DECLARE cur CURSOR LOCAL FAST_FORWARD FOR SELECT UserId FROM @Targets;
  OPEN cur; FETCH NEXT FROM cur INTO @U;
  WHILE @@FETCH_STATUS = 0
  BEGIN
    EXEC data.usp_Enqueue @U, 'slot_opened', N'Boş randevu açıldı', @Body, @Url, NULL, @AppointmentId;
    FETCH NEXT FROM cur INTO @U;
  END
  CLOSE cur; DEALLOCATE cur;
END
GO

-- ---------------------------------------------------------------------
-- Müşterinin bildirim ayarları (ikisi de varsayılan kapalı)
-- ---------------------------------------------------------------------
CREATE OR ALTER PROCEDURE api.Notify_GetPreferences @ActorId uniqueidentifier
AS
BEGIN
  SET NOCOUNT ON;
  SELECT PushOptIn, SlotAlertsOptIn,
         CAST(CASE WHEN EXISTS (SELECT 1 FROM data.PushSubscriptions WHERE UserId = @ActorId) THEN 1 ELSE 0 END AS bit) AS HasDevice
  FROM data.Users WHERE Id = @ActorId;
END
GO

CREATE OR ALTER PROCEDURE api.Notify_SetPreferences @ActorId uniqueidentifier, @PushOptIn bit, @SlotAlertsOptIn bit
AS
BEGIN
  SET NOCOUNT ON;
  EXEC data.usp_RequireUser @ActorId;
  UPDATE data.Users SET PushOptIn = @PushOptIn, SlotAlertsOptIn = @SlotAlertsOptIn, UpdatedAt = SYSUTCDATETIME()
  WHERE Id = @ActorId;
END
GO

-- Tarayıcı/telefon bildirim aboneliği
CREATE OR ALTER PROCEDURE api.Push_Subscribe
  @ActorId uniqueidentifier, @Platform varchar(10), @Endpoint nvarchar(1000), @P256dh nvarchar(200) = NULL, @AuthKey nvarchar(100) = NULL
AS
BEGIN
  SET NOCOUNT ON; SET XACT_ABORT ON;
  EXEC data.usp_RequireUser @ActorId;
  BEGIN TRAN;
    DELETE FROM data.PushSubscriptions WHERE EndpointHash = CAST(HASHBYTES('SHA2_256', @Endpoint) AS binary(32));
    INSERT INTO data.PushSubscriptions (UserId, Platform, Endpoint, P256dh, AuthKey)
    VALUES (@ActorId, @Platform, @Endpoint, @P256dh, @AuthKey);
    IF (SELECT COUNT(*) FROM data.PushSubscriptions WHERE UserId = @ActorId) > 10
      DELETE FROM data.PushSubscriptions
      WHERE Id IN (SELECT Id FROM data.PushSubscriptions WHERE UserId = @ActorId ORDER BY LastSeenAt DESC OFFSET 10 ROWS);
    UPDATE data.Users SET PushOptIn = 1 WHERE Id = @ActorId;
  COMMIT;
END
GO

-- Kişinin kendi cihazları ("deneme bildirimi gönder" için)
CREATE OR ALTER PROCEDURE api.Push_ListMine @ActorId uniqueidentifier
AS
BEGIN
  SET NOCOUNT ON;
  EXEC data.usp_RequireUser @ActorId;
  SELECT Endpoint, P256dh, AuthKey FROM data.PushSubscriptions WHERE UserId = @ActorId;
END
GO

CREATE OR ALTER PROCEDURE api.Push_Unsubscribe @Endpoint nvarchar(1000)
AS
BEGIN
  SET NOCOUNT ON;
  DELETE FROM data.PushSubscriptions WHERE EndpointHash = CAST(HASHBYTES('SHA2_256', @Endpoint) AS binary(32));
END
GO

-- Zil listesi
CREATE OR ALTER PROCEDURE api.Notification_ListMine @ActorId uniqueidentifier, @Top int = 30
AS
BEGIN
  SET NOCOUNT ON;
  SELECT TOP (CASE WHEN @Top > 100 THEN 100 ELSE @Top END)
         Id, Kind, Title, Body, Url, data.fn_ToIstanbul(CreatedAt) AS CreatedAtLocal,
         CAST(CASE WHEN ReadAt IS NULL THEN 0 ELSE 1 END AS bit) AS IsRead
  FROM data.Notifications WHERE UserId = @ActorId
  ORDER BY Id DESC;
END
GO

-- Zil üzerindeki kırmızı sayı
CREATE OR ALTER PROCEDURE api.Notification_UnreadCount @ActorId uniqueidentifier
AS
BEGIN
  SET NOCOUNT ON;
  SELECT COUNT(*) AS UnreadCount FROM data.Notifications WHERE UserId = @ActorId AND ReadAt IS NULL;
END
GO

-- @NotificationId NULL = hepsini okundu yap
CREATE OR ALTER PROCEDURE api.Notification_MarkRead @ActorId uniqueidentifier, @NotificationId bigint = NULL
AS
BEGIN
  SET NOCOUNT ON;
  UPDATE data.Notifications SET ReadAt = SYSUTCDATETIME()
  WHERE UserId = @ActorId AND ReadAt IS NULL AND (@NotificationId IS NULL OR Id = @NotificationId);
END
GO

-- ---------------------------------------------------------------------
-- Hazır mesajlar ve kampanyalar
-- Admin: her yerde, hazır mesajla veya kendi yazdığı metinle gönderir.
-- Dükkân sahibi: yalnızca kendi müşterilerine, yalnızca hazır mesajlardan gönderir.
-- Spam koruması: bir müşteri 7 günde en fazla 2 kampanya mesajı alır.
-- ---------------------------------------------------------------------
-- @ShopId verilirse yalnızca o dükkânın bölümüne (erkek/kadın) uygun mesajlar
CREATE OR ALTER PROCEDURE api.Template_List @ActorId uniqueidentifier, @ShopId uniqueidentifier = NULL
AS
BEGIN
  SET NOCOUNT ON;
  EXEC data.usp_RequireUser @ActorId;
  DECLARE @Seg varchar(5) = (SELECT Segment FROM data.Shops WHERE Id = @ShopId);
  SELECT Id, Title, Body, IsActive, Segment FROM data.MessageTemplates
  WHERE (IsActive = 1 OR data.fn_IsAdmin(@ActorId) = 1)
    AND (@ShopId IS NULL OR Segment IS NULL OR Segment = @Seg)
  ORDER BY SortOrder, Id;
END
GO

CREATE OR ALTER PROCEDURE api.Admin_Template_Save
  @ActorId uniqueidentifier, @TemplateId int = NULL, @Title nvarchar(80), @Body nvarchar(300), @IsActive bit = 1, @SortOrder int = 0,
  @Segment varchar(5) = NULL
AS
BEGIN
  SET NOCOUNT ON; SET XACT_ABORT ON;
  EXEC data.usp_RequireAdmin @ActorId;
  BEGIN TRAN;
    IF @TemplateId IS NULL
    BEGIN
      INSERT INTO data.MessageTemplates (Title, Body, IsActive, SortOrder, Segment) VALUES (@Title, @Body, @IsActive, @SortOrder, @Segment);
      SET @TemplateId = SCOPE_IDENTITY();
    END
    ELSE
    BEGIN
      UPDATE data.MessageTemplates SET Title = @Title, Body = @Body, IsActive = @IsActive, SortOrder = @SortOrder, Segment = @Segment WHERE Id = @TemplateId;
      IF @@ROWCOUNT = 0 THROW 50404, N'Mesaj bulunamadı.', 1;
    END
    DECLARE @EntityId nvarchar(64) = CAST(@TemplateId AS nvarchar(64));
    DECLARE @Details nvarchar(max) = (SELECT @Title AS title FOR JSON PATH, WITHOUT_ARRAY_WRAPPER);
    EXEC data.usp_Log @ActorId, 'template_save', 'message_templates', @EntityId, @Details;
  COMMIT;
  SELECT @TemplateId AS Id;
END
GO

-- Kampanya hedef kitlesi (gönderim ve "kaç kişiye gidecek" önizlemesi için ortak)
CREATE OR ALTER FUNCTION data.tvf_CampaignAudience(
  @ShopId uniqueidentifier, @OnlyDue bit, @Segment varchar(5), @ProvinceId tinyint)
RETURNS TABLE AS RETURN
  SELECT u.Id AS UserId, u.FirstName
  FROM data.Users u
  LEFT JOIN data.tvf_CustomerDue(@ShopId) due ON due.CustomerId = u.Id
  WHERE u.IsActive = 1 AND u.Role = 'customer'
    -- dükkân kampanyası: bildirimleri açmış ve kayıtlı cihazı olmalı (Bermatik duyuruları herkesin listesine düşer)
    AND (@ShopId IS NULL OR (u.PushOptIn = 1 AND EXISTS (SELECT 1 FROM data.PushSubscriptions ps WHERE ps.UserId = u.Id)))
    -- dükkân kampanyası: yalnızca o dükkânın müşterileri
    AND (@ShopId IS NULL OR EXISTS (SELECT 1 FROM data.Appointments a WHERE a.CustomerId = u.Id AND a.ShopId = @ShopId
                                                                       AND a.Status IN ('accepted', 'completed')))
    -- yalnızca zamanı gelenler: yeni traş olana gitmez (geçmişi olmayan admin kampanyalarında dahil)
    AND (@OnlyDue = 0 OR due.DueAt IS NULL OR due.DueAt <= DATEADD(day, 3, SYSUTCDATETIME()))
    -- erkek/kadın ve il filtresi: o bölümde/ilde randevu almış müşteriler
    AND (@Segment IS NULL OR EXISTS (SELECT 1 FROM data.Appointments a JOIN data.Shops s ON s.Id = a.ShopId
                                     WHERE a.CustomerId = u.Id AND s.Segment = @Segment))
    AND (@ProvinceId IS NULL OR EXISTS (SELECT 1 FROM data.Appointments a JOIN data.Shops s ON s.Id = a.ShopId
                                        WHERE a.CustomerId = u.Id AND s.ProvinceId = @ProvinceId))
    -- spam koruması: 7 günde en fazla 2 kampanya
    AND (SELECT COUNT(*) FROM data.Notifications n
         WHERE n.UserId = u.Id AND n.Kind = 'campaign' AND n.CreatedAt > DATEADD(day, -7, SYSUTCDATETIME())) < 2;
GO

CREATE OR ALTER PROCEDURE data.usp_CheckCampaignRights
  @ActorId uniqueidentifier, @ShopId uniqueidentifier, @TemplateId int, @Body nvarchar(300)
AS
BEGIN
  SET NOCOUNT ON;
  IF data.fn_IsAdmin(@ActorId) = 1 RETURN;
  IF @ShopId IS NULL OR data.fn_IsShopOwner(@ActorId, @ShopId) = 0 OR data.fn_ShopIsPublic(@ShopId) = 0
    THROW 50403, N'Bu işlem için yetkiniz yok.', 1;
  IF @TemplateId IS NULL OR NOT EXISTS (SELECT 1 FROM data.MessageTemplates t JOIN data.Shops s ON s.Id = @ShopId
                                        WHERE t.Id = @TemplateId AND t.IsActive = 1 AND (t.Segment IS NULL OR t.Segment = s.Segment))
    THROW 50400, N'Lütfen hazır mesajlardan birini seçin.', 1;
  IF @Body IS NOT NULL THROW 50403, N'Dükkânlar yalnızca hazır mesaj gönderebilir.', 1;
END
GO

-- "Bu mesaj kaç kişiye gidecek?" önizlemesi
CREATE OR ALTER PROCEDURE api.Campaign_PreviewCount
  @ActorId uniqueidentifier, @ShopId uniqueidentifier = NULL, @OnlyDue bit = 1,
  @Segment varchar(5) = NULL, @ProvinceId tinyint = NULL
AS
BEGIN
  SET NOCOUNT ON;
  IF data.fn_IsAdmin(@ActorId) = 0 AND (@ShopId IS NULL OR data.fn_IsShopOwner(@ActorId, @ShopId) = 0)
    THROW 50403, N'Bu işlem için yetkiniz yok.', 1;
  SELECT COUNT(*) AS RecipientCount FROM data.tvf_CampaignAudience(@ShopId, @OnlyDue, @Segment, @ProvinceId);
END
GO

CREATE OR ALTER PROCEDURE api.Campaign_Send
  @ActorId uniqueidentifier, @ShopId uniqueidentifier = NULL, @TemplateId int = NULL,
  @Title nvarchar(80) = NULL, @Body nvarchar(300) = NULL, @OnlyDue bit = 1,
  @Segment varchar(5) = NULL, @ProvinceId tinyint = NULL
AS
BEGIN
  SET NOCOUNT ON; SET XACT_ABORT ON;
  EXEC data.usp_RequireUser @ActorId;
  EXEC data.usp_CheckCampaignRights @ActorId, @ShopId, @TemplateId, @Body;

  IF @TemplateId IS NOT NULL
    SELECT @Title = ISNULL(@Title, Title), @Body = ISNULL(@Body, Body) FROM data.MessageTemplates WHERE Id = @TemplateId;
  IF NULLIF(LTRIM(RTRIM(@Title)), N'') IS NULL OR NULLIF(LTRIM(RTRIM(@Body)), N'') IS NULL
    THROW 50400, N'Mesaj başlığı ve metni gerekli.', 1;
  -- Dükkân bir saatte en fazla 1 kampanya gönderebilir
  IF @ShopId IS NOT NULL AND data.fn_IsAdmin(@ActorId) = 0
     AND EXISTS (SELECT 1 FROM data.Campaigns WHERE ShopId = @ShopId AND CreatedAt > DATEADD(hour, -1, SYSUTCDATETIME()))
    THROW 50409, N'Bir saat içinde yalnızca bir kampanya gönderebilirsiniz.', 1;

  DECLARE @ShopName nvarchar(100) = ISNULL((SELECT Name FROM data.Shops WHERE Id = @ShopId), N'Bermatik');
  DECLARE @Url nvarchar(300) = (SELECT N'/' + s.Segment + N'/' + p.Slug + N'/' + d.Slug + N'/' + s.Slug
                                FROM data.Shops s JOIN data.Provinces p ON p.Id = s.ProvinceId JOIN data.Districts d ON d.Id = s.DistrictId
                                WHERE s.Id = @ShopId);
  DECLARE @CampaignId uniqueidentifier = NEWID(), @Count int;

  BEGIN TRAN;
    INSERT INTO data.Campaigns (Id, ShopId, TemplateId, Title, Body, OnlyDue, Segment, ProvinceId, CreatedBy)
    VALUES (@CampaignId, @ShopId, @TemplateId, @Title, @Body, @OnlyDue, @Segment, @ProvinceId, @ActorId);

    INSERT INTO data.Notifications (UserId, Kind, Title, Body, Url, CampaignId, PushStatus)
    SELECT a.UserId, 'campaign',
           LEFT(REPLACE(REPLACE(@Title, N'{ad}', a.FirstName), N'{dukkan}', @ShopName), 80),
           LEFT(REPLACE(REPLACE(@Body, N'{ad}', a.FirstName), N'{dukkan}', @ShopName), 300),
           @Url, @CampaignId,
           CASE WHEN EXISTS (SELECT 1 FROM data.Users x WHERE x.Id = a.UserId AND x.PushOptIn = 1)
                 AND EXISTS (SELECT 1 FROM data.PushSubscriptions ps WHERE ps.UserId = a.UserId) THEN 'queued' END
    FROM data.tvf_CampaignAudience(@ShopId, @OnlyDue, @Segment, @ProvinceId) a;
    SET @Count = @@ROWCOUNT;

    UPDATE data.Campaigns SET RecipientCount = @Count WHERE Id = @CampaignId;
    DECLARE @EntityId nvarchar(64) = CONVERT(nvarchar(64), @CampaignId);
    DECLARE @Details nvarchar(max) = (SELECT @Title AS title, @Count AS recipients, @ShopId AS shopId FOR JSON PATH, WITHOUT_ARRAY_WRAPPER);
    EXEC data.usp_Log @ActorId, 'campaign_send', 'campaigns', @EntityId, @Details;
  COMMIT;
  SELECT @CampaignId AS Id, @Count AS RecipientCount;
END
GO

CREATE OR ALTER PROCEDURE api.Campaign_List @ActorId uniqueidentifier, @ShopId uniqueidentifier = NULL
AS
BEGIN
  SET NOCOUNT ON;
  IF data.fn_IsAdmin(@ActorId) = 0 AND (@ShopId IS NULL OR data.fn_IsShopOwner(@ActorId, @ShopId) = 0)
    THROW 50403, N'Bu işlem için yetkiniz yok.', 1;
  SELECT TOP (100) c.Id, c.Title, c.Body, c.OnlyDue, c.RecipientCount, data.fn_ToIstanbul(c.CreatedAt) AS CreatedAtLocal,
         s.Name AS ShopName,
         (SELECT COUNT(*) FROM data.Notifications n WHERE n.CampaignId = c.Id AND n.PushStatus = 'sent') AS DeliveredCount
  FROM data.Campaigns c LEFT JOIN data.Shops s ON s.Id = c.ShopId
  WHERE (@ShopId IS NULL OR c.ShopId = @ShopId)
  ORDER BY c.CreatedAt DESC;
END
GO

-- ---------------------------------------------------------------------
-- Gönderim görevi (sitenin arka planında çalışır)
-- 10 dakikadan uzun "sending" kalanlar tekrar denenir; 3 denemede başarısız sayılır.
-- ---------------------------------------------------------------------
CREATE OR ALTER PROCEDURE api.Worker_NextPush @Top int = 50
AS
BEGIN
  SET NOCOUNT ON; SET XACT_ABORT ON;
  DECLARE @Claimed TABLE (Id bigint PRIMARY KEY);
  BEGIN TRAN;
    UPDATE TOP (@Top) n SET PushStatus = 'sending', ClaimedAt = SYSUTCDATETIME(), Attempts = Attempts + 1
    OUTPUT inserted.Id INTO @Claimed
    FROM data.Notifications n WITH (READPAST, UPDLOCK, ROWLOCK)
    WHERE n.PushStatus = 'queued' OR (n.PushStatus = 'sending' AND n.ClaimedAt < DATEADD(minute, -10, SYSUTCDATETIME()));
    -- Bu arada cihazı silinmiş kişiler: gönderilecek yer yok, kuyrukta takılı kalmasın
    UPDATE n SET PushStatus = 'failed', LastError = N'Kayıtlı cihaz yok'
    FROM data.Notifications n JOIN @Claimed c ON c.Id = n.Id
    WHERE NOT EXISTS (SELECT 1 FROM data.PushSubscriptions ps WHERE ps.UserId = n.UserId);
  COMMIT;
  SELECT n.Id AS NotificationId, n.Title, n.Body, n.Url, ps.Endpoint, ps.P256dh, ps.AuthKey, ps.Platform
  FROM data.Notifications n
  JOIN @Claimed c ON c.Id = n.Id
  JOIN data.PushSubscriptions ps ON ps.UserId = n.UserId;
END
GO

-- @GoneEndpoint: cihaz aboneliği artık geçersiz (tarayıcı 404/410 döndü) → silinir
CREATE OR ALTER PROCEDURE api.Worker_PushResult
  @NotificationId bigint, @Success bit, @Error nvarchar(300) = NULL, @GoneEndpoint nvarchar(1000) = NULL
AS
BEGIN
  SET NOCOUNT ON;
  IF @GoneEndpoint IS NOT NULL
    DELETE FROM data.PushSubscriptions WHERE EndpointHash = CAST(HASHBYTES('SHA2_256', @GoneEndpoint) AS binary(32));
  UPDATE data.Notifications
  SET PushStatus = CASE WHEN @Success = 1 THEN 'sent' WHEN Attempts >= 3 THEN 'failed' ELSE 'queued' END,
      SentAt = CASE WHEN @Success = 1 THEN SYSUTCDATETIME() ELSE SentAt END,
      LastError = CASE WHEN @Success = 1 THEN LastError ELSE LEFT(@Error, 300) END
  WHERE Id = @NotificationId AND PushStatus = 'sending';
END
GO
