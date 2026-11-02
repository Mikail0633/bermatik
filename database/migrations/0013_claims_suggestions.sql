-- =====================================================================
-- Bermatik — Dükkân sahiplenme talepleri ve "eksik dükkân" bildirimleri
--   ShopClaims:      "Bu dükkân sizin mi?" → berber talep eder, admin onaylar → dükkân onun olur
--   ShopSuggestions: müşteri listede olmayan bir dükkânı bildirir → admin ekler
-- =====================================================================

CREATE TABLE data.ShopClaims (
  Id uniqueidentifier NOT NULL CONSTRAINT PK_ShopClaims PRIMARY KEY CONSTRAINT DF_ShopClaims_Id DEFAULT NEWSEQUENTIALID(),
  ShopId uniqueidentifier NOT NULL CONSTRAINT FK_ShopClaims_Shop REFERENCES data.Shops (Id) ON DELETE CASCADE,
  UserId uniqueidentifier NOT NULL CONSTRAINT FK_ShopClaims_User REFERENCES data.Users (Id),
  Phone varchar(16) NOT NULL,
  Note nvarchar(500) NULL,
  Status varchar(10) NOT NULL CONSTRAINT DF_ShopClaims_Status DEFAULT 'open'
    CONSTRAINT CK_ShopClaims_Status CHECK (Status IN ('open', 'approved', 'rejected')),
  ReviewNote nvarchar(300) NULL,
  ReviewedBy uniqueidentifier NULL CONSTRAINT FK_ShopClaims_Reviewer REFERENCES data.Users (Id),
  ReviewedAt datetime2(0) NULL,
  CreatedAt datetime2(0) NOT NULL CONSTRAINT DF_ShopClaims_CreatedAt DEFAULT SYSUTCDATETIME()
);
CREATE INDEX IX_ShopClaims_Status ON data.ShopClaims (Status, CreatedAt);
CREATE UNIQUE INDEX UX_ShopClaims_OpenPerUser ON data.ShopClaims (ShopId, UserId) WHERE Status = 'open';

CREATE TABLE data.ShopSuggestions (
  Id uniqueidentifier NOT NULL CONSTRAINT PK_ShopSuggestions PRIMARY KEY CONSTRAINT DF_ShopSuggestions_Id DEFAULT NEWSEQUENTIALID(),
  ReporterId uniqueidentifier NOT NULL CONSTRAINT FK_ShopSuggestions_User REFERENCES data.Users (Id),
  Segment varchar(5) NOT NULL CONSTRAINT CK_ShopSuggestions_Segment CHECK (Segment IN ('erkek', 'kadin')),
  Name nvarchar(100) NOT NULL CONSTRAINT CK_ShopSuggestions_Name CHECK (LEN(Name) >= 2),
  Phone varchar(16) NULL,
  Latitude decimal(9, 6) NOT NULL CONSTRAINT CK_ShopSuggestions_Lat CHECK (Latitude BETWEEN 35.5 AND 42.5),
  Longitude decimal(9, 6) NOT NULL CONSTRAINT CK_ShopSuggestions_Lng CHECK (Longitude BETWEEN 25.5 AND 45.0),
  Note nvarchar(500) NULL,
  Status varchar(10) NOT NULL CONSTRAINT DF_ShopSuggestions_Status DEFAULT 'open'
    CONSTRAINT CK_ShopSuggestions_Status CHECK (Status IN ('open', 'added', 'dismissed')),
  CreatedShopId uniqueidentifier NULL CONSTRAINT FK_ShopSuggestions_Shop REFERENCES data.Shops (Id),
  ReviewedBy uniqueidentifier NULL CONSTRAINT FK_ShopSuggestions_Reviewer REFERENCES data.Users (Id),
  ReviewedAt datetime2(0) NULL,
  CreatedAt datetime2(0) NOT NULL CONSTRAINT DF_ShopSuggestions_CreatedAt DEFAULT SYSUTCDATETIME()
);
CREATE INDEX IX_ShopSuggestions_Status ON data.ShopSuggestions (Status, CreatedAt);
GO

-- Yeni bildirim türü: dükkân sahiplenme onaylandı
ALTER TABLE data.Notifications DROP CONSTRAINT CK_Notifications_Kind;
ALTER TABLE data.Notifications ADD CONSTRAINT CK_Notifications_Kind CHECK (Kind IN
  ('campaign', 'slot_opened', 'appointment_new', 'appointment_accepted', 'appointment_rejected',
   'appointment_cancelled', 'appointment_reminder', 'shop_claim'));
