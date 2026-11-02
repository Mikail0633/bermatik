-- =====================================================================
-- Bermatik — Sahiplenme talepleri ve eksik dükkân bildirimleri
-- =====================================================================

-- "Bu dükkân sizin mi?" — yalnızca henüz katılmamış dükkânlar sahiplenilebilir
CREATE OR ALTER PROCEDURE api.Claim_Create @ActorId uniqueidentifier, @ShopId uniqueidentifier, @Phone nvarchar(40), @Note nvarchar(500) = NULL
AS
BEGIN
  SET NOCOUNT ON;
  EXEC data.usp_RequireUser @ActorId;
  DECLARE @NormPhone varchar(16) = data.fn_NormalizePhone(@Phone);
  IF @NormPhone IS NULL THROW 50400, N'Geçerli bir telefon numarası girin; sizi arayıp doğrulayacağız.', 1;
  IF NOT EXISTS (SELECT 1 FROM data.Shops WHERE Id = @ShopId AND Status = 'approved' AND (IsClaimed = 0 OR data.fn_IsAdmin(OwnerId) = 1))
    THROW 50409, N'Bu dükkân zaten sahiplenilmiş veya bulunamadı.', 1;
  IF EXISTS (SELECT 1 FROM data.Users WHERE Id = @ActorId AND Role = 'customer')
    THROW 50403, N'Dükkân sahiplenmek için işletme hesabı gerekir.', 1;
  IF EXISTS (SELECT 1 FROM data.Users WHERE Id = @ActorId AND EmailVerifiedAt IS NULL)
    THROW 50409, N'Önce e-posta adresinizi doğrulayın.', 1;
  IF EXISTS (SELECT 1 FROM data.ShopClaims WHERE ShopId = @ShopId AND UserId = @ActorId AND Status = 'open')
    THROW 50409, N'Bu dükkân için talebiniz zaten inceleniyor.', 1;
  IF (SELECT COUNT(*) FROM data.ShopClaims WHERE UserId = @ActorId AND CreatedAt > DATEADD(day, -1, SYSUTCDATETIME())) >= 3
    THROW 50409, N'Bugün için talep sınırına ulaştınız.', 1;
  DECLARE @Out TABLE (Id uniqueidentifier);
  INSERT INTO data.ShopClaims (ShopId, UserId, Phone, Note) OUTPUT inserted.Id INTO @Out
  VALUES (@ShopId, @ActorId, @NormPhone, NULLIF(LTRIM(RTRIM(@Note)), N''));
  SELECT Id FROM @Out;
END
GO

CREATE OR ALTER PROCEDURE api.Admin_Claim_List @ActorId uniqueidentifier, @Status varchar(10) = 'open'
AS
BEGIN
  SET NOCOUNT ON;
  EXEC data.usp_RequireAdmin @ActorId;
  SELECT c.Id, c.Status, c.Phone, c.Note, c.ReviewNote, data.fn_ToIstanbul(c.CreatedAt) AS CreatedAtLocal,
         s.Id AS ShopId, s.Code, s.Name AS ShopName, s.Phone AS ShopPhone, d.Name AS District,
         u.FirstName + N' ' + u.LastName AS UserName, u.Email COLLATE DATABASE_DEFAULT AS UserEmail,
         (SELECT COUNT(*) FROM data.ShopClaims c2 WHERE c2.ShopId = c.ShopId AND c2.Status = 'open') AS OpenClaimsForShop
  FROM data.ShopClaims c
  JOIN data.Shops s ON s.Id = c.ShopId
  JOIN data.Districts d ON d.Id = s.DistrictId
  JOIN data.Users u ON u.Id = c.UserId
  WHERE @Status IS NULL OR c.Status = @Status
  ORDER BY c.CreatedAt;
END
GO

-- Onaylanınca dükkân talep edene geçer; aynı dükkânın diğer açık talepleri reddedilir
CREATE OR ALTER PROCEDURE api.Admin_Claim_Resolve @ActorId uniqueidentifier, @ClaimId uniqueidentifier, @Approve bit, @Note nvarchar(300) = NULL
AS
BEGIN
  SET NOCOUNT ON; SET XACT_ABORT ON;
  EXEC data.usp_RequireAdmin @ActorId;
  DECLARE @ShopId uniqueidentifier, @UserId uniqueidentifier;
  SELECT @ShopId = ShopId, @UserId = UserId FROM data.ShopClaims WHERE Id = @ClaimId AND Status = 'open';
  IF @ShopId IS NULL THROW 50404, N'Açık talep bulunamadı.', 1;
  BEGIN TRAN;
    UPDATE data.ShopClaims SET Status = CASE WHEN @Approve = 1 THEN 'approved' ELSE 'rejected' END,
           ReviewNote = @Note, ReviewedBy = @ActorId, ReviewedAt = SYSUTCDATETIME()
    WHERE Id = @ClaimId;
    IF @Approve = 1
    BEGIN
      IF EXISTS (SELECT 1 FROM data.Shops WHERE Id = @ShopId AND IsClaimed = 1 AND data.fn_IsAdmin(OwnerId) = 0) THROW 50409, N'Dükkân zaten sahiplenilmiş.', 1;
      UPDATE data.Shops SET OwnerId = @UserId, IsClaimed = 1, NeedsReview = 0, UpdatedBy = @ActorId, UpdatedAt = SYSUTCDATETIME() WHERE Id = @ShopId;
      UPDATE data.Users SET Role = 'shop_owner', UpdatedAt = SYSUTCDATETIME() WHERE Id = @UserId AND Role IN ('customer', 'staff');
      UPDATE data.ShopClaims SET Status = 'rejected', ReviewNote = N'Dükkân başka bir talep sahibine verildi.', ReviewedBy = @ActorId, ReviewedAt = SYSUTCDATETIME()
      WHERE ShopId = @ShopId AND Status = 'open';
      EXEC data.usp_Enqueue @UserId, 'shop_claim', N'Dükkânınız onaylandı 🎉',
        N'Sahiplenme talebiniz onaylandı. İşletme panelinden hizmet, fiyat ve personel ekleyerek randevu almaya başlayın.', N'/panel';
    END
    DECLARE @EntityId nvarchar(64) = CONVERT(nvarchar(64), @ClaimId);
    DECLARE @Details nvarchar(max) = (SELECT @Approve AS approve, @ShopId AS shopId, @Note AS note FOR JSON PATH, WITHOUT_ARRAY_WRAPPER);
    EXEC data.usp_Log @ActorId, 'claim_resolve', 'shop_claims', @EntityId, @Details;
  COMMIT;
