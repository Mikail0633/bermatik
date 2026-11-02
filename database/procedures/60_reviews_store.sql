-- =====================================================================
-- Bermatik — Yorumlar ve ürün satışı
-- =====================================================================

-- Yalnızca tamamlanmış kendi randevusu için, randevu başına bir yorum
CREATE OR ALTER PROCEDURE api.Review_Add
  @ActorId uniqueidentifier, @AppointmentId uniqueidentifier, @Rating tinyint, @Comment nvarchar(1000) = NULL
AS
BEGIN
  SET NOCOUNT ON;
  EXEC data.usp_RequireUser @ActorId;
  IF NOT EXISTS (SELECT 1 FROM data.PlatformSettings WHERE ReviewsEnabled = 1)
    THROW 50409, N'Yorumlar şu an kapalı.', 1;
  IF @Rating NOT BETWEEN 1 AND 5 THROW 50400, N'Puan 1 ile 5 arasında olmalı.', 1;
  IF NOT EXISTS (SELECT 1 FROM data.Appointments WHERE Id = @AppointmentId AND CustomerId = @ActorId AND Status = 'completed')
    THROW 50403, N'Yalnızca tamamlanmış randevularınız için yorum yazabilirsiniz.', 1;
  IF EXISTS (SELECT 1 FROM data.Reviews WHERE AppointmentId = @AppointmentId)
    THROW 50409, N'Bu randevu için zaten yorum yazdınız.', 1;

  DECLARE @Out TABLE (Id uniqueidentifier);
  INSERT INTO data.Reviews (ShopId, AppointmentId, CustomerId, StaffId, Rating, Comment)
  OUTPUT inserted.Id INTO @Out
  SELECT ShopId, Id, CustomerId, StaffId, @Rating, NULLIF(LTRIM(RTRIM(@Comment)), N'')
  FROM data.Appointments WHERE Id = @AppointmentId;
  SELECT Id FROM @Out;
END
GO

-- Herkese açık yorumlar (admin kapattıysa boş). İsim: "Ahmet Y."
CREATE OR ALTER PROCEDURE api.Review_List @ShopId uniqueidentifier, @Top int = 50
AS
BEGIN
  SET NOCOUNT ON;
  IF NOT EXISTS (SELECT 1 FROM data.PlatformSettings WHERE ReviewsEnabled = 1) OR data.fn_ShopIsPublic(@ShopId) = 0 RETURN;
  SELECT TOP (CASE WHEN @Top > 100 THEN 100 ELSE @Top END)
         r.Id, r.Rating, r.Comment, r.CreatedAt, u.FirstName + N' ' + LEFT(u.LastName, 1) + N'.' AS CustomerName,
         st.DisplayName AS StaffName
  FROM data.Reviews r
  JOIN data.Users u ON u.Id = r.CustomerId
  LEFT JOIN data.Staff st ON st.Id = r.StaffId
  WHERE r.ShopId = @ShopId AND r.IsHidden = 0
  ORDER BY r.CreatedAt DESC;
END
GO

CREATE OR ALTER PROCEDURE api.Review_Delete @ActorId uniqueidentifier, @ReviewId uniqueidentifier
AS
BEGIN
  SET NOCOUNT ON;
  DELETE FROM data.Reviews WHERE Id = @ReviewId AND CustomerId = @ActorId;
  IF @@ROWCOUNT = 0 THROW 50404, N'Yorum bulunamadı.', 1;
END
GO

-- ---------------------------------------------------------------------
-- Ürünler — dükkân sahibi, personel ve admin yönetir
-- ---------------------------------------------------------------------
CREATE OR ALTER FUNCTION data.fn_CanManageProducts(@ActorId uniqueidentifier, @ShopId uniqueidentifier)
RETURNS bit AS
BEGIN
  RETURN CASE WHEN data.fn_IsShopMember(@ActorId, @ShopId) = 1 OR data.fn_IsAdmin(@ActorId) = 1 THEN 1 ELSE 0 END;
END
GO

