-- =====================================================================
-- Bermatik — Dükkân sahibi doğrulaması
--   1) E-posta kodu: işletme hesabı e-postasına gelen 6 haneli kodu girer
--   2) Belge: vergi levhası / esnaf odası kaydı fotoğrafı; admin bakıp onaylar
-- Bu özellikten önce açılmış hesaplar doğrulanmış sayılır.
-- =====================================================================
ALTER TABLE data.Users ADD EmailVerifiedAt datetime2(0) NULL;
GO
UPDATE data.Users SET EmailVerifiedAt = CreatedAt WHERE EmailVerifiedAt IS NULL;
GO

-- Kodun kendisi değil özeti (SHA-256) saklanır; 15 dakika geçerli, en fazla 5 deneme
CREATE TABLE data.EmailCodes (
  Id bigint IDENTITY(1, 1) NOT NULL CONSTRAINT PK_EmailCodes PRIMARY KEY,
  UserId uniqueidentifier NOT NULL CONSTRAINT FK_EmailCodes_User REFERENCES data.Users (Id) ON DELETE CASCADE,
  CodeHash binary(32) NOT NULL,
  Attempts tinyint NOT NULL CONSTRAINT DF_EmailCodes_Attempts DEFAULT 0,
  ExpiresAt datetime2(0) NOT NULL,
  UsedAt datetime2(0) NULL,
  CreatedAt datetime2(0) NOT NULL CONSTRAINT DF_EmailCodes_CreatedAt DEFAULT SYSUTCDATETIME()
);
CREATE INDEX IX_EmailCodes_User ON data.EmailCodes (UserId, CreatedAt);

-- Dükkân sahipliği belgeleri: yeni dükkân başvurusuna (ShopId) ya da sahiplenme talebine (ClaimId) eklenir
CREATE TABLE data.OwnerDocuments (
  Id uniqueidentifier NOT NULL CONSTRAINT PK_OwnerDocuments PRIMARY KEY CONSTRAINT DF_OwnerDocuments_Id DEFAULT NEWSEQUENTIALID(),
  UserId uniqueidentifier NOT NULL CONSTRAINT FK_OwnerDocuments_User REFERENCES data.Users (Id),
  ShopId uniqueidentifier NULL CONSTRAINT FK_OwnerDocuments_Shop REFERENCES data.Shops (Id) ON DELETE CASCADE,
  ClaimId uniqueidentifier NULL CONSTRAINT FK_OwnerDocuments_Claim REFERENCES data.ShopClaims (Id),
  Kind varchar(16) NOT NULL CONSTRAINT CK_OwnerDocuments_Kind CHECK (Kind IN ('vergi_levhasi', 'esnaf_kaydi', 'diger')),
  FilePath nvarchar(300) NOT NULL,
  Status varchar(10) NOT NULL CONSTRAINT DF_OwnerDocuments_Status DEFAULT 'pending'
    CONSTRAINT CK_OwnerDocuments_Status CHECK (Status IN ('pending', 'approved', 'rejected')),
  ReviewNote nvarchar(300) NULL,
  ReviewedBy uniqueidentifier NULL CONSTRAINT FK_OwnerDocuments_Reviewer REFERENCES data.Users (Id),
  ReviewedAt datetime2(0) NULL,
  CreatedAt datetime2(0) NOT NULL CONSTRAINT DF_OwnerDocuments_CreatedAt DEFAULT SYSUTCDATETIME(),
  CONSTRAINT CK_OwnerDocuments_Target CHECK ((ShopId IS NULL AND ClaimId IS NOT NULL) OR (ShopId IS NOT NULL AND ClaimId IS NULL))
);
CREATE INDEX IX_OwnerDocuments_Shop ON data.OwnerDocuments (ShopId) WHERE ShopId IS NOT NULL;
CREATE INDEX IX_OwnerDocuments_Claim ON data.OwnerDocuments (ClaimId) WHERE ClaimId IS NOT NULL;