END
GO

-- "Eksik dükkân bildir"
CREATE OR ALTER PROCEDURE api.Suggestion_Create
  @ActorId uniqueidentifier, @Segment varchar(5), @Name nvarchar(100), @Phone nvarchar(40) = NULL,
  @Latitude decimal(9, 6), @Longitude decimal(9, 6), @Note nvarchar(500) = NULL
AS
BEGIN
  SET NOCOUNT ON;
  EXEC data.usp_RequireUser @ActorId;
  IF @Segment NOT IN ('erkek', 'kadin') THROW 50400, N'Bölüm geçersiz.', 1;
  IF LEN(LTRIM(RTRIM(@Name))) < 2 THROW 50400, N'Dükkânın adını yazın.', 1;
  IF (SELECT COUNT(*) FROM data.ShopSuggestions WHERE ReporterId = @ActorId AND CreatedAt > DATEADD(day, -1, SYSUTCDATETIME())) >= 10
    THROW 50409, N'Bugün için bildirim sınırına ulaştınız. Teşekkürler!', 1;
  DECLARE @Out TABLE (Id uniqueidentifier);
  INSERT INTO data.ShopSuggestions (ReporterId, Segment, Name, Phone, Latitude, Longitude, Note) OUTPUT inserted.Id INTO @Out
  VALUES (@ActorId, @Segment, LTRIM(RTRIM(@Name)), data.fn_NormalizePhone(@Phone), @Latitude, @Longitude, NULLIF(LTRIM(RTRIM(@Note)), N''));
  SELECT Id FROM @Out;
END
GO

CREATE OR ALTER PROCEDURE api.Admin_Suggestion_List @ActorId uniqueidentifier, @Status varchar(10) = 'open'
AS
BEGIN
  SET NOCOUNT ON;
  EXEC data.usp_RequireAdmin @ActorId;
  SELECT g.Id, g.Status, g.Segment, g.Name, g.Phone, g.Latitude, g.Longitude, g.Note, g.CreatedShopId,
         data.fn_ToIstanbul(g.CreatedAt) AS CreatedAtLocal, u.FirstName + N' ' + u.LastName AS ReporterName,
         -- Yakında aynı isimli dükkân var mı? (tekrar eklemeyi önlemek için)
         (SELECT TOP (1) s.Name FROM data.Shops s
          WHERE s.Location.STDistance(geography::Point(CAST(g.Latitude AS float), CAST(g.Longitude AS float), 4326)) < 150
          ORDER BY s.Location.STDistance(geography::Point(CAST(g.Latitude AS float), CAST(g.Longitude AS float), 4326))) AS NearbyShop
  FROM data.ShopSuggestions g JOIN data.Users u ON u.Id = g.ReporterId
  WHERE @Status IS NULL OR g.Status = @Status
  ORDER BY g.CreatedAt;
END
GO

-- 'added' (dükkân eklendi; @CreatedShopId ile) veya 'dismissed'
CREATE OR ALTER PROCEDURE api.Admin_Suggestion_Resolve
  @ActorId uniqueidentifier, @SuggestionId uniqueidentifier, @Status varchar(10), @CreatedShopId uniqueidentifier = NULL
AS
BEGIN
  SET NOCOUNT ON;
  EXEC data.usp_RequireAdmin @ActorId;
  IF @Status NOT IN ('added', 'dismissed') THROW 50400, N'Durum geçersiz.', 1;
  UPDATE data.ShopSuggestions SET Status = @Status, CreatedShopId = @CreatedShopId, ReviewedBy = @ActorId, ReviewedAt = SYSUTCDATETIME()
  WHERE Id = @SuggestionId AND Status = 'open';
  IF @@ROWCOUNT = 0 THROW 50404, N'Açık bildirim bulunamadı.', 1;
END
GO
