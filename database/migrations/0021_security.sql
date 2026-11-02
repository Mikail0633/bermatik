-- =====================================================================
-- 0021: Güvenlik
--   1) Kalıcı deneme sınırları: "dakikada en fazla 10 giriş denemesi" gibi sayaçlar
--      artık site yeniden başlayınca sıfırlanmaz.
--   2) Bilinen cihazlar: hesaba yeni bir cihazdan girilince kişiye uyarı gider.
--   3) Engellenen bot denemeleri sayılır (istatistik için).
-- =====================================================================

CREATE TABLE data.RateLimits (
  [Key] varchar(200) NOT NULL CONSTRAINT PK_RateLimits PRIMARY KEY,   -- ör. giris:85.105.x.x
  Hits int NOT NULL,
  WindowEndsAt datetime2(0) NOT NULL
);

-- Cihaz kimliği tarayıcıdaki rastgele bir çerezdir; burada yalnızca özeti tutulur
CREATE TABLE data.KnownDevices (
  UserId uniqueidentifier NOT NULL CONSTRAINT FK_KnownDevices_User REFERENCES data.Users (Id) ON DELETE CASCADE,
  DeviceHash binary(32) NOT NULL,
  UserAgent nvarchar(300) NULL,
  FirstSeenAt datetime2(0) NOT NULL CONSTRAINT DF_KnownDevices_First DEFAULT SYSUTCDATETIME(),
  LastSeenAt datetime2(0) NOT NULL CONSTRAINT DF_KnownDevices_Last DEFAULT SYSUTCDATETIME(),
  CONSTRAINT PK_KnownDevices PRIMARY KEY (UserId, DeviceHash)
);

CREATE TABLE data.BotBlocks (
  Id bigint IDENTITY(1, 1) NOT NULL CONSTRAINT PK_BotBlocks PRIMARY KEY,
  Form varchar(30) NOT NULL,
  Reason varchar(20) NOT NULL,
  IpAddress varchar(45) NULL,
  CreatedAt datetime2(0) NOT NULL CONSTRAINT DF_BotBlocks_CreatedAt DEFAULT SYSUTCDATETIME()
);

-- Güvenlik bildirimi türü
ALTER TABLE data.Notifications DROP CONSTRAINT CK_Notifications_Kind;
ALTER TABLE data.Notifications ADD CONSTRAINT CK_Notifications_Kind CHECK (Kind IN
  ('campaign', 'slot_opened', 'appointment_new', 'appointment_accepted', 'appointment_rejected',
   'appointment_cancelled', 'appointment_reminder', 'shop_claim', 'order_new', 'order_ready', 'order_cancelled',
   'security'));
