-- =====================================================================
-- Bermatik — Tablolar (Microsoft SQL Server)
--   data şeması: tablolar (site doğrudan erişemez)
--   api  şeması: sitenin çağırabildiği işlemler (procedures klasörü)
-- Tüm saatler UTC saklanır; Türkiye saatine işlemlerde çevrilir.
-- =====================================================================

CREATE SCHEMA data;
GO
CREATE SCHEMA api;
GO

-- ---------------------------------------------------------------------
-- Platform ayarları (tek satır) — admin açar/kapatır
-- ---------------------------------------------------------------------
CREATE TABLE data.PlatformSettings (
  Id tinyint NOT NULL CONSTRAINT PK_PlatformSettings PRIMARY KEY CONSTRAINT DF_PlatformSettings_Id DEFAULT 1
    CONSTRAINT CK_PlatformSettings_Single CHECK (Id = 1),
  ReviewsEnabled bit NOT NULL CONSTRAINT DF_PlatformSettings_Reviews DEFAULT 1,             -- müşteri yorumları
  StoreEnabled bit NOT NULL CONSTRAINT DF_PlatformSettings_Store DEFAULT 0,                 -- ürün satışı
  ServiceDescriptionsEnabled bit NOT NULL CONSTRAINT DF_PlatformSettings_Desc DEFAULT 1,    -- hizmet açıklamaları
  UpdatedAt datetime2(0) NOT NULL CONSTRAINT DF_PlatformSettings_UpdatedAt DEFAULT SYSUTCDATETIME(),
  UpdatedBy uniqueidentifier NULL
);

-- ---------------------------------------------------------------------
-- Türkiye adres yapısı: İl → İlçe → Mahalle (İl Id = plaka kodu)
-- ---------------------------------------------------------------------
CREATE TABLE data.Provinces (
  Id tinyint NOT NULL CONSTRAINT PK_Provinces PRIMARY KEY CONSTRAINT CK_Provinces_Id CHECK (Id BETWEEN 1 AND 81),
  Name nvarchar(40) NOT NULL CONSTRAINT UQ_Provinces_Name UNIQUE,
  Slug varchar(40) NOT NULL CONSTRAINT UQ_Provinces_Slug UNIQUE      -- Google için sayfa adresi: /erkek/istanbul
);

CREATE TABLE data.Districts (
  Id int NOT NULL CONSTRAINT PK_Districts PRIMARY KEY,
  ProvinceId tinyint NOT NULL CONSTRAINT FK_Districts_Province REFERENCES data.Provinces (Id),
  Name nvarchar(60) NOT NULL,
  Slug varchar(60) NOT NULL,                                          -- /erkek/istanbul/kadikoy
  CONSTRAINT UQ_Districts_Name UNIQUE (ProvinceId, Name),
  CONSTRAINT UQ_Districts_Slug UNIQUE (ProvinceId, Slug)
);

CREATE TABLE data.Neighborhoods (
  Id int NOT NULL CONSTRAINT PK_Neighborhoods PRIMARY KEY,
  DistrictId int NOT NULL CONSTRAINT FK_Neighborhoods_District REFERENCES data.Districts (Id),
  Name nvarchar(200) NOT NULL,
  CONSTRAINT UQ_Neighborhoods_Name UNIQUE (DistrictId, Name)
);

