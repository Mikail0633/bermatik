-- =====================================================================
-- 0022: İkinci açık veri kaynağı — Overture Maps (CDLA-Permissive-2.0)
--   Source = 'overture', ExternalRef = 'ovt:<Overture kimliği>'
-- Shops değişiklik geçmişi tutar (ShopsHistory); sütun değişiklikleri SQL Server
-- tarafından geçmiş tablosuna da otomatik uygulanır.
-- =====================================================================

ALTER TABLE data.Shops DROP CONSTRAINT CK_Shops_Source;
ALTER TABLE data.Shops DROP CONSTRAINT DF_Shops_Source;
ALTER TABLE data.Shops ALTER COLUMN Source varchar(8) NOT NULL;
ALTER TABLE data.Shops ADD CONSTRAINT DF_Shops_Source DEFAULT 'owner' FOR Source;
ALTER TABLE data.Shops ADD CONSTRAINT CK_Shops_Source CHECK (Source IN ('owner', 'admin', 'osm', 'overture'));

DROP INDEX UX_Shops_ExternalRef ON data.Shops;
ALTER TABLE data.Shops ALTER COLUMN ExternalRef varchar(60) NULL;
CREATE UNIQUE INDEX UX_Shops_ExternalRef ON data.Shops (ExternalRef) WHERE ExternalRef IS NOT NULL;
