-- =====================================================================
-- Bermatik — Örnek sorgular
-- Bir sorguyu çalıştırmak için: satırları fareyle seçin, F5'e basın.
-- (Hiçbir şey seçmeden F5'e basarsanız hepsi çalışır; bu dosya veriyi değiştirmez.)
-- =====================================================================
USE Bermatik;

-- 1) Tüm tablolar ve kaç satır olduğu
SELECT t.name AS Tablo, SUM(p.rows) AS SatirSayisi
FROM sys.tables t JOIN sys.partitions p ON p.object_id = t.object_id AND p.index_id IN (0, 1)
WHERE SCHEMA_NAME(t.schema_id) = 'data'
GROUP BY t.name ORDER BY t.name;

-- 2) İller
SELECT Id AS Plaka, Name AS Il, Slug AS SayfaAdresi FROM data.Provinces ORDER BY Id;

-- 3) Bir ilin ilçeleri (34 = İstanbul; başka plaka yazabilirsiniz)
SELECT Name AS Ilce, Slug AS SayfaAdresi FROM data.Districts WHERE ProvinceId = 34 ORDER BY Name;

-- 4) Kadıköy'ün mahalleleri
SELECT n.Name AS Mahalle
FROM data.Neighborhoods n JOIN data.Districts d ON d.Id = n.DistrictId
WHERE d.ProvinceId = 34 AND d.Name = N'Kadıköy' ORDER BY n.Name;

-- 5) Hizmetler ve açıklamaları (erkek / kadın)
SELECT Segment AS Bolum, Name AS Hizmet, Description AS Aciklama FROM data.ServiceCategories ORDER BY Segment, SortOrder;

-- 6) Platform ayarları (yorumlar / ürün satışı / hizmet açıklamaları açık mı?)
SELECT ReviewsEnabled AS YorumlarAcik, StoreEnabled AS UrunSatisiAcik, ServiceDescriptionsEnabled AS AciklamalarAcik
FROM data.PlatformSettings;

-- 7) Kullanıcılar ve dükkânlar (site açılınca dolacak)
SELECT Email, FirstName AS Ad, LastName AS Soyad, Role AS Rol, CreatedAt AS KayitTarihi FROM data.Users ORDER BY CreatedAt DESC;
SELECT Code AS Kod, Name AS Dukkan, Status AS Durum, Phone AS Telefon FROM data.Shops ORDER BY CreatedAt DESC;
