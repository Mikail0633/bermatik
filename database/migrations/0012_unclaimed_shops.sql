-- =====================================================================
-- Bermatik — "Henüz katılmadı" dükkânlar (OpenStreetMap'ten veya admin'in eklediği)
--   Source:      owner (berber başvurdu) | admin (admin ekledi) | osm (OpenStreetMap)
--   ExternalRef: OpenStreetMap kaydı (örn. osm:node/123456) — tekrar yüklemede eşleştirmek için
--   IsClaimed:   0 = dükkân sahibi henüz katılmadı (randevu/sıra yok, yalnızca bilgi + ara)
--   NeedsReview: 1 = admin'in kontrol etmesi gereken bilgi var (mahalle/bölüm tahmini)
-- Katılmamış dükkânların sahibi "Bermatik Sistem" hesabıdır (giriş yapamaz).
-- =====================================================================

ALTER TABLE data.Shops ADD
  Source varchar(6) NOT NULL CONSTRAINT DF_Shops_Source DEFAULT 'owner'
    CONSTRAINT CK_Shops_Source CHECK (Source IN ('owner', 'admin', 'osm')),
  ExternalRef varchar(40) NULL,
  IsClaimed bit NOT NULL CONSTRAINT DF_Shops_IsClaimed DEFAULT 1,
  NeedsReview bit NOT NULL CONSTRAINT DF_Shops_NeedsReview DEFAULT 0;
GO
CREATE UNIQUE INDEX UX_Shops_ExternalRef ON data.Shops (ExternalRef) WHERE ExternalRef IS NOT NULL;

-- Telefonu bilinmeyen (katılmamış) dükkânlar olabilir
ALTER TABLE data.Shops DROP CONSTRAINT CK_Shops_Phone;
ALTER TABLE data.Shops ALTER COLUMN Phone varchar(16) NULL;
ALTER TABLE data.Shops ADD CONSTRAINT CK_Shops_Phone
  CHECK (Phone IS NULL OR (Phone NOT LIKE '%[^0-9+]%' AND LEN(Phone) BETWEEN 10 AND 16));
GO

-- Katılmamış dükkânların sahibi (giriş yapamaz: şifre yok, pasif)
IF NOT EXISTS (SELECT 1 FROM data.Users WHERE Email = 'sistem@bermatik.local')
  INSERT INTO data.Users (Email, PasswordHash, FirstName, LastName, Role, IsActive, KvkkAcceptedAt, KvkkVersion)
  VALUES ('sistem@bermatik.local', N'!', N'Bermatik', N'Sistem', 'customer', 0, SYSUTCDATETIME(), 'sistem');
