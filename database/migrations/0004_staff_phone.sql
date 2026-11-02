-- =====================================================================
-- Bermatik — Personel telefon numarası
-- Numarayı personel veya dükkân sahibi girer. ShowPhone = 1 ise müşteriler
-- de görür (personel kartında "Ara" butonu); 0 ise yalnızca dükkân içi ve admin.
-- =====================================================================

ALTER TABLE data.Staff ADD
  Phone varchar(16) NULL CONSTRAINT CK_Staff_Phone CHECK (Phone NOT LIKE '%[^0-9+]%' AND LEN(Phone) BETWEEN 10 AND 16),
  ShowPhone bit NOT NULL CONSTRAINT DF_Staff_ShowPhone DEFAULT 0;
