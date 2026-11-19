-- =====================================================================
-- "Bermatik ile eklendi" işareti (site sahibinin kararı, 2026-11-19)
--   1 = dükkân Bermatik içinden eklendi ya da Bermatik'e katıldı:
--       * dükkân sahibi kendisi açtı (Source = 'owner')
--       * admin / Bermatik ekibi ekledi, "Sahada ekle" dahil (Source = 'admin')
--       * internetten toplanan bir dükkânı sahibi sahiplendi, ya da admin bir sahibe atadı
--   0 = yalnızca internetten toplandı (OpenStreetMap / Overture), sahibi henüz katılmadı
--   Ana sayfadaki "Bermatik ile eklenenler" bölümü ve dükkân kartlarındaki rozet bu sütundan okunur.
--   Varsayılan 1: yeni dükkân ekleyen her yol Bermatik içidir; yalnızca içe aktarma açıkça 0 yazar.
-- =====================================================================
ALTER TABLE data.Shops ADD AddedViaBermatik bit NOT NULL CONSTRAINT DF_Shops_AddedViaBermatik DEFAULT 1;
GO

UPDATE s SET AddedViaBermatik = 0
FROM data.Shops s
WHERE s.Source IN ('osm', 'overture')
  AND NOT (s.IsClaimed = 1 AND EXISTS (SELECT 1 FROM data.Users u WHERE u.Id = s.OwnerId AND u.Role <> 'admin'
                                         AND u.Email <> 'sistem@bermatik.local'));
GO

CREATE INDEX IX_Shops_AddedViaBermatik ON data.Shops (Segment, Status) WHERE AddedViaBermatik = 1;
