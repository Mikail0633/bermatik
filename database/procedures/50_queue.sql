-- =====================================================================
-- Bermatik — Canlı sıra
-- Sayfalar api.Queue_State'i birkaç saniyede bir sorar; Version değişince ekran yenilenir.
-- =====================================================================

-- Sıraya gir. Personel/sahip çağırırsa dükkâna gelen misafir olarak eklenir (@GuestName).
CREATE OR ALTER PROCEDURE api.Queue_Join
  @ActorId uniqueidentifier, @ShopId uniqueidentifier, @StaffId uniqueidentifier = NULL, @GuestName nvarchar(60) = NULL
AS
BEGIN
  SET NOCOUNT ON; SET XACT_ABORT ON;
  EXEC data.usp_RequireUser @ActorId;
  IF data.fn_ShopIsPublic(@ShopId) = 0 THROW 50404, N'Dükkân bulunamadı.', 1;
  IF EXISTS (SELECT 1 FROM data.Shops WHERE Id = @ShopId AND IsClaimed = 0)
    THROW 50409, N'Bu dükkân henüz Bermatik''e katılmadı. Telefonla arayabilirsiniz.', 1;
  DECLARE @IsMember bit = data.fn_CanWorkShop(@ActorId, @ShopId);
  IF @IsMember = 0 AND NOT EXISTS (SELECT 1 FROM data.tvf_ShopOpenStatus(@ShopId) WHERE IsOpen = 1)
    THROW 50409, N'Dükkân şu an kapalı.', 1;
  IF @StaffId IS NOT NULL AND NOT EXISTS (SELECT 1 FROM data.Staff WHERE Id = @StaffId AND ShopId = @ShopId AND IsActive = 1)
    THROW 50404, N'Personel bulunamadı.', 1;
  SET @GuestName = NULLIF(LTRIM(RTRIM(@GuestName)), N'');
  IF @IsMember = 1 AND @GuestName IS NULL THROW 50400, N'Müşteri adı gerekli.', 1;
  IF @IsMember = 0 AND EXISTS (SELECT 1 FROM data.QueueEntries WHERE CustomerId = @ActorId AND Status IN ('waiting', 'serving'))
    THROW 50409, N'Zaten bir sıradasınız.', 1;

  DECLARE @Today date = CAST(data.fn_IstanbulNow() AS date);
  DECLARE @Out TABLE (Id uniqueidentifier, TicketNo int);
  BEGIN TRAN;
    DECLARE @Lock nvarchar(100) = N'queue:' + CONVERT(nvarchar(36), @ShopId);
    EXEC sp_getapplock @Resource = @Lock, @LockMode = 'Exclusive', @LockOwner = 'Transaction', @LockTimeout = 10000;
    DECLARE @Ticket int = ISNULL((SELECT MAX(TicketNo) FROM data.QueueEntries WHERE ShopId = @ShopId AND QueueDate = @Today), 0) + 1;

    INSERT INTO data.QueueEntries (ShopId, StaffId, CustomerId, GuestName, QueueDate, TicketNo)
    OUTPUT inserted.Id, inserted.TicketNo INTO @Out
    VALUES (@ShopId, @StaffId, CASE WHEN @IsMember = 1 THEN NULL ELSE @ActorId END,
            CASE WHEN @IsMember = 1 THEN @GuestName END, @Today, @Ticket);
    EXEC data.usp_RefreshQueueState @ShopId;
  COMMIT;
  SELECT Id, TicketNo FROM @Out;
END
GO

-- Sıradakini çağır (personel/sahip). O personelin önceki müşterisi "tamamlandı" olur.
CREATE OR ALTER PROCEDURE api.Queue_CallNext @ActorId uniqueidentifier, @ShopId uniqueidentifier, @StaffId uniqueidentifier = NULL
AS
BEGIN
  SET NOCOUNT ON; SET XACT_ABORT ON;
  IF data.fn_CanWorkShop(@ActorId, @ShopId) = 0 THROW 50403, N'Bu işlem için yetkiniz yok.', 1;
  DECLARE @Today date = CAST(data.fn_IstanbulNow() AS date);
  DECLARE @Out TABLE (Id uniqueidentifier, TicketNo int, GuestName nvarchar(60), CustomerId uniqueidentifier);

  BEGIN TRAN;
    DECLARE @Lock nvarchar(100) = N'queue:' + CONVERT(nvarchar(36), @ShopId);
    EXEC sp_getapplock @Resource = @Lock, @LockMode = 'Exclusive', @LockOwner = 'Transaction', @LockTimeout = 10000;

    UPDATE data.QueueEntries SET Status = 'done', FinishedAt = SYSUTCDATETIME()
    WHERE ShopId = @ShopId AND Status = 'serving'
      AND ((@StaffId IS NULL AND StaffId IS NULL) OR StaffId = @StaffId);

    UPDATE q SET Status = 'serving', CalledAt = SYSUTCDATETIME(), StaffId = ISNULL(q.StaffId, @StaffId)
    OUTPUT inserted.Id, inserted.TicketNo, inserted.GuestName, inserted.CustomerId INTO @Out
    FROM data.QueueEntries q
    WHERE q.Id = (SELECT TOP (1) Id FROM data.QueueEntries
                  WHERE ShopId = @ShopId AND QueueDate = @Today AND Status = 'waiting'
                    AND (@StaffId IS NULL OR StaffId IS NULL OR StaffId = @StaffId)
                  ORDER BY TicketNo);
    EXEC data.usp_RefreshQueueState @ShopId;
  COMMIT;
  SELECT o.Id, o.TicketNo, ISNULL(o.GuestName, u.FirstName + N' ' + u.LastName) AS CustomerName
  FROM @Out o LEFT JOIN data.Users u ON u.Id = o.CustomerId;   -- sırada kimse yoksa boş
