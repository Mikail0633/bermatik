-- =====================================================================
-- Bermatik — Bildirimler, kampanyalar ve "saç uzama" zamanlayıcısı
--
-- Kanallar: telefon bildirimi (push, ücretsiz) ve SMS (ücretli; admin açınca).
-- Kampanya SMS'i yalnızca açık onay veren müşteriye gider (6563 sayılı Kanun / İYS).
-- Zamanlayıcı: her hizmetin tekrar süresi (RevisitDays) + müşterinin kendi
-- ziyaret aralığı → "zamanı gelen" müşteriler hesaplanır; yeni traş olana bildirim gitmez.
-- =====================================================================

-- Müşterinin bildirim izinleri (hepsi varsayılan kapalı; müşteri kendisi açar)
ALTER TABLE data.Users ADD
  PushOptIn bit NOT NULL CONSTRAINT DF_Users_PushOptIn DEFAULT 0,             -- telefon bildirimleri
  SmsOptIn bit NOT NULL CONSTRAINT DF_Users_SmsOptIn DEFAULT 0,               -- kampanya SMS'i (ticari ileti onayı)
  SmsOptInAt datetime2(0) NULL,                                               -- onayın verildiği an (İYS kaydı için)
  SlotAlertsOptIn bit NOT NULL CONSTRAINT DF_Users_SlotAlerts DEFAULT 0;      -- "boşalan randevu" haberleri

-- SMS gönderimi: SMS firması seçilene kadar kapalı
ALTER TABLE data.PlatformSettings ADD
  SmsEnabled bit NOT NULL CONSTRAINT DF_PlatformSettings_Sms DEFAULT 0;

-- Hizmetin ortalama tekrar süresi (gün). NULL = zamanlayıcıda kullanılmaz (örn. damat tıraşı)
ALTER TABLE data.ServiceCategories ADD
  RevisitDays smallint NULL CONSTRAINT CK_ServiceCategories_Revisit CHECK (RevisitDays BETWEEN 3 AND 365);
GO

UPDATE data.ServiceCategories SET RevisitDays = CASE Slug
  WHEN 'sac-kesimi' THEN 28        WHEN 'sakal' THEN 10           WHEN 'sac-sakal' THEN 21
  WHEN 'yuz-bakimi-erkek' THEN 30  WHEN 'sac-kesimi-kadin' THEN 42 WHEN 'fon' THEN 7
  WHEN 'sac-boyama' THEN 42        WHEN 'manikur' THEN 14         WHEN 'pedikur' THEN 28
  WHEN 'yuz-bakimi' THEN 30        WHEN 'kas-kirpik' THEN 21      ELSE NULL END;

-- Telefon/tarayıcı bildirim abonelikleri (web push; ileride Android/iOS)
CREATE TABLE data.PushSubscriptions (
  Id uniqueidentifier NOT NULL CONSTRAINT PK_PushSubscriptions PRIMARY KEY CONSTRAINT DF_PushSubscriptions_Id DEFAULT NEWSEQUENTIALID(),
  UserId uniqueidentifier NOT NULL CONSTRAINT FK_PushSubscriptions_User REFERENCES data.Users (Id) ON DELETE CASCADE,
  Platform varchar(10) NOT NULL CONSTRAINT CK_PushSubscriptions_Platform CHECK (Platform IN ('web', 'android', 'ios')),
  Endpoint nvarchar(1000) NOT NULL,
  EndpointHash AS CAST(HASHBYTES('SHA2_256', Endpoint) AS binary(32)) PERSISTED,
  P256dh nvarchar(200) NULL,
  AuthKey nvarchar(100) NULL,
  CreatedAt datetime2(0) NOT NULL CONSTRAINT DF_PushSubscriptions_CreatedAt DEFAULT SYSUTCDATETIME(),
  LastSeenAt datetime2(0) NOT NULL CONSTRAINT DF_PushSubscriptions_LastSeen DEFAULT SYSUTCDATETIME()
);
CREATE UNIQUE INDEX UX_PushSubscriptions_Endpoint ON data.PushSubscriptions (EndpointHash);
CREATE INDEX IX_PushSubscriptions_User ON data.PushSubscriptions (UserId);

-- Hazır kampanya mesajları (admin yazar). {ad} ve {dukkan} otomatik doldurulur.
CREATE TABLE data.MessageTemplates (
  Id int IDENTITY(1, 1) NOT NULL CONSTRAINT PK_MessageTemplates PRIMARY KEY,
  Title nvarchar(80) NOT NULL CONSTRAINT CK_MessageTemplates_Title CHECK (LEN(Title) >= 2),
  Body nvarchar(300) NOT NULL CONSTRAINT CK_MessageTemplates_Body CHECK (LEN(Body) >= 5),
  IsActive bit NOT NULL CONSTRAINT DF_MessageTemplates_IsActive DEFAULT 1,
  SortOrder int NOT NULL CONSTRAINT DF_MessageTemplates_Sort DEFAULT 0,
  CreatedAt datetime2(0) NOT NULL CONSTRAINT DF_MessageTemplates_CreatedAt DEFAULT SYSUTCDATETIME()
);