-- ---------------------------------------------------------------------
-- Kullanıcılar ve oturumlar
-- Şifre sitede argon2 ile özetlenir; burada yalnızca özet saklanır.
-- ---------------------------------------------------------------------
CREATE TABLE data.Users (
  Id uniqueidentifier NOT NULL CONSTRAINT PK_Users PRIMARY KEY CONSTRAINT DF_Users_Id DEFAULT NEWSEQUENTIALID(),
  -- E-postada Türkçe kurallar kullanılmaz (yoksa "ADMIN" küçültülünce "admın" olur)
  Email nvarchar(254) COLLATE Latin1_General_CI_AS NOT NULL CONSTRAINT UQ_Users_Email UNIQUE,
  PasswordHash nvarchar(255) NOT NULL,
  Role varchar(12) NOT NULL CONSTRAINT DF_Users_Role DEFAULT 'customer'
    CONSTRAINT CK_Users_Role CHECK (Role IN ('customer', 'shop_owner', 'staff', 'admin')),
  FirstName nvarchar(60) NOT NULL CONSTRAINT CK_Users_FirstName CHECK (LEN(FirstName) >= 1),
  LastName nvarchar(60) NOT NULL CONSTRAINT CK_Users_LastName CHECK (LEN(LastName) >= 1),
  BirthYear smallint NULL CONSTRAINT CK_Users_BirthYear CHECK (BirthYear BETWEEN 1900 AND 2100),
  Phone varchar(16) NULL CONSTRAINT CK_Users_Phone CHECK (Phone NOT LIKE '%[^0-9+]%' AND LEN(Phone) BETWEEN 10 AND 16),
  IsActive bit NOT NULL CONSTRAINT DF_Users_IsActive DEFAULT 1,           -- admin engelleyebilir
  FailedLoginCount tinyint NOT NULL CONSTRAINT DF_Users_Failed DEFAULT 0,
  LockedUntil datetime2(0) NULL,                                          -- art arda hatalı girişte kilit
  TotpSecret nvarchar(64) NULL,                                           -- iki adımlı doğrulama
  TotpEnabled bit NOT NULL CONSTRAINT DF_Users_Totp DEFAULT 0,
  CreatedAt datetime2(0) NOT NULL CONSTRAINT DF_Users_CreatedAt DEFAULT SYSUTCDATETIME(),
  UpdatedAt datetime2(0) NOT NULL CONSTRAINT DF_Users_UpdatedAt DEFAULT SYSUTCDATETIME()
);

CREATE TABLE data.Sessions (
  TokenHash binary(32) NOT NULL CONSTRAINT PK_Sessions PRIMARY KEY,      -- çerezdeki anahtarın SHA-256 özeti
  UserId uniqueidentifier NOT NULL CONSTRAINT FK_Sessions_User REFERENCES data.Users (Id) ON DELETE CASCADE,
  ExpiresAt datetime2(0) NOT NULL,
  CreatedAt datetime2(0) NOT NULL CONSTRAINT DF_Sessions_CreatedAt DEFAULT SYSUTCDATETIME(),
  LastSeenAt datetime2(0) NOT NULL CONSTRAINT DF_Sessions_LastSeen DEFAULT SYSUTCDATETIME(),
  IpAddress varchar(45) NULL,
  UserAgent nvarchar(300) NULL
);
CREATE INDEX IX_Sessions_User ON data.Sessions (UserId);

-- ---------------------------------------------------------------------
-- Dükkânlar. Kod otomatik verilir: erkek BRM-E-0001, kadın BRM-K-0001
-- ---------------------------------------------------------------------
CREATE SEQUENCE data.ShopCodeErkek AS int START WITH 1;
CREATE SEQUENCE data.ShopCodeKadin AS int START WITH 1;

