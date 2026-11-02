-- =====================================================================
-- Bermatik — Kayıt, giriş, oturum, profil
-- Şifre özeti (argon2) ve oturum anahtarı sitede üretilir; veritabanı
-- düz şifreyi ya da düz oturum anahtarını hiçbir zaman görmez.
-- =====================================================================

-- Kayıt kuralları tek yerde: e-posta ve Google kaydı bunu kullanır
CREATE OR ALTER PROCEDURE data.usp_CreateUser
  @Email nvarchar(254), @PasswordHash nvarchar(255), @FirstName nvarchar(60), @LastName nvarchar(60),
  @BirthYear smallint, @Phone nvarchar(40), @KvkkAccepted bit, @KvkkVersion varchar(10),
  @GoogleSub varchar(64), @NewId uniqueidentifier OUTPUT
AS
BEGIN
  SET NOCOUNT ON; SET XACT_ABORT ON;
  IF ISNULL(@KvkkAccepted, 0) = 0
    THROW 50400, N'Kayıt için KVKK aydınlatma metnini onaylamalısınız.', 1;
  SET @Email = LOWER(LTRIM(RTRIM(@Email)) COLLATE Latin1_General_CI_AS);
  IF @Email NOT LIKE '_%@_%._%' OR @Email LIKE '% %'
    THROW 50400, N'Geçerli bir e-posta adresi girin.', 1;
  IF LEN(LTRIM(RTRIM(@FirstName))) = 0 OR LEN(LTRIM(RTRIM(@LastName))) = 0
    THROW 50400, N'Ad ve soyad gerekli.', 1;
  IF @BirthYear IS NOT NULL AND @BirthYear NOT BETWEEN YEAR(GETDATE()) - 100 AND YEAR(GETDATE()) - 13
    THROW 50400, N'Doğum yılı geçersiz.', 1;
  DECLARE @NormPhone varchar(16) = data.fn_NormalizePhone(@Phone);
  IF @NormPhone IS NULL
    THROW 50400, N'Geçerli bir telefon numarası girin.', 1;
  IF EXISTS (SELECT 1 FROM data.Users WHERE Email = @Email)
    THROW 50409, N'Bu e-posta adresiyle zaten bir hesap var.', 1;
  IF EXISTS (SELECT 1 FROM data.Users WHERE Phone = @NormPhone)
    THROW 50409, N'Bu telefon numarasıyla zaten bir hesap var.', 1;

  IF @GoogleSub IS NOT NULL AND EXISTS (SELECT 1 FROM data.Users WHERE GoogleSub = @GoogleSub)
    THROW 50409, N'Bu Google hesabıyla zaten kayıt olunmuş.', 1;

  DECLARE @Out TABLE (Id uniqueidentifier);
  INSERT INTO data.Users (Email, PasswordHash, FirstName, LastName, BirthYear, Phone, KvkkAcceptedAt, KvkkVersion, GoogleSub)
  OUTPUT inserted.Id INTO @Out
  VALUES (@Email, @PasswordHash, LTRIM(RTRIM(@FirstName)), LTRIM(RTRIM(@LastName)), @BirthYear, @NormPhone,
          SYSUTCDATETIME(), @KvkkVersion, @GoogleSub);
  SET @NewId = (SELECT Id FROM @Out);
END
GO

CREATE OR ALTER PROCEDURE api.Auth_Register
  @Email nvarchar(254), @PasswordHash nvarchar(255),
  @FirstName nvarchar(60), @LastName nvarchar(60), @BirthYear smallint = NULL, @Phone nvarchar(40) = NULL,
  @KvkkAccepted bit = 0, @KvkkVersion varchar(10) = '2026-1', @IsBusiness bit = 0
AS
BEGIN
  SET NOCOUNT ON;
  DECLARE @Id uniqueidentifier;
  EXEC data.usp_CreateUser @Email, @PasswordHash, @FirstName, @LastName, @BirthYear, @Phone, @KvkkAccepted, @KvkkVersion, NULL, @Id OUTPUT;
  -- İşletme hesabı (dükkân sahibi veya personel): dükkân ekleyebilir, sahiplenebilir, işletme panelini görür
  IF @IsBusiness = 1 UPDATE data.Users SET Role = 'shop_owner' WHERE Id = @Id;
  SELECT @Id AS Id;
