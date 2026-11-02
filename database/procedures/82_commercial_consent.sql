-- ---------------------------------------------------------------------
-- Ticari elektronik ileti onayları (İYS'ye hazırlık)
-- Onay (ONAY) yalnızca özellik açıkken verilebilir; ret (RET) her zaman verilebilir.
-- Durum değişmiyorsa yeni satır yazılmaz.
-- ---------------------------------------------------------------------

-- Bir kullanıcının kanal başına son durumu
CREATE OR ALTER FUNCTION data.tvf_ConsentState(@UserId uniqueidentifier)
RETURNS TABLE AS RETURN
  SELECT c.Channel, c.Status, c.ConsentDate
  FROM data.CommercialConsents c
  WHERE c.UserId = @UserId
    AND c.Id = (SELECT MAX(x.Id) FROM data.CommercialConsents x WHERE x.UserId = @UserId AND x.Channel = c.Channel);
GO

CREATE OR ALTER PROCEDURE data.usp_SetConsent
  @UserId uniqueidentifier, @Channel varchar(6), @Approve bit, @Source varchar(20)
AS
BEGIN
  SET NOCOUNT ON;
  IF @Channel NOT IN ('EPOSTA', 'MESAJ') THROW 50400, N'Geçersiz kanal.', 1;
  DECLARE @Status varchar(4) = CASE WHEN @Approve = 1 THEN 'ONAY' ELSE 'RET' END;
  DECLARE @Current varchar(4) = (SELECT Status FROM data.tvf_ConsentState(@UserId) WHERE Channel = @Channel);
  -- Hiç onay vermemiş birinin "ret"i kaydedilmez (zaten ileti gitmez); aynı durum tekrar yazılmaz
  IF ISNULL(@Current, 'RET') = @Status RETURN;
  IF @Status = 'ONAY' AND (SELECT CommercialConsentEnabled FROM data.PlatformSettings) = 0
    THROW 50409, N'Ticari ileti onayı şu an alınmıyor.', 1;
  DECLARE @Recipient nvarchar(254) = (SELECT CASE WHEN @Channel = 'EPOSTA' THEN Email ELSE Phone END FROM data.Users WHERE Id = @UserId);
  IF @Recipient IS NULL THROW 50400, N'Bu kanal için kayıtlı adresiniz yok.', 1;
  INSERT INTO data.CommercialConsents (UserId, Channel, Status, Recipient, Source) VALUES (@UserId, @Channel, @Status, @Recipient, @Source);
END
GO

-- Hesabım ve kayıt: izinleri göster
CREATE OR ALTER PROCEDURE api.Consent_Get @ActorId uniqueidentifier
AS
BEGIN
  SET NOCOUNT ON;
  EXEC data.usp_RequireUser @ActorId;
  SELECT (SELECT CommercialConsentEnabled FROM data.PlatformSettings) AS Enabled,
         CAST(CASE WHEN EXISTS (SELECT 1 FROM data.tvf_ConsentState(@ActorId) WHERE Channel = 'EPOSTA' AND Status = 'ONAY') THEN 1 ELSE 0 END AS bit) AS Email,
         CAST(CASE WHEN EXISTS (SELECT 1 FROM data.tvf_ConsentState(@ActorId) WHERE Channel = 'MESAJ' AND Status = 'ONAY') THEN 1 ELSE 0 END AS bit) AS Sms;
END
GO

-- Hesabım / kayıt: izinleri kaydet
CREATE OR ALTER PROCEDURE api.Consent_Set @ActorId uniqueidentifier, @Email bit, @Sms bit
AS
BEGIN
  SET NOCOUNT ON; SET XACT_ABORT ON;
  EXEC data.usp_RequireUser @ActorId;
  BEGIN TRAN;
    EXEC data.usp_SetConsent @ActorId, 'EPOSTA', @Email, 'HS_WEB';
    EXEC data.usp_SetConsent @ActorId, 'MESAJ', @Sms, 'HS_WEB';
  COMMIT;
END
GO

-- E-postadaki "İletiden çık" bağlantısı (giriş gerekmez; bağlantı imzalıdır, imzayı site kontrol eder)
CREATE OR ALTER PROCEDURE api.Consent_Unsubscribe @UserId uniqueidentifier, @Channel varchar(6)
AS
BEGIN
  SET NOCOUNT ON;
  IF NOT EXISTS (SELECT 1 FROM data.Users WHERE Id = @UserId) THROW 50404, N'Kayıt bulunamadı.', 1;
  EXEC data.usp_SetConsent @UserId, @Channel, 0, 'HS_ILETI_RET';
END
GO