-- Admin başka dükkânın ürününde işlem yaparsa kayda geçer
CREATE OR ALTER PROCEDURE data.usp_LogProductAction
  @ActorId uniqueidentifier, @ShopId uniqueidentifier, @Action varchar(40), @ProductId uniqueidentifier
AS
BEGIN
  SET NOCOUNT ON;
  IF data.fn_IsShopMember(@ActorId, @ShopId) = 0 AND data.fn_IsAdmin(@ActorId) = 1
  BEGIN
    DECLARE @EntityId nvarchar(64) = CONVERT(nvarchar(64), @ProductId);
    DECLARE @Details nvarchar(max) = (SELECT @ShopId AS shopId FOR JSON PATH, WITHOUT_ARRAY_WRAPPER);
    EXEC data.usp_Log @ActorId, @Action, 'products', @EntityId, @Details;
  END
END
GO

-- Ürün listesi: satış açıksa herkes aktif ürünleri görür; yöneticiler hepsini görür
CREATE OR ALTER PROCEDURE api.Product_List @ShopId uniqueidentifier, @ActorId uniqueidentifier = NULL
AS
BEGIN
  SET NOCOUNT ON;
  DECLARE @CanManage bit = data.fn_CanManageProducts(@ActorId, @ShopId);
  IF data.fn_StoreEnabledFor(@ShopId) = 0 AND @CanManage = 0 RETURN;
  SELECT p.Id, p.Name, p.Description, p.Price, p.Stock, p.IsActive,
         (SELECT TOP (1) Path FROM data.ProductImages WHERE ProductId = p.Id ORDER BY IsCover DESC, SortOrder) AS CoverImagePath,
         (SELECT COUNT(*) FROM data.ProductImages WHERE ProductId = p.Id) AS ImageCount
  FROM data.Products p
  WHERE p.ShopId = @ShopId AND (p.IsActive = 1 OR @CanManage = 1)
  ORDER BY p.Name;
END
GO

-- Bir ürünün tüm fotoğrafları (vitrin fotoğrafı ilk sırada)
CREATE OR ALTER PROCEDURE api.Product_Images @ProductId uniqueidentifier, @ActorId uniqueidentifier = NULL
AS
BEGIN
  SET NOCOUNT ON;
  DECLARE @ShopId uniqueidentifier, @IsActive bit;
  SELECT @ShopId = ShopId, @IsActive = IsActive FROM data.Products WHERE Id = @ProductId;
  IF @ShopId IS NULL RETURN;
  IF data.fn_CanManageProducts(@ActorId, @ShopId) = 0 AND (data.fn_StoreEnabledFor(@ShopId) = 0 OR @IsActive = 0) RETURN;
  SELECT Id, Path, IsCover, SortOrder FROM data.ProductImages WHERE ProductId = @ProductId ORDER BY IsCover DESC, SortOrder, CreatedAt;
END
GO

CREATE OR ALTER PROCEDURE api.Product_Save
  @ActorId uniqueidentifier, @ShopId uniqueidentifier, @ProductId uniqueidentifier = NULL,
  @Name nvarchar(100), @Description nvarchar(1000) = NULL, @Price decimal(10, 2), @Stock int, @IsActive bit = 1
AS
BEGIN
  SET NOCOUNT ON; SET XACT_ABORT ON;
  IF data.fn_CanManageProducts(@ActorId, @ShopId) = 0 THROW 50403, N'Bu işlem için yetkiniz yok.', 1;
  DECLARE @Out TABLE (Id uniqueidentifier);
  BEGIN TRAN;
    IF @ProductId IS NULL
    BEGIN
      IF (SELECT COUNT(*) FROM data.Products WHERE ShopId = @ShopId) >= 200
        THROW 50409, N'Bir dükkâna en fazla 200 ürün eklenebilir.', 1;
      INSERT INTO data.Products (ShopId, Name, Description, Price, Stock, IsActive, UpdatedBy)
      OUTPUT inserted.Id INTO @Out
      VALUES (@ShopId, LTRIM(RTRIM(@Name)), @Description, @Price, @Stock, @IsActive, @ActorId);
      SET @ProductId = (SELECT Id FROM @Out);
    END
    ELSE
    BEGIN
      UPDATE data.Products
      SET Name = LTRIM(RTRIM(@Name)), Description = @Description, Price = @Price, Stock = @Stock, IsActive = @IsActive, UpdatedBy = @ActorId
      WHERE Id = @ProductId AND ShopId = @ShopId;
      IF @@ROWCOUNT = 0 THROW 50404, N'Ürün bulunamadı.', 1;
    END
    EXEC data.usp_LogProductAction @ActorId, @ShopId, 'product_save', @ProductId;
  COMMIT;
  SELECT @ProductId AS Id;
