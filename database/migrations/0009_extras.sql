-- =====================================================================
-- Bermatik — Ek özellikler
--   • Personel mola / izin günleri / tatil
--   • Dükkân özel kapalı günleri (bayram, tadilat)
--   • Randevu hatırlatma (1 gün ve 2 saat önce)
--   • Şifremi unuttum, KVKK onayı, hesabımı sil
--   • Favoriler
--   • Çalışma fotoğrafları (galeri)
--   • Şikayet / bildir
-- =====================================================================

-- ---------------------------------------------------------------------
-- Personel molaları (her hafta tekrar eder). Weekday NULL = her gün
-- ---------------------------------------------------------------------
CREATE TABLE data.StaffBreaks (
  Id uniqueidentifier NOT NULL CONSTRAINT PK_StaffBreaks PRIMARY KEY CONSTRAINT DF_StaffBreaks_Id DEFAULT NEWSEQUENTIALID(),
  StaffId uniqueidentifier NOT NULL CONSTRAINT FK_StaffBreaks_Staff REFERENCES data.Staff (Id),
  Weekday tinyint NULL CONSTRAINT CK_StaffBreaks_Weekday CHECK (Weekday BETWEEN 1 AND 7),
  StartTime time(0) NOT NULL,
  EndTime time(0) NOT NULL,
  CONSTRAINT CK_StaffBreaks_Range CHECK (StartTime < EndTime)
);
CREATE INDEX IX_StaffBreaks_Staff ON data.StaffBreaks (StaffId);

-- Personel izinleri: haftalık izin günü (Weekday) VEYA tarih aralığı (tatil, rapor)
CREATE TABLE data.StaffDaysOff (
  Id uniqueidentifier NOT NULL CONSTRAINT PK_StaffDaysOff PRIMARY KEY CONSTRAINT DF_StaffDaysOff_Id DEFAULT NEWSEQUENTIALID(),
  StaffId uniqueidentifier NOT NULL CONSTRAINT FK_StaffDaysOff_Staff REFERENCES data.Staff (Id),
  Weekday tinyint NULL CONSTRAINT CK_StaffDaysOff_Weekday CHECK (Weekday BETWEEN 1 AND 7),
  StartDate date NULL,
  EndDate date NULL,
  Note nvarchar(100) NULL,
  CreatedAt datetime2(0) NOT NULL CONSTRAINT DF_StaffDaysOff_CreatedAt DEFAULT SYSUTCDATETIME(),
  CONSTRAINT CK_StaffDaysOff_Kind CHECK (
    (Weekday IS NOT NULL AND StartDate IS NULL AND EndDate IS NULL)
    OR (Weekday IS NULL AND StartDate IS NOT NULL AND EndDate IS NOT NULL AND StartDate <= EndDate))
);
CREATE INDEX IX_StaffDaysOff_Staff ON data.StaffDaysOff (StaffId);

-- ---------------------------------------------------------------------
-- Dükkân özel kapalı günleri (bayram, tadilat...)
-- ---------------------------------------------------------------------
CREATE TABLE data.ShopClosures (
  Id uniqueidentifier NOT NULL CONSTRAINT PK_ShopClosures PRIMARY KEY CONSTRAINT DF_ShopClosures_Id DEFAULT NEWSEQUENTIALID(),
  ShopId uniqueidentifier NOT NULL CONSTRAINT FK_ShopClosures_Shop REFERENCES data.Shops (Id),
  StartDate date NOT NULL,
  EndDate date NOT NULL,
  Reason nvarchar(100) NULL,
  CreatedAt datetime2(0) NOT NULL CONSTRAINT DF_ShopClosures_CreatedAt DEFAULT SYSUTCDATETIME(),
  CONSTRAINT CK_ShopClosures_Range CHECK (StartDate <= EndDate)
);
CREATE INDEX IX_ShopClosures_Shop ON data.ShopClosures (ShopId, StartDate);

-- ---------------------------------------------------------------------
-- Randevu hatırlatma: gönderildiyse işaretlenir (tekrar gönderilmez)
-- ---------------------------------------------------------------------
ALTER TABLE data.Appointments ADD
  Reminder24hSentAt datetime2(0) NULL,
  Reminder2hSentAt datetime2(0) NULL;

ALTER TABLE data.Notifications DROP CONSTRAINT CK_Notifications_Kind;
ALTER TABLE data.Notifications ADD CONSTRAINT CK_Notifications_Kind CHECK (Kind IN
  ('campaign', 'slot_opened', 'appointment_new', 'appointment_accepted', 'appointment_rejected',
   'appointment_cancelled', 'appointment_reminder'));