END
GO

-- ---------------------------------------------------------------------
-- Şifremi unuttum
-- 1) Site 6 haneli kod üretir, özetini buraya yazar, kodu e-postayla gönderir.
-- 2) Kullanıcı kodu ve yeni şifreyi girer → api.Auth_ResetPassword.
-- E-posta kayıtlı değilse sessizce hiçbir şey yapılmaz (kimin kayıtlı olduğu sızmasın).
-- ---------------------------------------------------------------------
CREATE OR ALTER PROCEDURE api.Auth_CreatePasswordReset @Email nvarchar(254), @TokenHash binary(32), @ExpiresAt datetime2(0)
AS
BEGIN
  SET NOCOUNT ON;
  DECLARE @UserId uniqueidentifier, @FirstName nvarchar(60);
  SELECT @UserId = Id, @FirstName = FirstName FROM data.Users
  WHERE Email = LOWER(LTRIM(RTRIM(@Email)) COLLATE Latin1_General_CI_AS) AND IsActive = 1;
  IF @UserId IS NULL RETURN;
  -- Kötüye kullanım sınırı: saatte en fazla 3 kod
  IF (SELECT COUNT(*) FROM data.PasswordResetTokens WHERE UserId = @UserId AND CreatedAt > DATEADD(hour, -1, SYSUTCDATETIME())) >= 3
    RETURN;
  UPDATE data.PasswordResetTokens SET UsedAt = SYSUTCDATETIME() WHERE UserId = @UserId AND UsedAt IS NULL;  -- eski kodlar geçersiz
  INSERT INTO data.PasswordResetTokens (TokenHash, UserId, ExpiresAt) VALUES (@TokenHash, @UserId, @ExpiresAt);
  SELECT @UserId AS UserId, @FirstName AS FirstName;   -- site e-postayı yalnızca satır dönerse gönderir
END
GO

CREATE OR ALTER PROCEDURE api.Auth_ResetPassword @Email nvarchar(254), @TokenHash binary(32), @PasswordHash nvarchar(255)
AS
BEGIN
  SET NOCOUNT ON; SET XACT_ABORT ON;
  DECLARE @UserId uniqueidentifier = (SELECT Id FROM data.Users
                                      WHERE Email = LOWER(LTRIM(RTRIM(@Email)) COLLATE Latin1_General_CI_AS) AND IsActive = 1);
  -- Geçerli son kod (her yeni kod öncekileri geçersiz yapar, yani en fazla bir tane vardır)
  DECLARE @Hash binary(32), @Attempts tinyint;
  SELECT TOP (1) @Hash = TokenHash, @Attempts = Attempts FROM data.PasswordResetTokens
  WHERE UserId = @UserId AND UsedAt IS NULL AND ExpiresAt > SYSUTCDATETIME()
  ORDER BY CreatedAt DESC;
  IF @Hash IS NULL THROW 50400, N'Kod geçersiz veya süresi dolmuş.', 1;
  IF @Attempts >= 5 THROW 50409, N'Çok fazla yanlış deneme. Yeni kod isteyin.', 1;
  IF @Hash <> @TokenHash
  BEGIN
    UPDATE data.PasswordResetTokens SET Attempts = Attempts + 1 WHERE TokenHash = @Hash;
    THROW 50400, N'Kod hatalı.', 1;
  END
  BEGIN TRAN;
    UPDATE data.PasswordResetTokens SET UsedAt = SYSUTCDATETIME() WHERE TokenHash = @Hash;
    UPDATE data.Users SET PasswordHash = @PasswordHash, FailedLoginCount = 0, LockedUntil = NULL, UpdatedAt = SYSUTCDATETIME()
    WHERE Id = @UserId;
    DELETE FROM data.Sessions WHERE UserId = @UserId;   -- tüm cihazlardan çıkış
  COMMIT;
END
GO

