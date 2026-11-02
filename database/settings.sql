-- =====================================================================
-- Bermatik — Veritabanı ayarları (her kurulumda yeniden uygulanır)
--   • Basit kurtarma modu: günlük (log) dosyası şişmez; koruma gecelik yedekle
--   • RCSI: okuyanlar yazanları beklemez, liste/harita takılmaz
--   • Query Store açık: yavaş sorgular SSMS'te izlenebilir
-- =====================================================================
DECLARE @db sysname = DB_NAME(), @sql nvarchar(max);

IF (SELECT recovery_model_desc FROM sys.databases WHERE name = @db) <> 'SIMPLE'
BEGIN
  SET @sql = N'ALTER DATABASE ' + QUOTENAME(@db) + N' SET RECOVERY SIMPLE;';
  EXEC (@sql);
END

IF (SELECT is_read_committed_snapshot_on FROM sys.databases WHERE name = @db) = 0
BEGIN
  SET @sql = N'ALTER DATABASE ' + QUOTENAME(@db) + N' SET READ_COMMITTED_SNAPSHOT ON WITH ROLLBACK IMMEDIATE;';
  EXEC (@sql);
END

IF (SELECT is_auto_shrink_on FROM sys.databases WHERE name = @db) = 1
BEGIN
  SET @sql = N'ALTER DATABASE ' + QUOTENAME(@db) + N' SET AUTO_SHRINK OFF;';
  EXEC (@sql);
END

IF (SELECT is_query_store_on FROM sys.databases WHERE name = @db) = 0
BEGIN
  SET @sql = N'ALTER DATABASE ' + QUOTENAME(@db) + N' SET QUERY_STORE = ON;';
  EXEC (@sql);
END
GO
