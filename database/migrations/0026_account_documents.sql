-- =====================================================================
-- İşletme hesabı belgesi: işletme hesabı açılırken (kayıt ekranında) belge istenir.
--   Belge artık dükkâna / sahiplenme talebine bağlı olmadan doğrudan HESABA da eklenebilir
--   (ShopId ve ClaimId ikisi de boş = hesap belgesi).
--   Yeni türler: kimlik (ön yüz), işyeri açma ruhsatı.
-- =====================================================================
ALTER TABLE data.OwnerDocuments DROP CONSTRAINT CK_OwnerDocuments_Target;
ALTER TABLE data.OwnerDocuments ADD CONSTRAINT CK_OwnerDocuments_Target CHECK (ShopId IS NULL OR ClaimId IS NULL);
ALTER TABLE data.OwnerDocuments DROP CONSTRAINT CK_OwnerDocuments_Kind;
ALTER TABLE data.OwnerDocuments ADD CONSTRAINT CK_OwnerDocuments_Kind
  CHECK (Kind IN ('vergi_levhasi', 'esnaf_kaydi', 'kimlik', 'ruhsat', 'diger'));
CREATE INDEX IX_OwnerDocuments_Account ON data.OwnerDocuments (UserId) WHERE ShopId IS NULL AND ClaimId IS NULL;
