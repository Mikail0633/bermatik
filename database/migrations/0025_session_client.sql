-- Oturumun açıldığı yer: 'web' (site) veya 'mobile' (telefon uygulaması).
-- Kural (site sahibinin kararı): bir hesap aynı anda 1 sitede + 1 telefonda açık olabilir;
-- yeni giriş yalnızca AYNI türdeki eski oturumu kapatır.
ALTER TABLE data.Sessions ADD Client varchar(8) NOT NULL
  CONSTRAINT DF_Sessions_Client DEFAULT 'web'
  CONSTRAINT CK_Sessions_Client CHECK (Client IN ('web', 'mobile'));
GO
