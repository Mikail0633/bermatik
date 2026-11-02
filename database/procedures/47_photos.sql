-- =====================================================================
-- Fotoğraflar: dükkân kapak fotoğrafı ve personel fotoğrafı
-- (Galeri: 45_extras.sql, ürün fotoğrafları: 60_reviews_store.sql)
-- Dosyanın kendisini site kaydeder; burada yalnızca yolu tutulur.
-- Eski fotoğrafın yolu döner, site eski dosyayı diskten siler.
-- =====================================================================

-- @Path NULL ise kapak fotoğrafı kaldırılır. Dükkân sahibi veya admin.
CREATE OR ALTER PROCEDURE api.Shop_SetCover @ActorId uniqueidentifier, @ShopId uniqueidentifier, @Path nvarchar(300) = NULL
AS
BEGIN
  SET NOCOUNT ON; SET XACT_ABORT ON;
  IF data.fn_CanManageShop(@ActorId, @ShopId) = 0 THROW 50403, N'Bu işlem için yetkiniz yok.', 1;
  DECLARE @Old nvarchar(300);
  BEGIN TRAN;
    SELECT @Old = CoverImagePath FROM data.Shops WITH (UPDLOCK) WHERE Id = @ShopId;
    UPDATE data.Shops SET CoverImagePath = NULLIF(LTRIM(RTRIM(@Path)), N''), UpdatedAt = SYSUTCDATETIME(), UpdatedBy = @ActorId
    WHERE Id = @ShopId;
    IF @@ROWCOUNT = 0 THROW 50404, N'Dükkân bulunamadı.', 1;
    IF data.fn_IsShopOwner(@ActorId, @ShopId) = 0
    BEGIN
      DECLARE @EntityId nvarchar(64) = CONVERT(nvarchar(64), @ShopId);
      DECLARE @Details nvarchar(max) = (SELECT CASE WHEN @Path IS NULL THEN 'removed' ELSE 'set' END AS cover FOR JSON PATH, WITHOUT_ARRAY_WRAPPER);
      EXEC data.usp_Log @ActorId, 'shop_cover', 'shop', @EntityId, @Details;
    END
  COMMIT;
  SELECT @Old AS OldPath;
END
GO

-- @Path NULL ise personel fotoğrafı kaldırılır. Dükkân sahibi, personelin kendisi veya admin.
CREATE OR ALTER PROCEDURE api.Staff_SetPhoto @ActorId uniqueidentifier, @StaffId uniqueidentifier, @Path nvarchar(300) = NULL
AS
BEGIN
  SET NOCOUNT ON; SET XACT_ABORT ON;
  IF data.fn_CanEditStaff(@ActorId, @StaffId) = 0 THROW 50403, N'Bu işlem için yetkiniz yok.', 1;
  DECLARE @Old nvarchar(300);
  BEGIN TRAN;
    SELECT @Old = PhotoPath FROM data.Staff WITH (UPDLOCK) WHERE Id = @StaffId;
    UPDATE data.Staff SET PhotoPath = NULLIF(LTRIM(RTRIM(@Path)), N'') WHERE Id = @StaffId;
    IF @@ROWCOUNT = 0 THROW 50404, N'Personel bulunamadı.', 1;
  COMMIT;
  SELECT @Old AS OldPath;
END
GO