CREATE TABLE data.Shops (
  Id uniqueidentifier NOT NULL CONSTRAINT PK_Shops PRIMARY KEY CONSTRAINT DF_Shops_Id DEFAULT NEWSEQUENTIALID(),
  Code varchar(12) NOT NULL CONSTRAINT UQ_Shops_Code UNIQUE,
  OwnerId uniqueidentifier NOT NULL CONSTRAINT FK_Shops_Owner REFERENCES data.Users (Id),
  Segment varchar(5) NOT NULL CONSTRAINT CK_Shops_Segment CHECK (Segment IN ('erkek', 'kadin')),
  Name nvarchar(100) NOT NULL CONSTRAINT CK_Shops_Name CHECK (LEN(Name) >= 2),
  Slug varchar(120) NOT NULL,                     -- /erkek/istanbul/kadikoy/ahmet-usta-berber
  Description nvarchar(2000) NULL,
  Phone varchar(16) NOT NULL CONSTRAINT CK_Shops_Phone CHECK (Phone NOT LIKE '%[^0-9+]%' AND LEN(Phone) BETWEEN 10 AND 16),
  ProvinceId tinyint NOT NULL CONSTRAINT FK_Shops_Province REFERENCES data.Provinces (Id),
  DistrictId int NOT NULL CONSTRAINT FK_Shops_District REFERENCES data.Districts (Id),
  NeighborhoodId int NOT NULL CONSTRAINT FK_Shops_Neighborhood REFERENCES data.Neighborhoods (Id),
  Street nvarchar(120) NOT NULL CONSTRAINT CK_Shops_Street CHECK (LEN(Street) >= 2),        -- Cadde / Sokak
  BuildingNo nvarchar(20) NOT NULL CONSTRAINT CK_Shops_BuildingNo CHECK (LEN(BuildingNo) >= 1),
  AddressDetail nvarchar(200) NULL,                                                         -- kat, daire, tarif
  Latitude decimal(9, 6) NOT NULL CONSTRAINT CK_Shops_Lat CHECK (Latitude BETWEEN 35.5 AND 42.5),   -- Türkiye sınırları
  Longitude decimal(9, 6) NOT NULL CONSTRAINT CK_Shops_Lng CHECK (Longitude BETWEEN 25.5 AND 45.0),
  Status varchar(10) NOT NULL CONSTRAINT DF_Shops_Status DEFAULT 'pending'
    CONSTRAINT CK_Shops_Status CHECK (Status IN ('pending', 'approved', 'suspended', 'rejected')),
  StatusReason nvarchar(300) NULL,
  IsTemporarilyClosed bit NOT NULL CONSTRAINT DF_Shops_TempClosed DEFAULT 0,
  ShowServiceDescriptions bit NOT NULL CONSTRAINT DF_Shops_ShowDesc DEFAULT 1,
  StoreEnabled bit NOT NULL CONSTRAINT DF_Shops_Store DEFAULT 0,
  QueueAvgMinutes smallint NOT NULL CONSTRAINT DF_Shops_QueueAvg DEFAULT 20
    CONSTRAINT CK_Shops_QueueAvg CHECK (QueueAvgMinutes BETWEEN 5 AND 180),
  CoverImagePath nvarchar(300) NULL,
  CreatedAt datetime2(0) NOT NULL CONSTRAINT DF_Shops_CreatedAt DEFAULT SYSUTCDATETIME(),
  UpdatedAt datetime2(0) NOT NULL CONSTRAINT DF_Shops_UpdatedAt DEFAULT SYSUTCDATETIME()
);
CREATE INDEX IX_Shops_Search ON data.Shops (Segment, Status, ProvinceId, DistrictId);
CREATE INDEX IX_Shops_Location ON data.Shops (Segment, Status, Latitude, Longitude);
CREATE INDEX IX_Shops_Owner ON data.Shops (OwnerId);
CREATE UNIQUE INDEX UX_Shops_Slug ON data.Shops (DistrictId, Slug);

-- Çalışma saatleri (Weekday: 1 = Pazartesi … 7 = Pazar), Türkiye saati
CREATE TABLE data.ShopHours (
  ShopId uniqueidentifier NOT NULL CONSTRAINT FK_ShopHours_Shop REFERENCES data.Shops (Id) ON DELETE CASCADE,
  Weekday tinyint NOT NULL CONSTRAINT CK_ShopHours_Weekday CHECK (Weekday BETWEEN 1 AND 7),
  IsClosed bit NOT NULL CONSTRAINT DF_ShopHours_IsClosed DEFAULT 0,
  OpensAt time(0) NULL,
  ClosesAt time(0) NULL,
  CONSTRAINT PK_ShopHours PRIMARY KEY (ShopId, Weekday),
  CONSTRAINT CK_ShopHours_Range CHECK (IsClosed = 1 OR (OpensAt IS NOT NULL AND ClosesAt IS NOT NULL AND OpensAt < ClosesAt))
);

-- ---------------------------------------------------------------------
-- Ustalık / kalfalık belgeleri — admin onaylar
-- ---------------------------------------------------------------------
CREATE TABLE data.Certificates (
  Id uniqueidentifier NOT NULL CONSTRAINT PK_Certificates PRIMARY KEY CONSTRAINT DF_Certificates_Id DEFAULT NEWSEQUENTIALID(),
  UserId uniqueidentifier NOT NULL CONSTRAINT FK_Certificates_User REFERENCES data.Users (Id),
  Type varchar(20) NOT NULL
    CONSTRAINT CK_Certificates_Type CHECK (Type IN ('ciraklik', 'kalfalik', 'ustalik', 'usta_ogreticilik', 'diger')),
  SerialNo nvarchar(50) NOT NULL CONSTRAINT CK_Certificates_Serial CHECK (LEN(SerialNo) >= 3),
  IssuedBy nvarchar(120) NULL,
  FilePath nvarchar(300) NOT NULL,
  Status varchar(10) NOT NULL CONSTRAINT DF_Certificates_Status DEFAULT 'pending'
    CONSTRAINT CK_Certificates_Status CHECK (Status IN ('pending', 'verified', 'rejected')),
  ReviewNote nvarchar(300) NULL,
  ReviewedBy uniqueidentifier NULL CONSTRAINT FK_Certificates_Reviewer REFERENCES data.Users (Id),
  ReviewedAt datetime2(0) NULL,
  CreatedAt datetime2(0) NOT NULL CONSTRAINT DF_Certificates_CreatedAt DEFAULT SYSUTCDATETIME(),
  CONSTRAINT UQ_Certificates_Serial UNIQUE (Type, SerialNo)   -- aynı belge iki kişi tarafından kullanılamaz
);
CREATE INDEX IX_Certificates_User ON data.Certificates (UserId);