END
GO

-- Siparişte kullanılmışsa silinmez, satıştan kaldırılır
CREATE OR ALTER PROCEDURE api.Product_Delete @ActorId uniqueidentifier, @ProductId uniqueidentifier
AS
BEGIN
  SET NOCOUNT ON; SET XACT_ABORT ON;
  DECLARE @ShopId uniqueidentifier = (SELECT ShopId FROM data.Products WHERE Id = @ProductId);
  IF @ShopId IS NULL OR data.fn_CanManageProducts(@ActorId, @ShopId) = 0 THROW 50403, N'Bu işlem için yetkiniz yok.', 1;
  BEGIN TRAN;
    EXEC data.usp_LogProductAction @ActorId, @ShopId, 'product_delete', @ProductId;
    IF EXISTS (SELECT 1 FROM data.OrderItems WHERE ProductId = @ProductId)
      UPDATE data.Products SET IsActive = 0, UpdatedBy = @ActorId WHERE Id = @ProductId;
    ELSE
      DELETE FROM data.Products WHERE Id = @ProductId;
  COMMIT;
END
GO

-- Fotoğraf ekle (en fazla 8). İlk fotoğraf veya @MakeCover = 1 ise vitrin fotoğrafı olur.
CREATE OR ALTER PROCEDURE api.Product_AddImage
  @ActorId uniqueidentifier, @ProductId uniqueidentifier, @Path nvarchar(300), @MakeCover bit = 0
AS
BEGIN
  SET NOCOUNT ON; SET XACT_ABORT ON;
  DECLARE @ShopId uniqueidentifier = (SELECT ShopId FROM data.Products WHERE Id = @ProductId);
  IF @ShopId IS NULL OR data.fn_CanManageProducts(@ActorId, @ShopId) = 0 THROW 50403, N'Bu işlem için yetkiniz yok.', 1;
  IF NULLIF(LTRIM(RTRIM(@Path)), N'') IS NULL THROW 50400, N'Fotoğraf yolu boş olamaz.', 1;
  DECLARE @Out TABLE (Id uniqueidentifier);
  BEGIN TRAN;
    DECLARE @Count int = (SELECT COUNT(*) FROM data.ProductImages WITH (UPDLOCK, HOLDLOCK) WHERE ProductId = @ProductId);
    IF @Count >= 8 THROW 50409, N'Bir ürüne en fazla 8 fotoğraf eklenebilir.', 1;
    IF @Count = 0 SET @MakeCover = 1;
    IF @MakeCover = 1 UPDATE data.ProductImages SET IsCover = 0 WHERE ProductId = @ProductId AND IsCover = 1;
    INSERT INTO data.ProductImages (ProductId, Path, IsCover, SortOrder, UploadedBy)
    OUTPUT inserted.Id INTO @Out
    VALUES (@ProductId, @Path, @MakeCover, @Count, @ActorId);
    DECLARE @NewId uniqueidentifier = (SELECT Id FROM @Out);
    EXEC data.usp_LogProductAction @ActorId, @ShopId, 'product_image_add', @ProductId;
  COMMIT;
  SELECT @NewId AS Id;
END
GO

