-- =====================================================================
-- Bermatik — İlçe ve mahalle merkez konumları
--   "Mahalleye en yakın berberler" ve "yakın çevredeki berberler" için.
--   Site, bir bölge ilk kez arandığında konumu OpenStreetMap Nominatim'den
--   bulup buraya yazar; sonraki aramalar buradan okur.
-- =====================================================================
ALTER TABLE data.Districts ADD Latitude decimal(9, 6) NULL, Longitude decimal(9, 6) NULL;
ALTER TABLE data.Neighborhoods ADD Latitude decimal(9, 6) NULL, Longitude decimal(9, 6) NULL;