-- ---------------------------------------------------------------------
-- Hesabımı sil (KVKK): kişisel bilgiler silinir, geçmiş kayıtlar isimsiz kalır.
-- Dükkân sahibi önce dükkânlarını admin'e kapattırmalıdır.
-- ---------------------------------------------------------------------
CREATE OR ALTER PROCEDURE api.User_DeleteAccount @ActorId uniqueidentifier
AS
BEGIN
  SET NOCOUNT ON; SET XACT_ABORT ON;
  EXEC data.usp_RequireUser @ActorId;
  IF data.fn_IsAdmin(@ActorId) = 1 THROW 50409, N'Admin hesabı buradan silinemez.', 1;
  IF EXISTS (SELECT 1 FROM data.Shops WHERE OwnerId = @ActorId AND Status IN ('pending', 'approved'))
    THROW 50409, N'Açık dükkânınız var. Hesabı silmeden önce dükkânınızın kapatılması için bize ulaşın.', 1;

  BEGIN TRAN;
    -- İleri tarihli randevular iptal, bekleyen sıra ve siparişler iptal (stok geri)
    UPDATE data.Appointments SET Status = 'cancelled', UpdatedAt = SYSUTCDATETIME()
    WHERE CustomerId = @ActorId AND Status IN ('pending', 'accepted') AND StartsAt > SYSUTCDATETIME();
    UPDATE data.QueueEntries SET Status = 'cancelled', FinishedAt = SYSUTCDATETIME()
    WHERE CustomerId = @ActorId AND Status IN ('waiting', 'serving');
    UPDATE p SET Stock = p.Stock + i.Quantity
    FROM data.Products p JOIN data.OrderItems i ON i.ProductId = p.Id JOIN data.Orders o ON o.Id = i.OrderId
    WHERE o.CustomerId = @ActorId AND o.Status IN ('pending', 'ready');
    UPDATE data.Orders SET Status = 'cancelled', UpdatedAt = SYSUTCDATETIME()
    WHERE CustomerId = @ActorId AND Status IN ('pending', 'ready');

    -- Ticari ileti onayları geri alınır (ret kaydı, adres silinmeden önce yazılır)
    EXEC data.usp_SetConsent @ActorId, 'EPOSTA', 0, 'HS_HESAP_SIL';
    EXEC data.usp_SetConsent @ActorId, 'MESAJ', 0, 'HS_HESAP_SIL';

    -- Kişisel veriler
    UPDATE data.Appointments SET CustomerName = N'Silinmiş kullanıcı', CustomerPhone = NULL WHERE CustomerId = @ActorId;
    DELETE FROM data.Reviews WHERE CustomerId = @ActorId;
    DELETE FROM data.Favorites WHERE UserId = @ActorId;
    DELETE FROM data.PushSubscriptions WHERE UserId = @ActorId;
    DELETE FROM data.Notifications WHERE UserId = @ActorId;
    DELETE FROM data.Sessions WHERE UserId = @ActorId;
    DELETE FROM data.PasswordResetTokens WHERE UserId = @ActorId;
    UPDATE data.Staff SET UserId = NULL, Phone = NULL, ShowPhone = 0 WHERE UserId = @ActorId;
    UPDATE data.Users
    SET Email = CONCAT('silindi-', CONVERT(varchar(36), Id), '@bermatik.invalid'), PasswordHash = N'!',
        FirstName = N'Silinmiş', LastName = N'Kullanıcı', BirthYear = NULL, Phone = NULL,
        TotpSecret = NULL, TotpEnabled = 0, PushOptIn = 0, SlotAlertsOptIn = 0,
        IsActive = 0, DeletedAt = SYSUTCDATETIME(), UpdatedAt = SYSUTCDATETIME()
    WHERE Id = @ActorId;
  COMMIT;
END
GO

-- Giriş için kullanıcıyı getirir (şifre kontrolü sitede yapılır)
CREATE OR ALTER PROCEDURE api.Auth_GetUserForLogin @Email nvarchar(254)
AS
BEGIN
  SET NOCOUNT ON;
  SELECT Id, PasswordHash, Role, IsActive, LockedUntil, TotpEnabled, TotpSecret
  FROM data.Users WHERE Email = LOWER(LTRIM(RTRIM(@Email)) COLLATE Latin1_General_CI_AS);
END
GO