-- Vitrin fotoğrafını seç
CREATE OR ALTER PROCEDURE api.Product_SetCoverImage @ActorId uniqueidentifier, @ImageId uniqueidentifier
AS
BEGIN
  SET NOCOUNT ON; SET XACT_ABORT ON;
  DECLARE @ProductId uniqueidentifier, @ShopId uniqueidentifier;
  SELECT @ProductId = i.ProductId, @ShopId = p.ShopId
  FROM data.ProductImages i JOIN data.Products p ON p.Id = i.ProductId WHERE i.Id = @ImageId;
  IF @ShopId IS NULL OR data.fn_CanManageProducts(@ActorId, @ShopId) = 0 THROW 50403, N'Bu işlem için yetkiniz yok.', 1;
  BEGIN TRAN;
    UPDATE data.ProductImages SET IsCover = 0 WHERE ProductId = @ProductId AND IsCover = 1;
    UPDATE data.ProductImages SET IsCover = 1 WHERE Id = @ImageId;
    EXEC data.usp_LogProductAction @ActorId, @ShopId, 'product_image_cover', @ProductId;
  COMMIT;
END
GO

-- Fotoğraf sil. Vitrin fotoğrafı silinirse sıradaki fotoğraf vitrin olur.
-- Silinen dosyanın yolu döner (site dosyayı diskten de siler).
CREATE OR ALTER PROCEDURE api.Product_RemoveImage @ActorId uniqueidentifier, @ImageId uniqueidentifier
AS
BEGIN
  SET NOCOUNT ON; SET XACT_ABORT ON;
  DECLARE @ProductId uniqueidentifier, @ShopId uniqueidentifier, @Path nvarchar(300), @WasCover bit;
  SELECT @ProductId = i.ProductId, @ShopId = p.ShopId, @Path = i.Path, @WasCover = i.IsCover
  FROM data.ProductImages i JOIN data.Products p ON p.Id = i.ProductId WHERE i.Id = @ImageId;
  IF @ShopId IS NULL OR data.fn_CanManageProducts(@ActorId, @ShopId) = 0 THROW 50403, N'Bu işlem için yetkiniz yok.', 1;
  BEGIN TRAN;
    DELETE FROM data.ProductImages WHERE Id = @ImageId;
    IF @WasCover = 1
      UPDATE data.ProductImages SET IsCover = 1
      WHERE Id = (SELECT TOP (1) Id FROM data.ProductImages WHERE ProductId = @ProductId ORDER BY SortOrder, CreatedAt);
    EXEC data.usp_LogProductAction @ActorId, @ShopId, 'product_image_remove', @ProductId;
  COMMIT;
  SELECT @Path AS Path;
END
GO

-- Admin: tüm dükkânların ürünleri
CREATE OR ALTER PROCEDURE api.Admin_Product_List @ActorId uniqueidentifier, @ShopId uniqueidentifier = NULL, @Search nvarchar(100) = NULL
AS
BEGIN
  SET NOCOUNT ON;
  EXEC data.usp_RequireAdmin @ActorId;
  SELECT TOP (500) p.Id, p.Name, p.Price, p.Stock, p.IsActive, s.Id AS ShopId, s.Code, s.Name AS ShopName,
         (SELECT TOP (1) Path FROM data.ProductImages WHERE ProductId = p.Id ORDER BY IsCover DESC, SortOrder) AS CoverImagePath
  FROM data.Products p JOIN data.Shops s ON s.Id = p.ShopId
  WHERE (@ShopId IS NULL OR p.ShopId = @ShopId) AND (@Search IS NULL OR p.Name LIKE N'%' + @Search + N'%')
  ORDER BY p.CreatedAt DESC;
END
GO

