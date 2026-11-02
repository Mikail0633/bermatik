-- =====================================================================
-- Bermatik — Değişiklik geçmişi ve hızlı harita araması
--
-- 1) Hızlı harita: dükkân konumu SQL Server'ın harita türünde (geography)
--    tutulur ve özel harita diziniyle aranır; binlerce dükkânda da anında.
-- 2) Değişiklik geçmişi (temporal tables): dükkân bilgileri, hizmet fiyatları
--    ve ürünler her değiştiğinde eski hali otomatik saklanır (2 yıl).
--    "Bu fiyat geçen ay kaçtı, kim değiştirdi?" → api.History_List
--    (Personel tablosu bilinçli olarak dahil değil: kişisel telefon numarası
--    içerdiği için, hesap silinince geçmişte kalmasın — KVKK.)
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Harita
-- ---------------------------------------------------------------------
ALTER TABLE data.Shops ADD
  Location AS geography::Point(CAST(Latitude AS float), CAST(Longitude AS float), 4326) PERSISTED;
GO
CREATE SPATIAL INDEX SX_Shops_Location ON data.Shops (Location) USING GEOGRAPHY_AUTO_GRID;
GO

-- ---------------------------------------------------------------------
-- 2) Değişiklik geçmişi — değişikliği kimin yaptığı da kaydedilir
-- ---------------------------------------------------------------------
ALTER TABLE data.Shops ADD
  UpdatedBy uniqueidentifier NULL,
  ValidFrom datetime2(7) GENERATED ALWAYS AS ROW START HIDDEN NOT NULL
    CONSTRAINT DF_Shops_ValidFrom DEFAULT SYSUTCDATETIME(),
  ValidTo datetime2(7) GENERATED ALWAYS AS ROW END HIDDEN NOT NULL
    CONSTRAINT DF_Shops_ValidTo DEFAULT CONVERT(datetime2(7), '9999-12-31 23:59:59.9999999'),
  PERIOD FOR SYSTEM_TIME (ValidFrom, ValidTo);
GO
ALTER TABLE data.Shops SET (SYSTEM_VERSIONING = ON (HISTORY_TABLE = data.ShopsHistory, HISTORY_RETENTION_PERIOD = 2 YEARS));
GO

ALTER TABLE data.ShopServices ADD
  UpdatedBy uniqueidentifier NULL,
  ValidFrom datetime2(7) GENERATED ALWAYS AS ROW START HIDDEN NOT NULL
    CONSTRAINT DF_ShopServices_ValidFrom DEFAULT SYSUTCDATETIME(),
  ValidTo datetime2(7) GENERATED ALWAYS AS ROW END HIDDEN NOT NULL
    CONSTRAINT DF_ShopServices_ValidTo DEFAULT CONVERT(datetime2(7), '9999-12-31 23:59:59.9999999'),
  PERIOD FOR SYSTEM_TIME (ValidFrom, ValidTo);
GO
ALTER TABLE data.ShopServices SET (SYSTEM_VERSIONING = ON (HISTORY_TABLE = data.ShopServicesHistory, HISTORY_RETENTION_PERIOD = 2 YEARS));
GO

ALTER TABLE data.Products ADD
  UpdatedBy uniqueidentifier NULL,
  ValidFrom datetime2(7) GENERATED ALWAYS AS ROW START HIDDEN NOT NULL
    CONSTRAINT DF_Products_ValidFrom DEFAULT SYSUTCDATETIME(),
  ValidTo datetime2(7) GENERATED ALWAYS AS ROW END HIDDEN NOT NULL
    CONSTRAINT DF_Products_ValidTo DEFAULT CONVERT(datetime2(7), '9999-12-31 23:59:59.9999999'),
  PERIOD FOR SYSTEM_TIME (ValidFrom, ValidTo);
GO
ALTER TABLE data.Products SET (SYSTEM_VERSIONING = ON (HISTORY_TABLE = data.ProductsHistory, HISTORY_RETENTION_PERIOD = 2 YEARS));
GO