-- 5 hatalı denemede hesap 15 dakika kilitlenir
CREATE OR ALTER PROCEDURE api.Auth_RecordLoginResult @UserId uniqueidentifier, @Success bit
AS
BEGIN
  SET NOCOUNT ON;
  IF @Success = 1
    UPDATE data.Users SET FailedLoginCount = 0, LockedUntil = NULL WHERE Id = @UserId;
  ELSE
    UPDATE data.Users
    SET FailedLoginCount = CASE WHEN FailedLoginCount + 1 >= 5 THEN 0 ELSE FailedLoginCount + 1 END,
        LockedUntil = CASE WHEN FailedLoginCount + 1 >= 5 THEN DATEADD(minute, 15, SYSUTCDATETIME()) ELSE LockedUntil END
    WHERE Id = @UserId;
END
GO

CREATE OR ALTER PROCEDURE api.Auth_CreateSession
  @UserId uniqueidentifier, @TokenHash binary(32), @ExpiresAt datetime2(0),
  @IpAddress varchar(45) = NULL, @UserAgent nvarchar(300) = NULL, @Client varchar(8) = 'web'
AS
BEGIN
  SET NOCOUNT ON; SET XACT_ABORT ON;
  IF @Client NOT IN ('web', 'mobile') THROW 50400, N'Geçersiz oturum türü.', 1;
  BEGIN TRAN;
    -- 1 site + 1 telefon: yeni giriş yalnızca aynı türdeki (site ya da telefon) eski oturumu kapatır
    DELETE FROM data.Sessions WHERE UserId = @UserId AND Client = @Client;
    INSERT INTO data.Sessions (TokenHash, UserId, ExpiresAt, IpAddress, UserAgent, Client)
    VALUES (@TokenHash, @UserId, @ExpiresAt, @IpAddress, LEFT(@UserAgent, 300), @Client);
  COMMIT;
END
GO

-- Her istekte çağrılır: oturum geçerliyse kullanıcıyı döner
CREATE OR ALTER PROCEDURE api.Auth_GetSession @TokenHash binary(32)
AS
BEGIN
  SET NOCOUNT ON;
  DELETE FROM data.Sessions WHERE TokenHash = @TokenHash AND ExpiresAt < SYSUTCDATETIME();
  UPDATE data.Sessions SET LastSeenAt = SYSUTCDATETIME()
  WHERE TokenHash = @TokenHash AND LastSeenAt < DATEADD(minute, -5, SYSUTCDATETIME());

  SELECT u.Id, u.Email, u.Role, u.FirstName, u.LastName, u.BirthYear, u.Phone, u.TotpEnabled, s.ExpiresAt,
         CAST(CASE WHEN u.EmailVerifiedAt IS NULL THEN 0 ELSE 1 END AS bit) AS EmailVerified
  FROM data.Sessions s
  JOIN data.Users u ON u.Id = s.UserId AND u.IsActive = 1
  WHERE s.TokenHash = @TokenHash;
END
GO

CREATE OR ALTER PROCEDURE api.Auth_DeleteSession @TokenHash binary(32)
AS
BEGIN
  SET NOCOUNT ON;
  DELETE FROM data.Sessions WHERE TokenHash = @TokenHash;
END
GO

-- Şifre değişince tüm oturumlar kapanır
CREATE OR ALTER PROCEDURE api.Auth_SetPassword @UserId uniqueidentifier, @PasswordHash nvarchar(255)
AS
BEGIN
  SET NOCOUNT ON; SET XACT_ABORT ON;
  BEGIN TRAN;
    UPDATE data.Users SET PasswordHash = @PasswordHash, FailedLoginCount = 0, LockedUntil = NULL, UpdatedAt = SYSUTCDATETIME()
    WHERE Id = @UserId;
    DELETE FROM data.Sessions WHERE UserId = @UserId;
  COMMIT;
END
GO

-- İki adımlı doğrulama (admin için zorunlu tutulacak)
CREATE OR ALTER PROCEDURE api.Auth_SetTotp @UserId uniqueidentifier, @TotpSecret nvarchar(64), @Enabled bit
AS
BEGIN
  SET NOCOUNT ON;
  UPDATE data.Users SET TotpSecret = @TotpSecret, TotpEnabled = @Enabled, UpdatedAt = SYSUTCDATETIME() WHERE Id = @UserId;