-- ---------------------------------------------------------------------
-- Sipariş bildirimleri
--   new / customer_cancelled → dükkân sahibine ve hesabı bağlı personele
--   ready / shop_cancelled   → müşteriye
-- ---------------------------------------------------------------------
CREATE OR ALTER PROCEDURE data.usp_NotifyOrder @OrderId uniqueidentifier, @Event varchar(20)
AS
BEGIN
  SET NOCOUNT ON;
  DECLARE @ShopId uniqueidentifier, @CustomerId uniqueidentifier, @ShopName nvarchar(100), @Customer nvarchar(130), @Items nvarchar(300), @Total decimal(10, 2);
  SELECT @ShopId = o.ShopId, @CustomerId = o.CustomerId, @ShopName = s.Name, @Total = o.Total,
         @Customer = u.FirstName + N' ' + u.LastName,
         @Items = (SELECT STRING_AGG(CONCAT(i.Quantity, N' x ', i.Name), N', ') FROM data.OrderItems i WHERE i.OrderId = o.Id)
  FROM data.Orders o JOIN data.Shops s ON s.Id = o.ShopId JOIN data.Users u ON u.Id = o.CustomerId
  WHERE o.Id = @OrderId;
  IF @ShopId IS NULL RETURN;
  DECLARE @PanelUrl nvarchar(300) = N'/panel/' + CONVERT(nvarchar(36), @ShopId) + N'/magaza';
  DECLARE @Price nvarchar(20) = FORMAT(@Total, N'N0', 'tr-TR') + N' ₺';

  IF @Event IN ('new', 'customer_cancelled')
  BEGIN
    DECLARE @T nvarchar(80) = CASE @Event WHEN 'new' THEN N'Yeni sipariş: ' + @Customer ELSE N'Sipariş iptal edildi' END;
    DECLARE @B nvarchar(300) = CASE @Event WHEN 'new' THEN @Items + N' · ' + @Price + N'. Hazırlayınca "Hazır" deyin.'
                                          ELSE @Customer + N' siparişini iptal etti: ' + @Items END;
    DECLARE @U uniqueidentifier;
    DECLARE c CURSOR LOCAL FAST_FORWARD FOR
      SELECT OwnerId FROM data.Shops WHERE Id = @ShopId AND OwnerId <> data.fn_SystemUserId()
      UNION SELECT UserId FROM data.Staff WHERE ShopId = @ShopId AND IsActive = 1 AND UserId IS NOT NULL;
    OPEN c; FETCH NEXT FROM c INTO @U;
    WHILE @@FETCH_STATUS = 0
    BEGIN
      EXEC data.usp_Enqueue @U, 'order_new', @T, @B, @PanelUrl;
      FETCH NEXT FROM c INTO @U;
    END
    CLOSE c; DEALLOCATE c;
  END
  ELSE IF @Event = 'ready'
  BEGIN
    DECLARE @BodyReady nvarchar(300) = @Items + N' · ' + @Price + N'. Dükkâna gelince ödeyip alabilirsiniz.';
    DECLARE @TitleReady nvarchar(80) = LEFT(N'Siparişin hazır – ' + @ShopName, 80);
    EXEC data.usp_Enqueue @CustomerId, 'order_ready', @TitleReady, @BodyReady, N'/siparislerim';
  END
  ELSE IF @Event = 'shop_cancelled'
  BEGIN
    DECLARE @BodyCancel nvarchar(300) = @Items + N'. Bilgi için dükkânı arayabilirsiniz.';
    DECLARE @TitleCancel nvarchar(80) = LEFT(@ShopName + N' siparişini iptal etti', 80);
    EXEC data.usp_Enqueue @CustomerId, 'order_cancelled', @TitleCancel, @BodyCancel, N'/siparislerim';
  END
END
GO

-- ---------------------------------------------------------------------
-- Sipariş (online sipariş, salonda ödeme)
-- @ItemsJson: [{"productId":"guid","quantity":2}, ...]
-- ---------------------------------------------------------------------
CREATE OR ALTER PROCEDURE api.Order_Place
  @ActorId uniqueidentifier, @ShopId uniqueidentifier, @ItemsJson nvarchar(max), @Note nvarchar(500) = NULL
