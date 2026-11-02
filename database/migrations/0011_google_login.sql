-- =====================================================================
-- Bermatik — Google ile giriş
-- GoogleSub: Google'ın kullanıcıya verdiği değişmez kimlik.
-- Yalnızca Google ile kayıt olanların şifresi yoktur (PasswordHash = '!').
-- =====================================================================

ALTER TABLE data.Users ADD GoogleSub varchar(64) NULL;
GO
CREATE UNIQUE INDEX UX_Users_GoogleSub ON data.Users (GoogleSub) WHERE GoogleSub IS NOT NULL;
