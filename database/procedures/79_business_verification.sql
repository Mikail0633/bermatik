-- =====================================================================
-- Sahiplik / işletme hesabı belgeleri ve işletme hesabı doğrulaması (migration 0027)
-- =====================================================================

-- ---------------------------------------------------------------------
-- Belge ekle: kendi başvurusuna (bekleyen dükkân), açık sahiplenme talebine
-- ya da (ikisi de boşsa) doğrudan işletme hesabına — kayıt ekranında istenen belge.
--   @NumberHash: belge numarasının gizli anahtarlı özeti (numara açık saklanmaz)
--   @FileHash: dosyanın SHA-256 özeti — aynı dosya başka hesapta kullanılamaz
--   @NviResult: kimlikte Nüfus servisinin cevabı ('dogru' → işletme paneli hemen açılır)
-- ---------------------------------------------------------------------
CREATE OR ALTER PROCEDURE api.OwnerDocument_Add
  @ActorId uniqueidentifier, @ShopId uniqueidentifier = NULL, @ClaimId uniqueidentifier = NULL, @Kind varchar(16), @FilePath nvarchar(300),
  @NumberHash binary(32) = NULL, @NumberMasked nvarchar(40) = NULL, @FileHash binary(32) = NULL, @NviResult varchar(6) = NULL
AS
BEGIN
  SET NOCOUNT ON; SET XACT_ABORT ON;
  EXEC data.usp_RequireUser @ActorId;
  IF @ShopId IS NOT NULL AND @ClaimId IS NOT NULL
    THROW 50400, N'Belge bir dükkâna ya da sahiplenme talebine eklenmeli.', 1;
  IF @Kind NOT IN ('vergi_levhasi', 'esnaf_kaydi', 'kimlik', 'ruhsat', 'diger') THROW 50400, N'Belge türü geçersiz.', 1;
  DECLARE @IsAccount bit = CASE WHEN @ShopId IS NULL AND @ClaimId IS NULL THEN 1 ELSE 0 END;
  IF @IsAccount = 1 AND NOT EXISTS (SELECT 1 FROM data.Users WHERE Id = @ActorId AND Role IN ('shop_owner', 'staff', 'admin'))
    THROW 50403, N'Hesap belgesi yalnızca işletme hesaplarına eklenir.', 1;
  IF @ShopId IS NOT NULL AND data.fn_IsShopOwner(@ActorId, @ShopId) = 0 THROW 50403, N'Bu işlem için yetkiniz yok.', 1;
  IF @ClaimId IS NOT NULL AND NOT EXISTS (SELECT 1 FROM data.ShopClaims WHERE Id = @ClaimId AND UserId = @ActorId AND Status = 'open')
    THROW 50403, N'Bu işlem için yetkiniz yok.', 1;
  IF @NviResult = 'yanlis' THROW 50400, N'Kimlik bilgileri nüfus kayıtlarıyla eşleşmedi.', 1;
  -- Aynı belge (numara ya da dosya) başka bir hesapta kullanılıyorsa kabul edilmez
  IF @NumberHash IS NOT NULL AND EXISTS (SELECT 1 FROM data.OwnerDocuments
       WHERE NumberHash = @NumberHash AND Kind = @Kind AND UserId <> @ActorId AND Status <> 'rejected')
    THROW 50409, N'Bu belge numarası başka bir hesapta kullanılıyor. Size aitse bizimle iletişime geçin.', 1;
  IF @FileHash IS NOT NULL AND EXISTS (SELECT 1 FROM data.OwnerDocuments
       WHERE FileHash = @FileHash AND UserId <> @ActorId AND Status <> 'rejected')
    THROW 50409, N'Bu belge dosyası başka bir hesapta kullanılıyor. Kendi belgenizin fotoğrafını yükleyin.', 1;
  IF @IsAccount = 1 AND EXISTS (SELECT 1 FROM data.OwnerDocuments
       WHERE ShopId IS NULL AND ClaimId IS NULL AND Status <> 'rejected'
         AND ((@NumberHash IS NOT NULL AND NumberHash = @NumberHash AND Kind = @Kind) OR (@FileHash IS NOT NULL AND FileHash = @FileHash)))
    THROW 50409, N'Bu belgeyi zaten yüklediniz.', 1;
  IF (SELECT COUNT(*) FROM data.OwnerDocuments
      WHERE Status <> 'rejected'
        AND (ShopId = @ShopId OR ClaimId = @ClaimId
             OR (@IsAccount = 1 AND UserId = @ActorId AND ShopId IS NULL AND ClaimId IS NULL))) >= 5
    THROW 50409, N'En fazla 5 belge yükleyebilirsiniz.', 1;
  DECLARE @Out TABLE (Id uniqueidentifier);
  BEGIN TRAN;
    INSERT INTO data.OwnerDocuments (UserId, ShopId, ClaimId, Kind, FilePath, NumberHash, NumberMasked, FileHash, NviResult)
    OUTPUT inserted.Id INTO @Out
    VALUES (@ActorId, @ShopId, @ClaimId, @Kind, @FilePath, @NumberHash, @NumberMasked, @FileHash, @NviResult);
    -- Kimlik nüfus kayıtlarıyla eşleştiyse işletme paneli hemen açılır (admin sonradan bakar)
    IF @IsAccount = 1 AND @Kind = 'kimlik' AND @NviResult = 'dogru'
      UPDATE data.Users SET BusinessVerifiedAt = SYSUTCDATETIME(), UpdatedAt = SYSUTCDATETIME()
      WHERE Id = @ActorId AND BusinessVerifiedAt IS NULL;
    -- Adminlere haber: işletme hesabı belgesi geldi (zil + telefon; e-postayı site ayrıca gönderir)
    IF @IsAccount = 1
    BEGIN
      DECLARE @AdminBody nvarchar(300) = (SELECT FirstName + N' ' + LastName FROM data.Users WHERE Id = @ActorId)
        + N' işletme hesabı için ' + CASE @Kind WHEN 'kimlik' THEN N'kimlik' WHEN 'ruhsat' THEN N'ruhsat' WHEN 'vergi_levhasi' THEN N'vergi levhası'
                                                WHEN 'esnaf_kaydi' THEN N'esnaf kaydı' ELSE N'belge' END + N' yükledi. '
        + CASE WHEN @Kind = 'kimlik' AND @NviResult = 'dogru' THEN N'Kimlik nüfusta doğrulandı, panel açıldı; yine de göz atın.'
               ELSE N'Onayınızı bekliyor.' END;
      DECLARE @AdminId uniqueidentifier;
      DECLARE adm CURSOR LOCAL FAST_FORWARD FOR SELECT Id FROM data.Users WHERE Role = 'admin' AND IsActive = 1 AND Id <> @ActorId;
      OPEN adm; FETCH NEXT FROM adm INTO @AdminId;
      WHILE @@FETCH_STATUS = 0
      BEGIN
        EXEC data.usp_Enqueue @AdminId, 'admin_document', N'Yeni işletme hesabı belgesi', @AdminBody, N'/admin/belgeler';
        FETCH NEXT FROM adm INTO @AdminId;
      END
      CLOSE adm; DEALLOCATE adm;
    END
  COMMIT;
  SELECT Id FROM @Out;
