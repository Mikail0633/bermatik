-- =====================================================================
-- 0019: Sipariş bildirimleri
--   order_new       → dükkâna: yeni sipariş geldi (veya müşteri iptal etti)
--   order_ready     → müşteriye: siparişin hazır, gelip alabilirsin
--   order_cancelled → müşteriye: dükkân siparişi iptal etti
-- =====================================================================

ALTER TABLE data.Notifications DROP CONSTRAINT CK_Notifications_Kind;
ALTER TABLE data.Notifications ADD CONSTRAINT CK_Notifications_Kind CHECK (Kind IN
  ('campaign', 'slot_opened', 'appointment_new', 'appointment_accepted', 'appointment_rejected',
   'appointment_cancelled', 'appointment_reminder', 'shop_claim', 'order_new', 'order_ready', 'order_cancelled'));
