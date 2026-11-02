-- =====================================================================
-- Bermatik — Veritabanı yetkileri
-- Site, bermatik_app rolüyle bağlanır ve YALNIZCA api şemasındaki
-- işlemleri çalıştırabilir. Tablolara (data şeması) doğrudan okuma/yazma
-- yasaktır; tüm kurallar ve yetki kontrolleri api işlemlerinin içindedir.
-- (Her çalıştırmada yeniden uygulanır.)
-- =====================================================================

IF DATABASE_PRINCIPAL_ID('bermatik_app') IS NULL
  CREATE ROLE bermatik_app;
GO

GRANT EXECUTE ON SCHEMA::api TO bermatik_app;
DENY SELECT, INSERT, UPDATE, DELETE, EXECUTE, ALTER, REFERENCES ON SCHEMA::data TO bermatik_app;
DENY SELECT, INSERT, UPDATE, DELETE, ALTER ON SCHEMA::dbo TO bermatik_app;
GO
