-- =====================================================================
-- Dükkân sahibi doğrulaması: e-posta kodu (belge işlemleri: 79_business_verification.sql)
-- =====================================================================

-- Yeni kod: site 6 haneli kodu üretir, özetini buraya yazar, kodu e-postayla gönderir
CREATE OR ALTER PROCEDURE api.Email_CreateCode @ActorId uniqueidentifier, @CodeHash binary(32)
AS
BEGIN
  SET NOCOUNT ON;
  EXEC data.usp_RequireUser @ActorId;
  IF EXISTS (SELECT 1 FROM data.Users WHERE Id = @ActorId AND EmailVerifiedAt IS NOT NULL)
    THROW 50409, N'E-postanız zaten doğrulandı.', 1;
  IF EXISTS (SELECT 1 FROM data.EmailCodes WHERE UserId = @ActorId AND CreatedAt > DATEADD(second, -60, SYSUTCDATETIME()))
    THROW 50409, N'Yeni kod istemek için 1 dakika bekleyin.', 1;
  IF (SELECT COUNT(*) FROM data.EmailCodes WHERE UserId = @ActorId AND CreatedAt > DATEADD(hour, -1, SYSUTCDATETIME())) >= 5
    THROW 50409, N'Çok fazla kod istediniz. Bir saat sonra tekrar deneyin.', 1;
  INSERT INTO data.EmailCodes (UserId, CodeHash, ExpiresAt) VALUES (@ActorId, @CodeHash, DATEADD(minute, 15, SYSUTCDATETIME()));
  SELECT Email, FirstName FROM data.Users WHERE Id = @ActorId;
END
GO

CREATE OR ALTER PROCEDURE api.Email_VerifyCode @ActorId uniqueidentifier, @CodeHash binary(32)
AS
BEGIN
  SET NOCOUNT ON;
  EXEC data.usp_RequireUser @ActorId;
  IF EXISTS (SELECT 1 FROM data.Users WHERE Id = @ActorId AND EmailVerifiedAt IS NOT NULL) RETURN;
  DECLARE @Id bigint, @Hash binary(32), @Attempts tinyint;
  SELECT TOP (1) @Id = Id, @Hash = CodeHash, @Attempts = Attempts
  FROM data.EmailCodes WHERE UserId = @ActorId AND UsedAt IS NULL AND ExpiresAt > SYSUTCDATETIME()
  ORDER BY Id DESC;
  IF @Id IS NULL THROW 50400, N'Kodun süresi doldu ya da kod istenmedi. Yeni kod isteyin.', 1;
  IF @Attempts >= 5 THROW 50409, N'Çok fazla yanlış deneme. Yeni kod isteyin.', 1;
  IF @Hash <> @CodeHash
  BEGIN
    UPDATE data.EmailCodes SET Attempts = Attempts + 1 WHERE Id = @Id;
    THROW 50400, N'Kod yanlış. E-postanızdaki 6 haneli kodu kontrol edin.', 1;
  END
  UPDATE data.EmailCodes SET UsedAt = SYSUTCDATETIME() WHERE Id = @Id;
  UPDATE data.Users SET EmailVerifiedAt = SYSUTCDATETIME(), UpdatedAt = SYSUTCDATETIME() WHERE Id = @ActorId;
END
GO