-- ---------------------------------------------------------------------
-- Şifremi unuttum: e-postaya giden kodun özeti saklanır (kodun kendisi değil)
-- ---------------------------------------------------------------------
CREATE TABLE data.PasswordResetTokens (
  TokenHash binary(32) NOT NULL CONSTRAINT PK_PasswordResetTokens PRIMARY KEY,
  UserId uniqueidentifier NOT NULL CONSTRAINT FK_PasswordResetTokens_User REFERENCES data.Users (Id) ON DELETE CASCADE,
  ExpiresAt datetime2(0) NOT NULL,
  UsedAt datetime2(0) NULL,
  CreatedAt datetime2(0) NOT NULL CONSTRAINT DF_PasswordResetTokens_CreatedAt DEFAULT SYSUTCDATETIME()
);
CREATE INDEX IX_PasswordResetTokens_User ON data.PasswordResetTokens (UserId, CreatedAt);

-- KVKK aydınlatma metni onayı ve hesap silme
ALTER TABLE data.Users ADD
  KvkkAcceptedAt datetime2(0) NULL,
  KvkkVersion varchar(10) NULL,
  DeletedAt datetime2(0) NULL;

-- ---------------------------------------------------------------------
-- Favori dükkânlar
-- ---------------------------------------------------------------------
CREATE TABLE data.Favorites (
  UserId uniqueidentifier NOT NULL CONSTRAINT FK_Favorites_User REFERENCES data.Users (Id) ON DELETE CASCADE,
  ShopId uniqueidentifier NOT NULL CONSTRAINT FK_Favorites_Shop REFERENCES data.Shops (Id),
  CreatedAt datetime2(0) NOT NULL CONSTRAINT DF_Favorites_CreatedAt DEFAULT SYSUTCDATETIME(),
  CONSTRAINT PK_Favorites PRIMARY KEY (UserId, ShopId)
);

-- ---------------------------------------------------------------------
-- Çalışma fotoğrafları (galeri). StaffId doluysa o personelin çalışması
-- ---------------------------------------------------------------------
CREATE TABLE data.ShopGallery (
  Id uniqueidentifier NOT NULL CONSTRAINT PK_ShopGallery PRIMARY KEY CONSTRAINT DF_ShopGallery_Id DEFAULT NEWSEQUENTIALID(),
  ShopId uniqueidentifier NOT NULL CONSTRAINT FK_ShopGallery_Shop REFERENCES data.Shops (Id),
  StaffId uniqueidentifier NULL CONSTRAINT FK_ShopGallery_Staff REFERENCES data.Staff (Id),
  Path nvarchar(300) NOT NULL,
  Caption nvarchar(150) NULL,
  IsHidden bit NOT NULL CONSTRAINT DF_ShopGallery_IsHidden DEFAULT 0,      -- admin gizleyebilir
  UploadedBy uniqueidentifier NULL CONSTRAINT FK_ShopGallery_User REFERENCES data.Users (Id),
  CreatedAt datetime2(0) NOT NULL CONSTRAINT DF_ShopGallery_CreatedAt DEFAULT SYSUTCDATETIME()
);
CREATE INDEX IX_ShopGallery_Shop ON data.ShopGallery (ShopId, CreatedAt DESC);

-- ---------------------------------------------------------------------
-- Şikayetler: dükkân, yorum, fotoğraf, ürün veya kullanıcı bildirilebilir
-- ---------------------------------------------------------------------
CREATE TABLE data.Reports (
  Id uniqueidentifier NOT NULL CONSTRAINT PK_Reports PRIMARY KEY CONSTRAINT DF_Reports_Id DEFAULT NEWSEQUENTIALID(),
  ReporterId uniqueidentifier NOT NULL CONSTRAINT FK_Reports_Reporter REFERENCES data.Users (Id),
  TargetType varchar(10) NOT NULL CONSTRAINT CK_Reports_TargetType CHECK (TargetType IN ('shop', 'review', 'photo', 'product', 'user')),
  TargetId uniqueidentifier NOT NULL,
  Reason varchar(16) NOT NULL CONSTRAINT CK_Reports_Reason CHECK (Reason IN ('spam', 'uygunsuz', 'sahte', 'dolandiricilik', 'diger')),
  Note nvarchar(500) NULL,
  Status varchar(10) NOT NULL CONSTRAINT DF_Reports_Status DEFAULT 'open'
    CONSTRAINT CK_Reports_Status CHECK (Status IN ('open', 'resolved', 'dismissed')),
  ResolutionNote nvarchar(300) NULL,
  ResolvedBy uniqueidentifier NULL CONSTRAINT FK_Reports_Resolver REFERENCES data.Users (Id),
  ResolvedAt datetime2(0) NULL,
  CreatedAt datetime2(0) NOT NULL CONSTRAINT DF_Reports_CreatedAt DEFAULT SYSUTCDATETIME()
);
CREATE INDEX IX_Reports_Status ON data.Reports (Status, CreatedAt);
-- Aynı kişi aynı şeyi açık şikayet varken tekrar bildiremez
CREATE UNIQUE INDEX UX_Reports_OpenPerTarget ON data.Reports (ReporterId, TargetType, TargetId) WHERE Status = 'open';