CREATE TABLE data.Campaigns (
  Id uniqueidentifier NOT NULL CONSTRAINT PK_Campaigns PRIMARY KEY CONSTRAINT DF_Campaigns_Id DEFAULT NEWSEQUENTIALID(),
  ShopId uniqueidentifier NULL CONSTRAINT FK_Campaigns_Shop REFERENCES data.Shops (Id),   -- NULL = Bermatik geneli (admin)
  TemplateId int NULL CONSTRAINT FK_Campaigns_Template REFERENCES data.MessageTemplates (Id),
  Title nvarchar(80) NOT NULL,
  Body nvarchar(300) NOT NULL,
  Channel varchar(4) NOT NULL CONSTRAINT CK_Campaigns_Channel CHECK (Channel IN ('push', 'sms', 'both')),
  OnlyDue bit NOT NULL CONSTRAINT DF_Campaigns_OnlyDue DEFAULT 1,      -- yalnızca zamanı gelenlere
  Segment varchar(5) NULL CONSTRAINT CK_Campaigns_Segment CHECK (Segment IN ('erkek', 'kadin')),
  ProvinceId tinyint NULL CONSTRAINT FK_Campaigns_Province REFERENCES data.Provinces (Id),
  RecipientCount int NOT NULL CONSTRAINT DF_Campaigns_Recipients DEFAULT 0,
  CreatedBy uniqueidentifier NOT NULL CONSTRAINT FK_Campaigns_User REFERENCES data.Users (Id),
  CreatedAt datetime2(0) NOT NULL CONSTRAINT DF_Campaigns_CreatedAt DEFAULT SYSUTCDATETIME()
);
CREATE INDEX IX_Campaigns_Shop ON data.Campaigns (ShopId, CreatedAt DESC);

-- Bildirim kutusu: uygulamadaki zil listesi + gönderim kuyruğu
-- PushStatus / SmsStatus: NULL = o kanaldan gönderilmeyecek
CREATE TABLE data.Notifications (
  Id bigint IDENTITY(1, 1) NOT NULL CONSTRAINT PK_Notifications PRIMARY KEY,
  UserId uniqueidentifier NOT NULL CONSTRAINT FK_Notifications_User REFERENCES data.Users (Id) ON DELETE CASCADE,
  Kind varchar(24) NOT NULL CONSTRAINT CK_Notifications_Kind CHECK (Kind IN
    ('campaign', 'slot_opened', 'appointment_new', 'appointment_accepted', 'appointment_rejected', 'appointment_cancelled')),
  Title nvarchar(80) NOT NULL,
  Body nvarchar(300) NOT NULL,
  Url nvarchar(300) NULL,
  CampaignId uniqueidentifier NULL CONSTRAINT FK_Notifications_Campaign REFERENCES data.Campaigns (Id),
  AppointmentId uniqueidentifier NULL CONSTRAINT FK_Notifications_Appointment REFERENCES data.Appointments (Id),
  PushStatus varchar(8) NULL CONSTRAINT CK_Notifications_Push CHECK (PushStatus IN ('queued', 'sending', 'sent', 'failed')),
  SmsStatus varchar(8) NULL CONSTRAINT CK_Notifications_Sms CHECK (SmsStatus IN ('queued', 'sending', 'sent', 'failed')),
  Attempts tinyint NOT NULL CONSTRAINT DF_Notifications_Attempts DEFAULT 0,
  LastError nvarchar(300) NULL,
  ClaimedAt datetime2(0) NULL,
  CreatedAt datetime2(0) NOT NULL CONSTRAINT DF_Notifications_CreatedAt DEFAULT SYSUTCDATETIME(),
  SentAt datetime2(0) NULL,
  ReadAt datetime2(0) NULL
);
CREATE INDEX IX_Notifications_User ON data.Notifications (UserId, CreatedAt DESC) INCLUDE (ReadAt);
CREATE INDEX IX_Notifications_PushQueue ON data.Notifications (PushStatus, Id) WHERE PushStatus IN ('queued', 'sending');
CREATE INDEX IX_Notifications_SmsQueue ON data.Notifications (SmsStatus, Id) WHERE SmsStatus IN ('queued', 'sending');
CREATE INDEX IX_Notifications_UserKind ON data.Notifications (UserId, Kind, CreatedAt);

-- Hazır kampanya mesajları
INSERT INTO data.MessageTemplates (Title, Body, SortOrder) VALUES
  (N'Şampuanda %50 indirim', N'Merhaba {ad}, {dukkan}''da bu hafta tüm şampuanlarda %50 indirim! Stoklar sınırlı.', 10),
  (N'Saç kesiminde indirim', N'Merhaba {ad}, {dukkan}''da hafta içi saç kesiminde %20 indirim var. Hemen randevu al!', 20),
  (N'Seni özledik', N'Merhaba {ad}, seni bir süredir göremedik. {dukkan} olarak yeni randevunu bekliyoruz.', 30),
  (N'Bayram öncesi', N'Merhaba {ad}, bayram öncesi yoğunluk başlamadan {dukkan}''dan randevunu şimdiden al!', 40),
  (N'Damat paketi', N'Merhaba {ad}, {dukkan}''da damat tıraşı paketinde özel fiyat! Detaylar için tıkla.', 50),
  (N'Yeni ürünler geldi', N'Merhaba {ad}, {dukkan}''a yeni bakım ürünleri geldi. Bir sonraki randevunda incele!', 60);