END
GO

-- Belgeler: yükleyen kişi ya da admin görür. @Account = 1 → kişinin kendi hesap belgeleri
CREATE OR ALTER PROCEDURE api.OwnerDocument_List
  @ActorId uniqueidentifier, @ShopId uniqueidentifier = NULL, @ClaimId uniqueidentifier = NULL, @Account bit = 0
AS
BEGIN
  SET NOCOUNT ON;
  EXEC data.usp_RequireUser @ActorId;
  SELECT d.Id, d.Kind, d.Status, d.ReviewNote, data.fn_ToIstanbul(d.CreatedAt) AS CreatedAtLocal, d.NumberMasked, d.NviResult
  FROM data.OwnerDocuments d
  WHERE ((@ShopId IS NOT NULL AND d.ShopId = @ShopId) OR (@ClaimId IS NOT NULL AND d.ClaimId = @ClaimId)
         OR (@Account = 1 AND d.UserId = @ActorId AND d.ShopId IS NULL AND d.ClaimId IS NULL))
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

-- Admin belge kararı. Hesap belgesinde: "Uygun" → işletme paneli açılır;
-- "Uygun değil" → başka geçerli hesap belgesi kalmadıysa panel kapanır. Kişiye bildirim gider.
CREATE OR ALTER PROCEDURE api.Admin_OwnerDocument_Review
  @ActorId uniqueidentifier, @DocumentId uniqueidentifier, @Status varchar(10), @Note nvarchar(300) = NULL
