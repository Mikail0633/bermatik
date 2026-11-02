-- =====================================================================
-- Bermatik — Değişiklik geçmişi, gece temizliği, haftalık bakım
-- =====================================================================

-- ---------------------------------------------------------------------
-- Değişiklik geçmişi: bir dükkânın, hizmetin veya ürünün tüm eski halleri
-- @Entity: 'shop' | 'service' | 'product'. Admin veya o dükkânın sahibi görür.
-- Snapshot: o andaki bilgiler (JSON). En yeni kayıt en üstte.
-- ---------------------------------------------------------------------
CREATE OR ALTER PROCEDURE api.History_List @ActorId uniqueidentifier, @Entity varchar(10), @Id uniqueidentifier
AS
BEGIN
  SET NOCOUNT ON;
  DECLARE @ShopId uniqueidentifier = CASE @Entity
    WHEN 'shop' THEN @Id
    WHEN 'service' THEN (SELECT ShopId FROM data.ShopServices FOR SYSTEM_TIME ALL WHERE Id = @Id GROUP BY ShopId)
    WHEN 'product' THEN (SELECT ShopId FROM data.Products FOR SYSTEM_TIME ALL WHERE Id = @Id GROUP BY ShopId) END;
  IF @ShopId IS NULL THROW 50404, N'Kayıt bulunamadı.', 1;
  IF data.fn_IsAdmin(@ActorId) = 0 AND data.fn_IsShopOwner(@ActorId, @ShopId) = 0
    THROW 50403, N'Bu işlem için yetkiniz yok.', 1;

  DECLARE @H TABLE (ValidFrom datetime2(7), ValidTo datetime2(7), UpdatedBy uniqueidentifier, Snapshot nvarchar(max));
  IF @Entity = 'shop'
    INSERT INTO @H
    SELECT h.ValidFrom, h.ValidTo, h.UpdatedBy,
           (SELECT h.Name AS ad, h.Phone AS telefon, h.Street AS cadde, h.BuildingNo AS no, h.Status AS durum,
                   h.IsTemporarilyClosed AS geciciKapali, h.StoreEnabled AS urunSatisi, h.QueueAvgMinutes AS siraOrtalama
            FOR JSON PATH, WITHOUT_ARRAY_WRAPPER)
    FROM data.Shops FOR SYSTEM_TIME ALL h WHERE h.Id = @Id;
  ELSE IF @Entity = 'service'
    INSERT INTO @H
    SELECT h.ValidFrom, h.ValidTo, h.UpdatedBy,
           (SELECT h.Name AS ad, h.Price AS fiyat, h.DurationMinutes AS sure, h.IsActive AS aktif FOR JSON PATH, WITHOUT_ARRAY_WRAPPER)
    FROM data.ShopServices FOR SYSTEM_TIME ALL h WHERE h.Id = @Id;
  ELSE IF @Entity = 'product'
    INSERT INTO @H
    SELECT h.ValidFrom, h.ValidTo, h.UpdatedBy,
           (SELECT h.Name AS ad, h.Price AS fiyat, h.Stock AS stok, h.IsActive AS aktif FOR JSON PATH, WITHOUT_ARRAY_WRAPPER)
    FROM data.Products FOR SYSTEM_TIME ALL h WHERE h.Id = @Id;
  ELSE
    THROW 50400, N'Geçersiz kayıt türü.', 1;

  SELECT data.fn_ToIstanbul(x.ValidFrom) AS ChangedAtLocal,
         CASE WHEN x.ValidTo >= '9999-01-01' THEN CAST(1 AS bit) ELSE CAST(0 AS bit) END AS IsCurrent,
         ISNULL(u.FirstName + N' ' + u.LastName, N'Sistem (sipariş/stok)') AS ChangedBy,
         x.Snapshot
  FROM @H x LEFT JOIN data.Users u ON u.Id = x.UpdatedBy
  ORDER BY x.ValidFrom DESC;
END
GO

