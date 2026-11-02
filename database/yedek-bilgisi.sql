-- =====================================================================
-- Bermatik — Yedek bilgisi (F5 ile çalıştırın; hiçbir şeyi değiştirmez)
-- =====================================================================

-- 1) Bugüne kadar alınan yedekler (en yenisi üstte)
SELECT TOP (30)
       bs.backup_finish_date              AS YedekZamani,
       CAST(bs.compressed_backup_size / 1048576.0 AS decimal(10, 1)) AS BoyutMB,
       bmf.physical_device_name           AS Dosya,
       CASE bs.type WHEN 'D' THEN N'Tam yedek' WHEN 'L' THEN N'Günlük' ELSE bs.type END AS Tur
FROM msdb.dbo.backupset bs
JOIN msdb.dbo.backupmediafamily bmf ON bmf.media_set_id = bs.media_set_id
WHERE bs.database_name = N'Bermatik'
ORDER BY bs.backup_finish_date DESC;

-- 2) En son yedeğin içindeki dosyalar ve boyutları
DECLARE @son nvarchar(400) = (SELECT TOP (1) bmf.physical_device_name
                              FROM msdb.dbo.backupset bs
                              JOIN msdb.dbo.backupmediafamily bmf ON bmf.media_set_id = bs.media_set_id
                              WHERE bs.database_name = N'Bermatik' ORDER BY bs.backup_finish_date DESC);
RESTORE FILELISTONLY FROM DISK = @son;

-- 3) En son yedek sağlam mı? ("The backup set on file 1 is valid" yazmalı → alttaki Mesajlar sekmesi)
RESTORE VERIFYONLY FROM DISK = @son WITH CHECKSUM;