-- ---------------------------------------------------------------------
-- Personel — müşteri seçer, personel kabul eder
-- ---------------------------------------------------------------------
CREATE TABLE data.Staff (
  Id uniqueidentifier NOT NULL CONSTRAINT PK_Staff PRIMARY KEY CONSTRAINT DF_Staff_Id DEFAULT NEWSEQUENTIALID(),
  ShopId uniqueidentifier NOT NULL CONSTRAINT FK_Staff_Shop REFERENCES data.Shops (Id),
  UserId uniqueidentifier NULL CONSTRAINT FK_Staff_User REFERENCES data.Users (Id),  -- davet koduyla bağlanır
  DisplayName nvarchar(60) NOT NULL CONSTRAINT CK_Staff_Name CHECK (LEN(DisplayName) >= 2),
  Title nvarchar(60) NULL,
  PhotoPath nvarchar(300) NULL,
  IsActive bit NOT NULL CONSTRAINT DF_Staff_IsActive DEFAULT 1,
  InviteCode char(12) NULL,
  CreatedAt datetime2(0) NOT NULL CONSTRAINT DF_Staff_CreatedAt DEFAULT SYSUTCDATETIME()
);
CREATE INDEX IX_Staff_Shop ON data.Staff (ShopId);
CREATE UNIQUE INDEX UX_Staff_Invite ON data.Staff (InviteCode) WHERE InviteCode IS NOT NULL;
CREATE UNIQUE INDEX UX_Staff_ShopUser ON data.Staff (ShopId, UserId) WHERE UserId IS NOT NULL;

-- ---------------------------------------------------------------------
-- Hizmetler: kategoriler admin'in, fiyat listesi dükkânın
-- ---------------------------------------------------------------------
CREATE TABLE data.ServiceCategories (
  Id int IDENTITY(1, 1) NOT NULL CONSTRAINT PK_ServiceCategories PRIMARY KEY,
  Segment varchar(5) NOT NULL CONSTRAINT CK_ServiceCategories_Segment CHECK (Segment IN ('erkek', 'kadin')),
  Slug varchar(40) NOT NULL CONSTRAINT UQ_ServiceCategories_Slug UNIQUE
    CONSTRAINT CK_ServiceCategories_Slug CHECK (Slug NOT LIKE '%[^a-z0-9-]%'),
  Name nvarchar(60) NOT NULL,
  Description nvarchar(1000) NULL,
  SortOrder int NOT NULL CONSTRAINT DF_ServiceCategories_Sort DEFAULT 0,
  IsActive bit NOT NULL CONSTRAINT DF_ServiceCategories_IsActive DEFAULT 1
);

CREATE TABLE data.ShopServices (
  Id uniqueidentifier NOT NULL CONSTRAINT PK_ShopServices PRIMARY KEY CONSTRAINT DF_ShopServices_Id DEFAULT NEWSEQUENTIALID(),
  ShopId uniqueidentifier NOT NULL CONSTRAINT FK_ShopServices_Shop REFERENCES data.Shops (Id),
  CategoryId int NOT NULL CONSTRAINT FK_ShopServices_Category REFERENCES data.ServiceCategories (Id),
  Name nvarchar(80) NOT NULL CONSTRAINT CK_ShopServices_Name CHECK (LEN(Name) >= 2),
  Description nvarchar(1000) NULL,               -- boşsa kategori açıklaması gösterilir
  Price decimal(10, 2) NOT NULL CONSTRAINT CK_ShopServices_Price CHECK (Price BETWEEN 0 AND 100000),
  DurationMinutes smallint NOT NULL CONSTRAINT CK_ShopServices_Duration CHECK (DurationMinutes BETWEEN 5 AND 600),
  IsActive bit NOT NULL CONSTRAINT DF_ShopServices_IsActive DEFAULT 1,
  SortOrder int NOT NULL CONSTRAINT DF_ShopServices_Sort DEFAULT 0,
  CreatedAt datetime2(0) NOT NULL CONSTRAINT DF_ShopServices_CreatedAt DEFAULT SYSUTCDATETIME()
);
CREATE INDEX IX_ShopServices_Shop ON data.ShopServices (ShopId);