AS
BEGIN
  SET NOCOUNT ON; SET XACT_ABORT ON;
  EXEC data.usp_RequireAdmin @ActorId;
  IF @Status NOT IN ('approved', 'rejected') THROW 50400, N'Durum geçersiz.', 1;
  DECLARE @UserId uniqueidentifier, @IsAccount bit;
  SELECT @UserId = UserId, @IsAccount = CASE WHEN ShopId IS NULL AND ClaimId IS NULL THEN 1 ELSE 0 END
  FROM data.OwnerDocuments WHERE Id = @DocumentId;
  IF @UserId IS NULL THROW 50404, N'Belge bulunamadı.', 1;
  BEGIN TRAN;
    UPDATE data.OwnerDocuments SET Status = @Status, ReviewNote = @Note, ReviewedBy = @ActorId, ReviewedAt = SYSUTCDATETIME()
    WHERE Id = @DocumentId;
    IF @IsAccount = 1 AND @Status = 'approved'
    BEGIN
      DECLARE @WasOpen bit = CASE WHEN EXISTS (SELECT 1 FROM data.Users WHERE Id = @UserId AND BusinessVerifiedAt IS NOT NULL) THEN 1 ELSE 0 END;
      UPDATE data.Users SET BusinessVerifiedAt = ISNULL(BusinessVerifiedAt, SYSUTCDATETIME()), UpdatedAt = SYSUTCDATETIME() WHERE Id = @UserId;
      IF @WasOpen = 0
        EXEC data.usp_Enqueue @UserId, 'account_verify', N'İşletme hesabınız onaylandı',
          N'Belgeniz incelendi. İşletme panelinizi kullanabilirsiniz.', N'/panel';
    END
    IF @IsAccount = 1 AND @Status = 'rejected'
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM data.OwnerDocuments
                     WHERE UserId = @UserId AND ShopId IS NULL AND ClaimId IS NULL AND Id <> @DocumentId
                       AND (Status = 'approved' OR (Status = 'pending' AND Kind = 'kimlik' AND NviResult = 'dogru')))
        AND NOT EXISTS (SELECT 1 FROM data.Users WHERE Id = @UserId AND Role = 'admin')
        UPDATE data.Users SET BusinessVerifiedAt = NULL, UpdatedAt = SYSUTCDATETIME() WHERE Id = @UserId;
      DECLARE @Body nvarchar(300) = N'Belgeniz uygun bulunmadı' + ISNULL(N': ' + @Note, N'') + N'. İşletme panelinden yeni belge yükleyebilirsiniz.';
      EXEC data.usp_Enqueue @UserId, 'account_verify', N'Belgeniz uygun bulunmadı', @Body, N'/panel';
    END
    DECLARE @EntityId nvarchar(64) = CONVERT(nvarchar(64), @DocumentId);
    DECLARE @Details nvarchar(max) = (SELECT @Status AS status, @Note AS note FOR JSON PATH, WITHOUT_ARRAY_WRAPPER);
    EXEC data.usp_Log @ActorId, 'owner_document', 'owner_documents', @EntityId, @Details;
  COMMIT;
END
GO

-- İşletme hesabı belgeleri (kayıtta / panelde yüklenen): admin listesi
CREATE OR ALTER PROCEDURE api.Admin_AccountDocument_List @ActorId uniqueidentifier, @Status varchar(10) = 'pending'
AS
BEGIN
  SET NOCOUNT ON;
  EXEC data.usp_RequireAdmin @ActorId;
  SELECT d.Id, d.Kind, d.Status, d.ReviewNote, data.fn_ToIstanbul(d.CreatedAt) AS CreatedAtLocal, d.NumberMasked, d.NviResult,
         u.Id AS UserId, u.FirstName + N' ' + u.LastName AS UserName, u.Email, u.Phone, u.Role, u.BirthYear,
         CAST(CASE WHEN u.BusinessVerifiedAt IS NULL THEN 0 ELSE 1 END AS bit) AS PanelOpen,
         (SELECT STRING_AGG(s.Code + N' ' + s.Name, N', ') FROM data.Shops s WHERE s.OwnerId = u.Id) AS Shops
  FROM data.OwnerDocuments d JOIN data.Users u ON u.Id = d.UserId
  WHERE d.ShopId IS NULL AND d.ClaimId IS NULL AND (@Status IS NULL OR d.Status = @Status)
  ORDER BY d.CreatedAt;
END
GO

-- Admin e-posta uyarısı için alıcılar (yalnızca site sunucusu çağırır)
CREATE OR ALTER PROCEDURE api.Admin_AlertRecipients
AS
BEGIN
  SET NOCOUNT ON;
  SELECT Email, FirstName FROM data.Users WHERE Role = 'admin' AND IsActive = 1 AND DeletedAt IS NULL;
END
GO

-- Kişinin işletme doğrulama durumu (panel kilidi için)
CREATE OR ALTER PROCEDURE api.Business_Status @ActorId uniqueidentifier
AS
BEGIN
  SET NOCOUNT ON;
  EXEC data.usp_RequireUser @ActorId;
  SELECT data.fn_IsBusinessVerified(u.Id) AS Verified,
         (SELECT COUNT(*) FROM data.OwnerDocuments d WHERE d.UserId = u.Id AND d.ShopId IS NULL AND d.ClaimId IS NULL AND d.Status = 'pending') AS PendingDocs
  FROM data.Users u WHERE u.Id = @ActorId;
END
GO

-- Kayıttan ÖNCE: bu belge (numara ya da dosya) başka bir hesapta kullanılıyor mu? (hesap açılmadan kontrol)
CREATE OR ALTER PROCEDURE api.OwnerDocument_CheckUnique @Kind varchar(16), @NumberHash binary(32), @FileHash binary(32)
AS
BEGIN
  SET NOCOUNT ON;
  IF EXISTS (SELECT 1 FROM data.OwnerDocuments WHERE NumberHash = @NumberHash AND Kind = @Kind AND Status <> 'rejected')
    THROW 50409, N'Bu belge numarası başka bir hesapta kullanılıyor. Size aitse bizimle iletişime geçin.', 1;
  IF EXISTS (SELECT 1 FROM data.OwnerDocuments WHERE FileHash = @FileHash AND Status <> 'rejected')
    THROW 50409, N'Bu belge dosyası başka bir hesapta kullanılıyor. Kendi belgenizin fotoğrafını yükleyin.', 1;
END
GO