AS
BEGIN
  SET NOCOUNT ON; SET XACT_ABORT ON;
  EXEC data.usp_RequireUser @ActorId;
  IF data.fn_StoreEnabledFor(@ShopId) = 0 THROW 50409, N'Bu dükkânda ürün satışı kapalı.', 1;
  IF ISJSON(@ItemsJson) = 0 THROW 50400, N'Sepet geçersiz.', 1;

  DECLARE @Items TABLE (ProductId uniqueidentifier PRIMARY KEY, Quantity int);
  INSERT INTO @Items
  SELECT TRY_CONVERT(uniqueidentifier, ProductId), SUM(Quantity)
  FROM OPENJSON(@ItemsJson) WITH (ProductId nvarchar(40) '$.productId', Quantity int '$.quantity')
  GROUP BY TRY_CONVERT(uniqueidentifier, ProductId);
  IF EXISTS (SELECT 1 FROM @Items WHERE ProductId IS NULL) THROW 50400, N'Sepet geçersiz.', 1;
  IF (SELECT COUNT(*) FROM @Items) NOT BETWEEN 1 AND 20 THROW 50400, N'Sepet geçersiz.', 1;
  IF EXISTS (SELECT 1 FROM @Items WHERE Quantity IS NULL OR Quantity NOT BETWEEN 1 AND 20)
    THROW 50400, N'Adet 1 ile 20 arasında olmalı.', 1;
  IF (SELECT COUNT(*) FROM data.Orders WHERE CustomerId = @ActorId AND Status IN ('pending', 'ready')) >= 5
    THROW 50409, N'Teslim alınmamış en fazla 5 siparişiniz olabilir.', 1;

  DECLARE @Out TABLE (Id uniqueidentifier);
  BEGIN TRAN;
    -- Ürünleri kilitle ve kontrol et
    DECLARE @Found int = (SELECT COUNT(*) FROM data.Products p WITH (UPDLOCK, HOLDLOCK)
                          JOIN @Items i ON i.ProductId = p.Id
                          WHERE p.ShopId = @ShopId AND p.IsActive = 1);
    IF @Found <> (SELECT COUNT(*) FROM @Items) THROW 50404, N'Ürün bulunamadı.', 1;
    DECLARE @Short nvarchar(100) = (SELECT TOP (1) p.Name FROM data.Products p JOIN @Items i ON i.ProductId = p.Id
                                    WHERE p.Stock < i.Quantity);
    IF @Short IS NOT NULL
    BEGIN
      DECLARE @Msg nvarchar(200) = N'"' + @Short + N'" için yeterli stok yok.';
      THROW 50409, @Msg, 1;
    END

    INSERT INTO data.Orders (ShopId, CustomerId, Note, Total)
    OUTPUT inserted.Id INTO @Out
    SELECT @ShopId, @ActorId, LEFT(@Note, 500), SUM(p.Price * i.Quantity)
    FROM data.Products p JOIN @Items i ON i.ProductId = p.Id;

    INSERT INTO data.OrderItems (OrderId, ProductId, Name, UnitPrice, Quantity)
    SELECT (SELECT Id FROM @Out), p.Id, p.Name, p.Price, i.Quantity
    FROM data.Products p JOIN @Items i ON i.ProductId = p.Id;

    UPDATE p SET Stock = p.Stock - i.Quantity
    FROM data.Products p JOIN @Items i ON i.ProductId = p.Id;
    DECLARE @NewOrderId uniqueidentifier = (SELECT Id FROM @Out);
    EXEC data.usp_NotifyOrder @NewOrderId, 'new';
  COMMIT;
  SELECT Id FROM @Out;
END
GO