-- ---------------------------------------------------------------------
-- Randevular (çakışma kontrolü api.Appointment_Book içinde, kilitle)
-- ---------------------------------------------------------------------
CREATE TABLE data.Appointments (
  Id uniqueidentifier NOT NULL CONSTRAINT PK_Appointments PRIMARY KEY CONSTRAINT DF_Appointments_Id DEFAULT NEWSEQUENTIALID(),
  ShopId uniqueidentifier NOT NULL CONSTRAINT FK_Appointments_Shop REFERENCES data.Shops (Id),
  StaffId uniqueidentifier NOT NULL CONSTRAINT FK_Appointments_Staff REFERENCES data.Staff (Id),
  CustomerId uniqueidentifier NULL CONSTRAINT FK_Appointments_Customer REFERENCES data.Users (Id), -- telefonla alınanda boş
  CustomerName nvarchar(121) NULL,
  CustomerPhone varchar(16) NULL,
  Source varchar(6) NOT NULL CONSTRAINT DF_Appointments_Source DEFAULT 'online'
    CONSTRAINT CK_Appointments_Source CHECK (Source IN ('online', 'phone')),
  StartsAt datetime2(0) NOT NULL,   -- UTC
  EndsAt datetime2(0) NOT NULL,     -- UTC
  Status varchar(10) NOT NULL CONSTRAINT DF_Appointments_Status DEFAULT 'pending'
    CONSTRAINT CK_Appointments_Status CHECK (Status IN ('pending', 'accepted', 'rejected', 'cancelled', 'completed', 'no_show')),
  TotalPrice decimal(10, 2) NOT NULL CONSTRAINT DF_Appointments_Total DEFAULT 0,
  Note nvarchar(500) NULL,
  RespondedAt datetime2(0) NULL,
  CreatedAt datetime2(0) NOT NULL CONSTRAINT DF_Appointments_CreatedAt DEFAULT SYSUTCDATETIME(),
  UpdatedAt datetime2(0) NOT NULL CONSTRAINT DF_Appointments_UpdatedAt DEFAULT SYSUTCDATETIME(),
  CONSTRAINT CK_Appointments_Range CHECK (EndsAt > StartsAt),
  CONSTRAINT CK_Appointments_Customer CHECK (CustomerId IS NOT NULL OR CustomerName IS NOT NULL)
);
CREATE INDEX IX_Appointments_StaffTime ON data.Appointments (StaffId, StartsAt) INCLUDE (EndsAt, Status);
CREATE INDEX IX_Appointments_ShopTime ON data.Appointments (ShopId, StartsAt);
CREATE INDEX IX_Appointments_Customer ON data.Appointments (CustomerId);

CREATE TABLE data.AppointmentServices (
  AppointmentId uniqueidentifier NOT NULL CONSTRAINT FK_AppointmentServices_Appointment REFERENCES data.Appointments (Id) ON DELETE CASCADE,
  ShopServiceId uniqueidentifier NOT NULL CONSTRAINT FK_AppointmentServices_Service REFERENCES data.ShopServices (Id),
  Name nvarchar(80) NOT NULL,
  Price decimal(10, 2) NOT NULL,
  DurationMinutes smallint NOT NULL,
  CONSTRAINT PK_AppointmentServices PRIMARY KEY (AppointmentId, ShopServiceId)
);

