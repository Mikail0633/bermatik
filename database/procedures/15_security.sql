-- =====================================================================
-- Güvenlik: deneme sınırları, yeni cihaz uyarısı, bot kayıtları
-- =====================================================================

-- Deneme sınırı: bu anahtar için süre içinde kaçıncı deneme? @Max'ı aşarsa Allowed = 0.
-- Aynı anda gelen istekler sırayla sayılır (kilit), site yeniden başlasa da sayaç korunur.
CREATE OR ALTER PROCEDURE api.RateLimit_Hit @Key varchar(200), @Max int, @WindowSeconds int
AS
BEGIN
  SET NOCOUNT ON; SET XACT_ABORT ON;
  DECLARE @Now datetime2(0) = SYSUTCDATETIME(), @Hits int;
  BEGIN TRAN;
    UPDATE data.RateLimits WITH (UPDLOCK, HOLDLOCK)
    SET @Hits = Hits = CASE WHEN WindowEndsAt <= @Now THEN 1 ELSE Hits + 1 END,
        WindowEndsAt = CASE WHEN WindowEndsAt <= @Now THEN DATEADD(second, @WindowSeconds, @Now) ELSE WindowEndsAt END
    WHERE [Key] = @Key;
    IF @@ROWCOUNT = 0
    BEGIN
      INSERT INTO data.RateLimits ([Key], Hits, WindowEndsAt) VALUES (@Key, 1, DATEADD(second, @WindowSeconds, @Now));
      SET @Hits = 1;
    END
  COMMIT;
  SELECT CAST(CASE WHEN @Hits <= @Max THEN 1 ELSE 0 END AS bit) AS Allowed;
END
GO

-- Girişten sonra: bu cihaz bu hesap için tanıdık mı?
-- Yeni cihazsa kaydedilir; hesabın daha önce başka cihazı varsa kişiye güvenlik bildirimi gider.
-- (Kayıttan hemen sonraki ilk giriş uyarı vermez.)
CREATE OR ALTER PROCEDURE api.Auth_SeenDevice
  @UserId uniqueidentifier, @DeviceHash binary(32), @UserAgent nvarchar(300) = NULL, @DeviceLabel nvarchar(100) = NULL
AS
BEGIN
  SET NOCOUNT ON; SET XACT_ABORT ON;
  DECLARE @IsNew bit = 0, @Alert bit = 0;
  BEGIN TRAN;
    UPDATE data.KnownDevices SET LastSeenAt = SYSUTCDATETIME() WHERE UserId = @UserId AND DeviceHash = @DeviceHash;
    IF @@ROWCOUNT = 0
    BEGIN
      SET @IsNew = 1;
      IF EXISTS (SELECT 1 FROM data.KnownDevices WHERE UserId = @UserId) SET @Alert = 1;
      INSERT INTO data.KnownDevices (UserId, DeviceHash, UserAgent) VALUES (@UserId, @DeviceHash, LEFT(@UserAgent, 300));
      -- Bir hesapta en fazla 20 tanıdık cihaz tutulur
      DELETE FROM data.KnownDevices
      WHERE UserId = @UserId AND DeviceHash IN (SELECT DeviceHash FROM data.KnownDevices WHERE UserId = @UserId
                                                ORDER BY LastSeenAt DESC OFFSET 20 ROWS);
    END
    IF @Alert = 1
    BEGIN
      DECLARE @Body nvarchar(300) = N'Hesabınıza yeni bir cihazdan giriş yapıldı: ' + ISNULL(@DeviceLabel, N'bilinmeyen cihaz')
        + N' · ' + FORMAT(data.fn_ToIstanbul(SYSUTCDATETIME()), 'dd.MM.yyyy HH:mm')
        + N'. Siz değilseniz hemen şifrenizi değiştirin.';
      EXEC data.usp_Enqueue @UserId, 'security', N'Yeni cihazdan giriş', @Body, N'/hesabim';
    END
  COMMIT;
  SELECT @IsNew AS IsNew, @Alert AS Alerted, u.Email, u.FirstName FROM data.Users u WHERE u.Id = @UserId;
END
GO

-- Engellenen bot denemesi (istatistik; 90 gün saklanır)
CREATE OR ALTER PROCEDURE api.Bot_Log @Form varchar(30), @Reason varchar(20), @IpAddress varchar(45) = NULL
AS
BEGIN
  SET NOCOUNT ON;
  INSERT INTO data.BotBlocks (Form, Reason, IpAddress) VALUES (LEFT(@Form, 30), LEFT(@Reason, 20), LEFT(@IpAddress, 45));
END
GO
