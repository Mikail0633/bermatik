-- =====================================================================
-- İşletme hesabı doğrulaması (site sahibinin kararı, 2026-11-11):
--   * Her işletme hesabı (sahip ve personel) belge onayı olmadan panele giremez.
--   * Belge numarası istenir (T.C. kimlik no, vergi no, ruhsat no, esnaf sicil no).
--     Numara AÇIK saklanmaz: gizli anahtarlı özeti (NumberHash) + maskeli hali (NumberMasked) tutulur.
--   * Aynı belge numarası ya da aynı dosya iki ayrı hesapta kullanılamaz.
--   * Kimlik: T.C. no + ad + soyad + doğum yılı Nüfus (NVİ) servisine sorulur.
--     'dogru' → panel hemen açılır; 'yanlis' → belge kabul edilmez; 'hata' (servis cevap vermedi) → admin onayı beklenir.
--   * Diğer belgeler: admin "Uygun" deyince panel açılır. Admin "Uygun değil" derse onay geri alınır.
-- =====================================================================
ALTER TABLE data.Users ADD BusinessVerifiedAt datetime2(0) NULL;
GO
-- Bu özellikten önce açılmış işletme hesapları ve adminler doğrulanmış sayılır
UPDATE data.Users SET BusinessVerifiedAt = SYSUTCDATETIME() WHERE Role IN ('shop_owner', 'staff', 'admin');
GO

ALTER TABLE data.OwnerDocuments ADD
  NumberHash binary(32) NULL,
  NumberMasked nvarchar(40) NULL,
  FileHash binary(32) NULL,
  NviResult varchar(6) NULL CONSTRAINT CK_OwnerDocuments_Nvi CHECK (NviResult IN ('dogru', 'yanlis', 'hata'));
GO
-- Hesap belgelerinde aynı numara / aynı dosya ikinci kez (reddedilmemişse) kullanılamaz
CREATE UNIQUE INDEX UX_OwnerDocuments_AccountNumber ON data.OwnerDocuments (Kind, NumberHash)
  WHERE ShopId IS NULL AND ClaimId IS NULL AND NumberHash IS NOT NULL AND Status <> 'rejected';
CREATE UNIQUE INDEX UX_OwnerDocuments_AccountFile ON data.OwnerDocuments (FileHash)
  WHERE ShopId IS NULL AND ClaimId IS NULL AND FileHash IS NOT NULL AND Status <> 'rejected';
CREATE INDEX IX_OwnerDocuments_NumberHash ON data.OwnerDocuments (NumberHash) WHERE NumberHash IS NOT NULL;
CREATE INDEX IX_OwnerDocuments_FileHash ON data.OwnerDocuments (FileHash) WHERE FileHash IS NOT NULL;

ALTER TABLE data.Notifications DROP CONSTRAINT CK_Notifications_Kind;
ALTER TABLE data.Notifications ADD CONSTRAINT CK_Notifications_Kind CHECK (Kind IN
  ('campaign', 'slot_opened', 'appointment_new', 'appointment_accepted', 'appointment_rejected',
   'appointment_cancelled', 'appointment_reminder', 'shop_claim', 'order_new', 'order_ready', 'order_cancelled',
   'security', 'account_verify'));