-- ---------------------------------------------------------------------
-- Canlı sıra
-- ---------------------------------------------------------------------
CREATE TABLE data.QueueEntries (
  Id uniqueidentifier NOT NULL CONSTRAINT PK_QueueEntries PRIMARY KEY CONSTRAINT DF_QueueEntries_Id DEFAULT NEWSEQUENTIALID(),
  ShopId uniqueidentifier NOT NULL CONSTRAINT FK_QueueEntries_Shop REFERENCES data.Shops (Id),
  StaffId uniqueidentifier NULL CONSTRAINT FK_QueueEntries_Staff REFERENCES data.Staff (Id),
  CustomerId uniqueidentifier NULL CONSTRAINT FK_QueueEntries_Customer REFERENCES data.Users (Id),
  GuestName nvarchar(60) NULL,
  QueueDate date NOT NULL,          -- Türkiye tarihi
  TicketNo int NOT NULL,
  Status varchar(10) NOT NULL CONSTRAINT DF_QueueEntries_Status DEFAULT 'waiting'
    CONSTRAINT CK_QueueEntries_Status CHECK (Status IN ('waiting', 'serving', 'done', 'cancelled', 'no_show')),
  CreatedAt datetime2(0) NOT NULL CONSTRAINT DF_QueueEntries_CreatedAt DEFAULT SYSUTCDATETIME(),
  CalledAt datetime2(0) NULL,
  FinishedAt datetime2(0) NULL,
  CONSTRAINT UQ_QueueEntries_Ticket UNIQUE (ShopId, QueueDate, TicketNo),
  CONSTRAINT CK_QueueEntries_Who CHECK (CustomerId IS NOT NULL OR GuestName IS NOT NULL)
);
CREATE INDEX IX_QueueEntries_Active ON data.QueueEntries (ShopId, QueueDate, Status) INCLUDE (TicketNo, StaffId);
-- Bir müşteri aynı anda yalnızca bir sırada olabilir
CREATE UNIQUE INDEX UX_QueueEntries_OneActive ON data.QueueEntries (CustomerId)
  WHERE CustomerId IS NOT NULL AND Status IN ('waiting', 'serving');

-- İsim içermeyen özet — herkes görebilir, sayfalar bunu canlı izler
CREATE TABLE data.ShopQueueState (
  ShopId uniqueidentifier NOT NULL CONSTRAINT PK_ShopQueueState PRIMARY KEY
    CONSTRAINT FK_ShopQueueState_Shop REFERENCES data.Shops (Id) ON DELETE CASCADE,
  QueueDate date NOT NULL,
  CurrentTicket int NULL,
  WaitingCount int NOT NULL CONSTRAINT DF_ShopQueueState_Waiting DEFAULT 0,
  Version int NOT NULL CONSTRAINT DF_ShopQueueState_Version DEFAULT 0,   -- her değişiklikte artar
  UpdatedAt datetime2(0) NOT NULL CONSTRAINT DF_ShopQueueState_UpdatedAt DEFAULT SYSUTCDATETIME()
);

-- ---------------------------------------------------------------------
-- Yorumlar — yalnızca tamamlanmış randevusu olan müşteri yazabilir
-- ---------------------------------------------------------------------
CREATE TABLE data.Reviews (
  Id uniqueidentifier NOT NULL CONSTRAINT PK_Reviews PRIMARY KEY CONSTRAINT DF_Reviews_Id DEFAULT NEWSEQUENTIALID(),
  ShopId uniqueidentifier NOT NULL CONSTRAINT FK_Reviews_Shop REFERENCES data.Shops (Id),
  AppointmentId uniqueidentifier NOT NULL CONSTRAINT UQ_Reviews_Appointment UNIQUE
    CONSTRAINT FK_Reviews_Appointment REFERENCES data.Appointments (Id),
  CustomerId uniqueidentifier NOT NULL CONSTRAINT FK_Reviews_Customer REFERENCES data.Users (Id),
  StaffId uniqueidentifier NULL CONSTRAINT FK_Reviews_Staff REFERENCES data.Staff (Id),
  Rating tinyint NOT NULL CONSTRAINT CK_Reviews_Rating CHECK (Rating BETWEEN 1 AND 5),
  Comment nvarchar(1000) NULL,
  IsHidden bit NOT NULL CONSTRAINT DF_Reviews_IsHidden DEFAULT 0,   -- admin gizleyebilir
  CreatedAt datetime2(0) NOT NULL CONSTRAINT DF_Reviews_CreatedAt DEFAULT SYSUTCDATETIME()
);
CREATE INDEX IX_Reviews_Shop ON data.Reviews (ShopId) INCLUDE (Rating, IsHidden);

