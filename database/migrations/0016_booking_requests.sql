-- =====================================================================
-- Bermatik — Katılmamış dükkânlar için randevu / sıra TALEBİ
--   Müşteri hizmet, gün ve saat seçip talep bırakır; Bermatik ekibi (admin)
--   dükkânı arayıp ayarlar ve onaylar / reddeder. Müşteriye bildirim gider.
-- =====================================================================
CREATE TABLE data.BookingRequests (
  Id uniqueidentifier NOT NULL CONSTRAINT PK_BookingRequests PRIMARY KEY CONSTRAINT DF_BookingRequests_Id DEFAULT NEWSEQUENTIALID(),
  ShopId uniqueidentifier NOT NULL CONSTRAINT FK_BookingRequests_Shop REFERENCES data.Shops (Id) ON DELETE CASCADE,
  CustomerId uniqueidentifier NOT NULL CONSTRAINT FK_BookingRequests_Customer REFERENCES data.Users (Id),
  Kind varchar(8) NOT NULL CONSTRAINT CK_BookingRequests_Kind CHECK (Kind IN ('randevu', 'sira')),
  CategoryId int NULL CONSTRAINT FK_BookingRequests_Category REFERENCES data.ServiceCategories (Id),
  PreferredAtLocal datetime2(0) NOT NULL,               -- müşterinin istediği gün ve saat (İstanbul saati)
  Note nvarchar(300) NULL,
  Status varchar(10) NOT NULL CONSTRAINT DF_BookingRequests_Status DEFAULT 'open'
    CONSTRAINT CK_BookingRequests_Status CHECK (Status IN ('open', 'confirmed', 'rejected', 'cancelled')),
  ConfirmedAtLocal datetime2(0) NULL,                   -- dükkânla ayarlanan kesin saat
  AdminNote nvarchar(300) NULL,                         -- müşteriye gösterilir
  ResolvedBy uniqueidentifier NULL CONSTRAINT FK_BookingRequests_Resolver REFERENCES data.Users (Id),
  ResolvedAt datetime2(0) NULL,
  CreatedAt datetime2(0) NOT NULL CONSTRAINT DF_BookingRequests_CreatedAt DEFAULT SYSUTCDATETIME()
);
CREATE INDEX IX_BookingRequests_Status ON data.BookingRequests (Status, CreatedAt);
CREATE INDEX IX_BookingRequests_Customer ON data.BookingRequests (CustomerId, CreatedAt);
