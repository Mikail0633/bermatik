-- =====================================================================
-- 0020: Hazır mesajlarda bölüm (erkek / kadın / ikisi)
-- Dükkân yalnızca kendi bölümünün ve "ikisi" mesajlarını görür.
-- =====================================================================

ALTER TABLE data.MessageTemplates ADD
  Segment varchar(5) NULL CONSTRAINT CK_MessageTemplates_Segment CHECK (Segment IN ('erkek', 'kadin'));   -- NULL = ikisi
GO

UPDATE data.MessageTemplates SET Segment = 'erkek' WHERE Title = N'Damat paketi';

-- Kadın kuaförleri için hazır mesajlar
INSERT INTO data.MessageTemplates (Title, Body, SortOrder, Segment) VALUES
  (N'Gelin başı sezonu', N'Merhaba {ad}, {dukkan}''da gelin başı ve nişan saçı için yerler doluyor. Hemen randevunu al!', 55, 'kadin'),
  (N'Saç boyasında indirim', N'Merhaba {ad}, {dukkan}''da bu hafta saç boyası ve röfle işlemlerinde indirim var!', 56, 'kadin'),
  (N'Fön ve bakım günü', N'Merhaba {ad}, saçların bakım istiyor olabilir. {dukkan}''da fön ve bakım için randevunu al!', 57, 'kadin');