-- ---------------------------------------------------------------------
-- Gece temizliği (bakım görevi her gece çalıştırır; site çağıramaz)
-- Gereksiz veriyi siler: veritabanı şişmez, KVKK "gereğinden fazla tutma" kuralına uyar.
-- ---------------------------------------------------------------------
CREATE OR ALTER PROCEDURE data.usp_NightlyCleanup
AS
BEGIN
  SET NOCOUNT ON;
  DECLARE @Now datetime2(0) = SYSUTCDATETIME();
  DECLARE @Sessions int, @Tokens int, @Notifications int, @Devices int, @Queue int, @Reports int, @Audit int, @n int;

  DELETE FROM data.Sessions WHERE ExpiresAt < @Now;                                    -- süresi dolmuş oturumlar
  SET @Sessions = @@ROWCOUNT;
  DELETE FROM data.PasswordResetTokens WHERE CreatedAt < DATEADD(day, -1, @Now);       -- eski şifre kodları
  SET @Tokens = @@ROWCOUNT;

  -- Bildirimler: okunmuşlar 90 gün, okunmamışlar 180 gün saklanır (5000'erlik parçalarla, kilit uzamasın)
  SET @Notifications = 0;
  WHILE 1 = 1
  BEGIN
    DELETE TOP (5000) FROM data.Notifications
    WHERE (ReadAt IS NOT NULL AND CreatedAt < DATEADD(day, -90, @Now)) OR CreatedAt < DATEADD(day, -180, @Now);
    SET @n = @@ROWCOUNT; SET @Notifications += @n;
    IF @n < 5000 BREAK;
  END

  DELETE FROM data.PushSubscriptions WHERE LastSeenAt < DATEADD(day, -365, @Now);      -- 1 yıldır görünmeyen cihazlar
  SET @Devices = @@ROWCOUNT;
  DELETE FROM data.QueueEntries WHERE QueueDate < DATEADD(year, -2, CAST(@Now AS date)); -- 2 yıllık sıra kayıtları
  SET @Queue = @@ROWCOUNT;
  DELETE FROM data.Reports WHERE Status <> 'open' AND ResolvedAt < DATEADD(year, -2, @Now);
  SET @Reports = @@ROWCOUNT;
  DELETE FROM data.AuditLog WHERE CreatedAt < DATEADD(year, -3, @Now);                -- admin kayıtları 3 yıl
  SET @Audit = @@ROWCOUNT;

  -- Güvenlik: süresi dolmuş deneme sayaçları, 90 günlük bot kayıtları, 1 yıldır görünmeyen tanınmış cihazlar
  DELETE FROM data.RateLimits WHERE WindowEndsAt < @Now;
  DECLARE @Security int = @@ROWCOUNT;
  DELETE FROM data.BotBlocks WHERE CreatedAt < DATEADD(day, -90, @Now);
  SET @Security += @@ROWCOUNT;
  DELETE FROM data.KnownDevices WHERE LastSeenAt < DATEADD(day, -365, @Now);
  SET @Security += @@ROWCOUNT;

  SELECT @Sessions AS Sessions, @Tokens AS ResetCodes, @Notifications AS Notifications, @Devices AS Devices,
         @Queue AS QueueEntries, @Reports AS Reports, @Audit AS AuditLog, @Security AS Security;
END
GO

-- ---------------------------------------------------------------------
-- Haftalık bakım: dağınık dizinleri düzenler, istatistikleri yeniler
-- ---------------------------------------------------------------------
CREATE OR ALTER PROCEDURE data.usp_WeeklyMaintenance
AS
BEGIN
  SET NOCOUNT ON;
  DECLARE @sql nvarchar(max), @Rebuilt int = 0, @Reorganized int = 0;
  DECLARE @Schema sysname, @Table sysname, @Index sysname, @Frag float;

  DECLARE cur CURSOR LOCAL FAST_FORWARD FOR
    SELECT s.name, t.name, i.name, ps.avg_fragmentation_in_percent
    FROM sys.dm_db_index_physical_stats(DB_ID(), NULL, NULL, NULL, 'LIMITED') ps
    JOIN sys.indexes i ON i.object_id = ps.object_id AND i.index_id = ps.index_id
    JOIN sys.tables t ON t.object_id = ps.object_id
    JOIN sys.schemas s ON s.schema_id = t.schema_id
    WHERE ps.page_count >= 100 AND ps.avg_fragmentation_in_percent >= 10 AND i.name IS NOT NULL
      AND i.type IN (1, 2);   -- normal dizinler (harita dizini hariç)
  OPEN cur; FETCH NEXT FROM cur INTO @Schema, @Table, @Index, @Frag;
  WHILE @@FETCH_STATUS = 0
  BEGIN
    IF @Frag >= 30
    BEGIN
      SET @sql = N'ALTER INDEX ' + QUOTENAME(@Index) + N' ON ' + QUOTENAME(@Schema) + N'.' + QUOTENAME(@Table) + N' REBUILD WITH (ONLINE = ON);';
      SET @Rebuilt += 1;
    END
    ELSE
    BEGIN
      SET @sql = N'ALTER INDEX ' + QUOTENAME(@Index) + N' ON ' + QUOTENAME(@Schema) + N'.' + QUOTENAME(@Table) + N' REORGANIZE;';
      SET @Reorganized += 1;
    END
    EXEC (@sql);
    FETCH NEXT FROM cur INTO @Schema, @Table, @Index, @Frag;
  END
  CLOSE cur; DEALLOCATE cur;

  EXEC sp_updatestats;
  SELECT @Rebuilt AS IndexesRebuilt, @Reorganized AS IndexesReorganized;
END
GO
