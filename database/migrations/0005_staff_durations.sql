-- =====================================================================
-- Bermatik — Personele göre süreler
--   StaffServiceDurations: personelin bir hizmet için kendi süresi
--     (yoksa dükkânın hizmet süresi kullanılır)
--   Staff.QueueAvgMinutes: canlı sırada bu personelin müşteri başına
--     ortalama süresi (yoksa dükkân ortalaması kullanılır)
-- =====================================================================

CREATE TABLE data.StaffServiceDurations (
  StaffId uniqueidentifier NOT NULL CONSTRAINT FK_StaffServiceDurations_Staff REFERENCES data.Staff (Id),
  ShopServiceId uniqueidentifier NOT NULL CONSTRAINT FK_StaffServiceDurations_Service REFERENCES data.ShopServices (Id),
  DurationMinutes smallint NOT NULL CONSTRAINT CK_StaffServiceDurations_Minutes CHECK (DurationMinutes BETWEEN 5 AND 600),
  UpdatedAt datetime2(0) NOT NULL CONSTRAINT DF_StaffServiceDurations_UpdatedAt DEFAULT SYSUTCDATETIME(),
  CONSTRAINT PK_StaffServiceDurations PRIMARY KEY (StaffId, ShopServiceId)
);

ALTER TABLE data.Staff ADD
  QueueAvgMinutes smallint NULL CONSTRAINT CK_Staff_QueueAvg CHECK (QueueAvgMinutes BETWEEN 5 AND 180);
