-- =====================================================================
-- Bermatik — Başlangıç verisi: platform ayarları ve hizmet kategorileri
-- (Kategoriler ve açıklamaları admin panelinden değiştirilebilir)
-- =====================================================================

INSERT INTO data.PlatformSettings (Id) VALUES (1);

INSERT INTO data.ServiceCategories (Segment, Slug, Name, Description, SortOrder) VALUES
  ('erkek', 'sac-kesimi', N'Saç Kesimi',
   N'Yıkama ve şekillendirme dahil makas veya makine ile saç kesimi.', 10),
  ('erkek', 'sakal', N'Sakal Tıraşı / Düzeltme',
   N'Sakalın ustura veya makine ile tıraşı ya da şekillendirilmesi.', 20),
  ('erkek', 'sac-sakal', N'Saç + Sakal',
   N'Saç kesimi ve sakal tıraşı/düzeltme birlikte.', 30),
  ('erkek', 'damat-trasi', N'Damat Tıraşı',
   N'Düğün öncesi özel bakım: saç, sakal, yüz bakımı ve fön. İçeriği dükkâna göre değişebilir.', 40),
  ('erkek', 'yuz-bakimi-erkek', N'Yüz Bakımı',
   N'Cilt temizliği, buhar, maske ve siyah nokta temizliği.', 50),
  ('kadin', 'sac-kesimi-kadin', N'Saç Kesimi',
   N'Yıkama ve fön dahil saç kesimi.', 10),
  ('kadin', 'fon', N'Fön',
   N'Saçın fön makinesi ile kurutulup şekillendirilmesi.', 20),
  ('kadin', 'sac-boyama', N'Saç Boyama',
   N'Dip boya, tüm boya, röfle veya balyaj. Fiyat saç uzunluğuna göre değişebilir.', 30),
  ('kadin', 'manikur', N'Manikür',
   N'El ve tırnak bakımı: tırnak kesimi, şekillendirme, kütikül bakımı ve isteğe bağlı oje.', 40),
  ('kadin', 'pedikur', N'Pedikür',
   N'Ayak ve tırnak bakımı: ayak banyosu, nasır/topuk bakımı, tırnak şekillendirme ve isteğe bağlı oje.', 50),
  ('kadin', 'yuz-bakimi', N'Yüz Bakımı',
   N'Cilt temizliği, peeling, maske ve nemlendirme.', 60),
  ('kadin', 'kas-kirpik', N'Kaş - Kirpik',
   N'Kaş alımı ve şekillendirme, kirpik lifting, kaş/kirpik boyama.', 70);