-- ---------------------------------------------------------------------
-- Ürün satışı — online sipariş, salonda ödeme
-- ---------------------------------------------------------------------
CREATE TABLE data.Products (
  Id uniqueidentifier NOT NULL CONSTRAINT PK_Products PRIMARY KEY CONSTRAINT DF_Products_Id DEFAULT NEWSEQUENTIALID(),
  ShopId uniqueidentifier NOT NULL CONSTRAINT FK_Products_Shop REFERENCES data.Shops (Id),
  Name nvarchar(100) NOT NULL CONSTRAINT CK_Products_Name CHECK (LEN(Name) >= 2),
  Description nvarchar(1000) NULL,
  Price decimal(10, 2) NOT NULL CONSTRAINT CK_Products_Price CHECK (Price BETWEEN 0 AND 100000),
  Stock int NOT NULL CONSTRAINT DF_Products_Stock DEFAULT 0 CONSTRAINT CK_Products_Stock CHECK (Stock >= 0),
  ImagePath nvarchar(300) NULL,
  IsActive bit NOT NULL CONSTRAINT DF_Products_IsActive DEFAULT 1,
  CreatedAt datetime2(0) NOT NULL CONSTRAINT DF_Products_CreatedAt DEFAULT SYSUTCDATETIME()
);
CREATE INDEX IX_Products_Shop ON data.Products (ShopId);

CREATE TABLE data.Orders (
  Id uniqueidentifier NOT NULL CONSTRAINT PK_Orders PRIMARY KEY CONSTRAINT DF_Orders_Id DEFAULT NEWSEQUENTIALID(),
  ShopId uniqueidentifier NOT NULL CONSTRAINT FK_Orders_Shop REFERENCES data.Shops (Id),
  CustomerId uniqueidentifier NOT NULL CONSTRAINT FK_Orders_Customer REFERENCES data.Users (Id),
  Status varchar(10) NOT NULL CONSTRAINT DF_Orders_Status DEFAULT 'pending'
    CONSTRAINT CK_Orders_Status CHECK (Status IN ('pending', 'ready', 'picked_up', 'cancelled')),
  Total decimal(10, 2) NOT NULL CONSTRAINT DF_Orders_Total DEFAULT 0,
  Note nvarchar(500) NULL,
  CreatedAt datetime2(0) NOT NULL CONSTRAINT DF_Orders_CreatedAt DEFAULT SYSUTCDATETIME(),
  UpdatedAt datetime2(0) NOT NULL CONSTRAINT DF_Orders_UpdatedAt DEFAULT SYSUTCDATETIME()
);
CREATE INDEX IX_Orders_Shop ON data.Orders (ShopId, CreatedAt DESC);
CREATE INDEX IX_Orders_Customer ON data.Orders (CustomerId);

CREATE TABLE data.OrderItems (
  OrderId uniqueidentifier NOT NULL CONSTRAINT FK_OrderItems_Order REFERENCES data.Orders (Id) ON DELETE CASCADE,
  ProductId uniqueidentifier NOT NULL CONSTRAINT FK_OrderItems_Product REFERENCES data.Products (Id),
  Name nvarchar(100) NOT NULL,
  UnitPrice decimal(10, 2) NOT NULL,
  Quantity int NOT NULL CONSTRAINT CK_OrderItems_Qty CHECK (Quantity BETWEEN 1 AND 20),
  CONSTRAINT PK_OrderItems PRIMARY KEY (OrderId, ProductId)
);

-- ---------------------------------------------------------------------
-- Admin işlem kayıtları
-- ---------------------------------------------------------------------
CREATE TABLE data.AuditLog (
  Id bigint IDENTITY(1, 1) NOT NULL CONSTRAINT PK_AuditLog PRIMARY KEY,
  ActorId uniqueidentifier NULL,
  Action varchar(40) NOT NULL,
  Entity varchar(40) NOT NULL,
  EntityId nvarchar(64) NULL,
  Details nvarchar(max) NULL CONSTRAINT CK_AuditLog_Json CHECK (Details IS NULL OR ISJSON(Details) = 1),
  CreatedAt datetime2(0) NOT NULL CONSTRAINT DF_AuditLog_CreatedAt DEFAULT SYSUTCDATETIME()
);
CREATE INDEX IX_AuditLog_Created ON data.AuditLog (CreatedAt DESC);
