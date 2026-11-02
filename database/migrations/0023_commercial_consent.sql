-- Ticari elektronik ileti onayları (İYS'ye hazırlık)
-- Her onay / ret ayrı satır olarak saklanır (kanıt + İYS'ye aktarım için): kanal, durum, alıcı, tarih, kaynak.
-- Kayıt ve Hesabım'daki onay kutusu, Bermatik İYS'ye kaydolana kadar kapalı (CommercialConsentEnabled = 0).

ALTER TABLE data.PlatformSettings ADD
  CommercialConsentEnabled bit NOT NULL CONSTRAINT DF_PlatformSettings_Consent DEFAULT 0;
GO

CREATE TABLE data.CommercialConsents (
  Id bigint IDENTITY(1, 1) NOT NULL CONSTRAINT PK_CommercialConsents PRIMARY KEY,
  UserId uniqueidentifier NOT NULL CONSTRAINT FK_CommercialConsents_User REFERENCES data.Users (Id),
  Channel varchar(6) NOT NULL CONSTRAINT CK_CommercialConsents_Channel CHECK (Channel IN ('EPOSTA', 'MESAJ')),  -- İYS adlarıyla
  Status varchar(4) NOT NULL CONSTRAINT CK_CommercialConsents_Status CHECK (Status IN ('ONAY', 'RET')),
  Recipient nvarchar(254) NOT NULL,                       -- o anki e-posta adresi / telefon
  Source varchar(20) NOT NULL CONSTRAINT CK_CommercialConsents_Source CHECK (Source IN ('HS_WEB', 'HS_ILETI_RET', 'HS_HESAP_SIL')),
  ConsentDate datetime2(0) NOT NULL CONSTRAINT DF_CommercialConsents_Date DEFAULT SYSUTCDATETIME(),  -- UTC
  IysSentAt datetime2(0) NULL                             -- İYS'ye aktarıldığı an (entegrasyon kurulunca)
);
CREATE INDEX IX_CommercialConsents_User ON data.CommercialConsents (UserId, Channel, Id DESC);
GO