-- Sahip/personel: pending → ready | cancelled ; ready → picked_up | cancelled
-- Müşteri: bekleyen siparişini iptal edebilir. İptalde stok geri eklenir.
CREATE OR ALTER PROCEDURE api.Order_SetStatus @ActorId uniqueidentifier, @OrderId uniqueidentifier, @Status varchar(10)
AS
BEGIN
  SET NOCOUNT ON; SET XACT_ABORT ON;
  DECLARE @ShopId uniqueidentifier, @CustomerId uniqueidentifier, @Current varchar(10);
  BEGIN TRAN;
    SELECT @ShopId = ShopId, @CustomerId = CustomerId, @Current = Status
    FROM data.Orders WITH (UPDLOCK, ROWLOCK) WHERE Id = @OrderId;
    IF @ShopId IS NULL THROW 50404, N'Sipariş bulunamadı.', 1;

    DECLARE @ByShop bit = data.fn_CanWorkShop(@ActorId, @ShopId);   -- sahip, personel veya admin
    IF @ByShop = 1 AND @CustomerId <> @ActorId
    BEGIN
      IF NOT ((@Current = 'pending' AND @Status IN ('ready', 'cancelled'))
           OR (@Current = 'ready' AND @Status IN ('picked_up', 'cancelled')))
        THROW 50409, N'Bu durum değişikliği yapılamaz.', 1;
    END
    ELSE IF @CustomerId = @ActorId
    BEGIN
      IF @Status <> 'cancelled' OR @Current <> 'pending' THROW 50409, N'Bu durum değişikliği yapılamaz.', 1;
    END
    ELSE
      THROW 50403, N'Bu işlem için yetkiniz yok.', 1;

    IF @Status = 'cancelled'
      UPDATE p SET Stock = p.Stock + i.Quantity
      FROM data.Products p JOIN data.OrderItems i ON i.ProductId = p.Id
      WHERE i.OrderId = @OrderId;
    UPDATE data.Orders SET Status = @Status, UpdatedAt = SYSUTCDATETIME() WHERE Id = @OrderId;
    IF @Status = 'ready' EXEC data.usp_NotifyOrder @OrderId, 'ready';
    DECLARE @Ev varchar(20) = CASE WHEN @ByShop = 1 AND @CustomerId <> @ActorId THEN 'shop_cancelled' ELSE 'customer_cancelled' END;
    IF @Status = 'cancelled' EXEC data.usp_NotifyOrder @OrderId, @Ev;
  COMMIT;
END
GO

CREATE OR ALTER PROCEDURE api.Order_ListMine @ActorId uniqueidentifier
AS
BEGIN
  SET NOCOUNT ON;
  SELECT o.Id, o.Status, o.Total, o.Note, data.fn_ToIstanbul(o.CreatedAt) AS CreatedAtLocal,
         s.Id AS ShopId, s.Name AS ShopName, s.Phone AS ShopPhone,
         N'/' + s.Segment + N'/' + p.Slug + N'/' + d.Slug + N'/' + s.Slug AS ShopUrl,
         (SELECT STRING_AGG(CONCAT(Quantity, N' x ', Name), N', ') FROM data.OrderItems WHERE OrderId = o.Id) AS Items
  FROM data.Orders o JOIN data.Shops s ON s.Id = o.ShopId
  JOIN data.Provinces p ON p.Id = s.ProvinceId JOIN data.Districts d ON d.Id = s.DistrictId
  WHERE o.CustomerId = @ActorId
  ORDER BY o.CreatedAt DESC;
END
GO

CREATE OR ALTER PROCEDURE api.Order_ListForShop @ActorId uniqueidentifier, @ShopId uniqueidentifier, @Status varchar(10) = NULL
AS
BEGIN
  SET NOCOUNT ON;
  IF data.fn_IsShopMember(@ActorId, @ShopId) = 0 AND data.fn_IsAdmin(@ActorId) = 0
    THROW 50403, N'Bu işlem için yetkiniz yok.', 1;
  SELECT o.Id, o.Status, o.Total, o.Note, data.fn_ToIstanbul(o.CreatedAt) AS CreatedAtLocal,
         u.FirstName + N' ' + u.LastName AS CustomerName, u.Phone AS CustomerPhone,
         (SELECT STRING_AGG(CONCAT(Quantity, N' x ', Name), N', ') FROM data.OrderItems WHERE OrderId = o.Id) AS Items
  FROM data.Orders o JOIN data.Users u ON u.Id = o.CustomerId
  WHERE o.ShopId = @ShopId AND (@Status IS NULL OR o.Status = @Status)
  ORDER BY o.CreatedAt DESC;
END
GO
