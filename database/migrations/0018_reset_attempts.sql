-- =====================================================================
-- 0018: Şifremi unuttum kodunda yanlış deneme sınırı
-- 6 haneli kod tahminle bulunmasın: 5 yanlış denemeden sonra kod geçersiz olur.
-- =====================================================================

ALTER TABLE data.PasswordResetTokens ADD
  Attempts tinyint NOT NULL CONSTRAINT DF_PasswordResetTokens_Attempts DEFAULT 0;
