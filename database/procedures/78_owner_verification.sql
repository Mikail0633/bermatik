-- =====================================================================
-- Dükkân sahibi doğrulaması: e-posta kodu ve sahiplik belgesi
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

-- ---------------------------------------------------------------------
-- Sahiplik belgesi: kendi başvurusuna (bekleyen dükkân) ya da açık sahiplenme talebine eklenir
-- ---------------------------------------------------------------------
CREATE OR ALTER PROCEDURE api.OwnerDocument_Add
  @ActorId uniqueidentifier, @ShopId uniqueidentifier = NULL, @ClaimId uniqueidentifier = NULL, @Kind varchar(16), @FilePath nvarchar(300)
AS
BEGIN
  SET NOCOUNT ON;
  EXEC data.usp_RequireUser @ActorId;
  IF (@ShopId IS NULL AND @ClaimId IS NULL) OR (@ShopId IS NOT NULL AND @ClaimId IS NOT NULL)
    THROW 50400, N'Belge bir dükkâna ya da sahiplenme talebine eklenmeli.', 1;
  IF @Kind NOT IN ('vergi_levhasi', 'esnaf_kaydi', 'diger') THROW 50400, N'Belge türü geçersiz.', 1;
  IF @ShopId IS NOT NULL AND data.fn_IsShopOwner(@ActorId, @ShopId) = 0 THROW 50403, N'Bu işlem için yetkiniz yok.', 1;
  IF @ClaimId IS NOT NULL AND NOT EXISTS (SELECT 1 FROM data.ShopClaims WHERE Id = @ClaimId AND UserId = @ActorId AND Status = 'open')
    THROW 50403, N'Bu işlem için yetkiniz yok.', 1;
  IF (SELECT COUNT(*) FROM data.OwnerDocuments WHERE (ShopId = @ShopId OR ClaimId = @ClaimId) AND Status <> 'rejected') >= 5
    THROW 50409, N'En fazla 5 belge yükleyebilirsiniz.', 1;
  DECLARE @Out TABLE (Id uniqueidentifier);
  INSERT INTO data.OwnerDocuments (UserId, ShopId, ClaimId, Kind, FilePath) OUTPUT inserted.Id INTO @Out
  VALUES (@ActorId, @ShopId, @ClaimId, @Kind, @FilePath);
  SELECT Id FROM @Out;
END
GO

-- Belgeler: yükleyen kişi ya da admin görür
CREATE OR ALTER PROCEDURE api.OwnerDocument_List @ActorId uniqueidentifier, @ShopId uniqueidentifier = NULL, @ClaimId uniqueidentifier = NULL
AS
BEGIN
  SET NOCOUNT ON;
  EXEC data.usp_RequireUser @ActorId;
  SELECT d.Id, d.Kind, d.Status, d.ReviewNote, data.fn_ToIstanbul(d.CreatedAt) AS CreatedAtLocal
  FROM data.OwnerDocuments d
  WHERE ((@ShopId IS NOT NULL AND d.ShopId = @ShopId) OR (@ClaimId IS NOT NULL AND d.ClaimId = @ClaimId))
    AND (d.UserId = @ActorId OR data.fn_IsAdmin(@ActorId) = 1)
  ORDER BY d.CreatedAt;
END
GO

CREATE OR ALTER PROCEDURE api.OwnerDocument_GetFile @ActorId uniqueidentifier, @DocumentId uniqueidentifier
AS
BEGIN
  SET NOCOUNT ON;
  SELECT FilePath FROM data.OwnerDocuments
  WHERE Id = @DocumentId AND (UserId = @ActorId OR data.fn_IsAdmin(@ActorId) = 1);
END
GO

CREATE OR ALTER PROCEDURE api.Admin_OwnerDocument_Review
  @ActorId uniqueidentifier, @DocumentId uniqueidentifier, @Status varchar(10), @Note nvarchar(300) = NULL
AS
BEGIN
  SET NOCOUNT ON; SET XACT_ABORT ON;
  EXEC data.usp_RequireAdmin @ActorId;
  IF @Status NOT IN ('approved', 'rejected') THROW 50400, N'Durum geçersiz.', 1;
  BEGIN TRAN;
    UPDATE data.OwnerDocuments SET Status = @Status, ReviewNote = @Note, ReviewedBy = @ActorId, ReviewedAt = SYSUTCDATETIME()
    WHERE Id = @DocumentId;
    IF @@ROWCOUNT = 0 THROW 50404, N'Belge bulunamadı.', 1;
    DECLARE @EntityId nvarchar(64) = CONVERT(nvarchar(64), @DocumentId);
    DECLARE @Details nvarchar(max) = (SELECT @Status AS status, @Note AS note FOR JSON PATH, WITHOUT_ARRAY_WRAPPER);
    EXEC data.usp_Log @ActorId, 'owner_document', 'owner_documents', @EntityId, @Details;
  COMMIT;
END
GO