END
GO

-- Sıra kaydı durumu: personel → done | no_show | cancelled ; müşteri → kendi bekleyen kaydını iptal
CREATE OR ALTER PROCEDURE api.Queue_SetStatus @ActorId uniqueidentifier, @EntryId uniqueidentifier, @Status varchar(10)
AS
BEGIN
  SET NOCOUNT ON; SET XACT_ABORT ON;
  DECLARE @ShopId uniqueidentifier, @CustomerId uniqueidentifier, @Current varchar(10);
  BEGIN TRAN;
    SELECT @ShopId = ShopId, @CustomerId = CustomerId, @Current = Status
    FROM data.QueueEntries WITH (UPDLOCK, ROWLOCK) WHERE Id = @EntryId;
    IF @ShopId IS NULL THROW 50404, N'Kayıt bulunamadı.', 1;

    IF data.fn_CanWorkShop(@ActorId, @ShopId) = 1
    BEGIN
      IF @Status NOT IN ('done', 'no_show', 'cancelled') OR @Current NOT IN ('waiting', 'serving')
        THROW 50409, N'Bu durum değişikliği yapılamaz.', 1;
    END
    ELSE IF @CustomerId = @ActorId
    BEGIN
      IF @Status <> 'cancelled' OR @Current <> 'waiting' THROW 50409, N'Bu durum değişikliği yapılamaz.', 1;
    END
    ELSE
      THROW 50403, N'Bu işlem için yetkiniz yok.', 1;

    UPDATE data.QueueEntries SET Status = @Status, FinishedAt = SYSUTCDATETIME() WHERE Id = @EntryId;
    EXEC data.usp_RefreshQueueState @ShopId;
  COMMIT;
END
GO

-- Herkese açık sıra özeti (isim yok). Version değişmediyse ekran yenilenmez.
CREATE OR ALTER PROCEDURE api.Queue_State @ShopId uniqueidentifier
AS
BEGIN
  SET NOCOUNT ON;
  SELECT q.CurrentTicket, q.WaitingCount, q.Version, s.QueueAvgMinutes
  FROM data.ShopQueueState q JOIN data.Shops s ON s.Id = q.ShopId
  WHERE q.ShopId = @ShopId AND q.QueueDate = CAST(data.fn_IstanbulNow() AS date) AND s.Status = 'approved';
END
GO

-- Müşterinin aktif sıra kaydı, önündeki kişi sayısı ve tahmini bekleme süresi.
-- Belirli bir personeli bekliyorsa: o personeli (veya herhangi birini) bekleyenler sayılır,
-- süre o personelin ortalamasıyla hesaplanır (girmediyse dükkân ortalaması).
CREATE OR ALTER PROCEDURE api.Queue_MyPosition @ActorId uniqueidentifier
AS
BEGIN
  SET NOCOUNT ON;
  SELECT q.Id, q.ShopId, s.Name AS ShopName, q.TicketNo, q.Status, q.StaffId, st.DisplayName AS StaffName, a.PeopleAhead,
         a.PeopleAhead * ISNULL(st.QueueAvgMinutes, s.QueueAvgMinutes) AS EstimatedMinutes
  FROM data.QueueEntries q
  JOIN data.Shops s ON s.Id = q.ShopId
  LEFT JOIN data.Staff st ON st.Id = q.StaffId
  CROSS APPLY (SELECT COUNT(*) AS PeopleAhead FROM data.QueueEntries o
               WHERE o.ShopId = q.ShopId AND o.QueueDate = q.QueueDate AND o.Status = 'waiting' AND o.TicketNo < q.TicketNo
                 AND (q.StaffId IS NULL OR o.StaffId IS NULL OR o.StaffId = q.StaffId)) a
  WHERE q.CustomerId = @ActorId AND q.Status IN ('waiting', 'serving');
END
GO

-- Dükkân paneli: bugünkü sıra (isimlerle)
CREATE OR ALTER PROCEDURE api.Queue_ListForShop @ActorId uniqueidentifier, @ShopId uniqueidentifier
AS
BEGIN
  SET NOCOUNT ON;
  IF data.fn_CanWorkShop(@ActorId, @ShopId) = 0 THROW 50403, N'Bu işlem için yetkiniz yok.', 1;
  SELECT q.Id, q.TicketNo, q.Status, q.StaffId, st.DisplayName AS StaffName,
         ISNULL(q.GuestName, u.FirstName + N' ' + u.LastName) AS CustomerName, u.Phone AS CustomerPhone,
         data.fn_ToIstanbul(q.CreatedAt) AS JoinedAtLocal, data.fn_ToIstanbul(q.CalledAt) AS CalledAtLocal
  FROM data.QueueEntries q
  LEFT JOIN data.Users u ON u.Id = q.CustomerId
  LEFT JOIN data.Staff st ON st.Id = q.StaffId
  WHERE q.ShopId = @ShopId AND q.QueueDate = CAST(data.fn_IstanbulNow() AS date)
  ORDER BY CASE q.Status WHEN 'serving' THEN 0 WHEN 'waiting' THEN 1 ELSE 2 END, q.TicketNo;
END
GO
