-- =====================================================================
-- Bildirimler (site sahibinin kararı, 2026-11-19):
--   * admin_document: biri işletme hesabı için belge yükleyince adminlere bildirim (zil + telefon; e-postayı site gönderir)
--   * revisit_due   : "Traş / bakım zamanın geldi" — müşterinin tekrar gelme zamanı gelince günde bir kez hatırlatma.
--                     Her ziyaret döngüsünde en fazla 1 kez gider; müşteri Hesabım'dan kapatabilir (varsayılan açık).
-- =====================================================================
ALTER TABLE data.Users ADD RevisitRemindersOptIn bit NOT NULL CONSTRAINT DF_Users_RevisitReminders DEFAULT 1;
GO

ALTER TABLE data.Notifications DROP CONSTRAINT CK_Notifications_Kind;
ALTER TABLE data.Notifications ADD CONSTRAINT CK_Notifications_Kind CHECK (Kind IN
  ('campaign', 'slot_opened', 'appointment_new', 'appointment_accepted', 'appointment_rejected',
   'appointment_cancelled', 'appointment_reminder', 'shop_claim', 'order_new', 'order_ready', 'order_cancelled',
   'security', 'account_verify', 'review_reply', 'admin_document', 'revisit_due'));
