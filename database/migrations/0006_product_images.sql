-- =====================================================================
-- Bermatik — Ürün fotoğrafları
-- Bir ürüne en fazla 8 fotoğraf; biri vitrin (kapak) fotoğrafıdır.
-- Fotoğrafı dükkân sahibi, personel veya admin ekler.
-- (Eski tek fotoğraf alanı Products.ImagePath kaldırılır.)
-- =====================================================================

CREATE TABLE data.ProductImages (
  Id uniqueidentifier NOT NULL CONSTRAINT PK_ProductImages PRIMARY KEY CONSTRAINT DF_ProductImages_Id DEFAULT NEWSEQUENTIALID(),
  ProductId uniqueidentifier NOT NULL CONSTRAINT FK_ProductImages_Product REFERENCES data.Products (Id) ON DELETE CASCADE,
  Path nvarchar(300) NOT NULL,
  IsCover bit NOT NULL CONSTRAINT DF_ProductImages_IsCover DEFAULT 0,
  SortOrder int NOT NULL CONSTRAINT DF_ProductImages_Sort DEFAULT 0,
  UploadedBy uniqueidentifier NULL CONSTRAINT FK_ProductImages_User REFERENCES data.Users (Id),
  CreatedAt datetime2(0) NOT NULL CONSTRAINT DF_ProductImages_CreatedAt DEFAULT SYSUTCDATETIME()
);
CREATE INDEX IX_ProductImages_Product ON data.ProductImages (ProductId, SortOrder);
-- Her ürünün en fazla bir vitrin fotoğrafı olur
CREATE UNIQUE INDEX UX_ProductImages_Cover ON data.ProductImages (ProductId) WHERE IsCover = 1;

-- Eski alandaki fotoğraflar yeni tabloya taşınır
INSERT INTO data.ProductImages (ProductId, Path, IsCover)
SELECT Id, ImagePath, 1 FROM data.Products WHERE ImagePath IS NOT NULL;
GO

ALTER TABLE data.Products DROP COLUMN ImagePath;