END
GO

CREATE OR ALTER PROCEDURE api.User_UpdateProfile
  @ActorId uniqueidentifier, @FirstName nvarchar(60), @LastName nvarchar(60), @BirthYear smallint = NULL, @Phone nvarchar(40) = NULL
AS
BEGIN
  SET NOCOUNT ON;
  EXEC data.usp_RequireUser @ActorId;
  DECLARE @NormPhone varchar(16) = data.fn_NormalizePhone(@Phone);
  IF @NormPhone IS NULL
    THROW 50400, N'Geçerli bir telefon numarası girin.', 1;
  IF LEN(LTRIM(RTRIM(@FirstName))) = 0 OR LEN(LTRIM(RTRIM(@LastName))) = 0
    THROW 50400, N'Ad ve soyad gerekli.', 1;
  IF EXISTS (SELECT 1 FROM data.Users WHERE Phone = @NormPhone AND Id <> @ActorId)
    THROW 50409, N'Bu telefon numarası başka bir hesapta kayıtlı.', 1;
  UPDATE data.Users
  SET FirstName = LTRIM(RTRIM(@FirstName)), LastName = LTRIM(RTRIM(@LastName)), BirthYear = @BirthYear,
      Phone = @NormPhone, UpdatedAt = SYSUTCDATETIME()
  WHERE Id = @ActorId;
END
GO

-- ---------------------------------------------------------------------
-- Google ile giriş
-- 1) Bu Google hesabı daha önce bağlandıysa → kullanıcı
-- 2) Google e-postayı doğruladıysa ve bu e-postayla hesap varsa → Google bağlanır, kullanıcı
-- 3) Hiçbiri değilse satır dönmez → site kayıt tamamlama ekranını (telefon + KVKK) açar
-- ---------------------------------------------------------------------
CREATE OR ALTER PROCEDURE api.Auth_GoogleSignIn @GoogleSub varchar(64), @Email nvarchar(254), @EmailVerified bit
AS
BEGIN
  SET NOCOUNT ON;
  DECLARE @Id uniqueidentifier = (SELECT Id FROM data.Users WHERE GoogleSub = @GoogleSub);
  IF @Id IS NULL AND @EmailVerified = 1
  BEGIN
    SELECT @Id = Id FROM data.Users
    WHERE Email = LOWER(LTRIM(RTRIM(@Email)) COLLATE Latin1_General_CI_AS) AND GoogleSub IS NULL AND DeletedAt IS NULL;
    IF @Id IS NOT NULL UPDATE data.Users SET GoogleSub = @GoogleSub, UpdatedAt = SYSUTCDATETIME() WHERE Id = @Id;
  END
  SELECT Id, IsActive, LockedUntil, TotpEnabled, TotpSecret FROM data.Users WHERE Id = @Id;
END
GO

CREATE OR ALTER PROCEDURE api.Auth_RegisterGoogle
  @GoogleSub varchar(64), @Email nvarchar(254), @FirstName nvarchar(60), @LastName nvarchar(60),
  @Phone nvarchar(40), @BirthYear smallint = NULL, @KvkkAccepted bit = 0, @KvkkVersion varchar(10) = '2026-1', @IsBusiness bit = 0
AS
BEGIN
  SET NOCOUNT ON;
  DECLARE @Id uniqueidentifier;
  -- Şifresiz hesap: PasswordHash '!' (e-posta + şifreyle giriş yapılamaz, "şifremi unuttum" ile şifre koyabilir)
  EXEC data.usp_CreateUser @Email, N'!', @FirstName, @LastName, @BirthYear, @Phone, @KvkkAccepted, @KvkkVersion, @GoogleSub, @Id OUTPUT;
  -- Google e-postayı zaten doğruladı (site yalnızca doğrulanmış Google e-postasıyla kayıt açar)
  UPDATE data.Users SET EmailVerifiedAt = SYSUTCDATETIME() WHERE Id = @Id;
  IF @IsBusiness = 1 UPDATE data.Users SET Role = 'shop_owner' WHERE Id = @Id;
  SELECT @Id AS Id;
END
GO
