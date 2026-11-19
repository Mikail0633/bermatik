-- =====================================================================
-- İşletme paneli: gelir/randevu raporu, müşteri listesi, yorumlara cevap (2026-11-11)
--   Dükkân sahibi dükkânın tamamını, personel yalnızca kendisini görür (site sahibinin kararı).
--   Yoruma cevap: sahip (ve admin) her yoruma, personel yalnızca kendisi hakkındaki yoruma yazar;
--   ilk cevapta yorumu yazan müşteriye bildirim gider.
-- =====================================================================
ALTER TABLE data.Reviews ADD
  ReplyText nvarchar(1000) NULL,
  ReplyAt datetime2(0) NULL,
  ReplyBy uniqueidentifier NULL CONSTRAINT FK_Reviews_ReplyBy REFERENCES data.Users (Id);
GO

ALTER TABLE data.Notifications DROP CONSTRAINT CK_Notifications_Kind;
ALTER TABLE data.Notifications ADD CONSTRAINT CK_Notifications_Kind CHECK (Kind IN
  ('campaign', 'slot_opened', 'appointment_new', 'appointment_accepted', 'appointment_rejected',
   'appointment_cancelled', 'appointment_reminder', 'shop_claim', 'order_new', 'order_ready', 'order_cancelled',
   'security', 'account_verify', 'review_reply'));

-- Rapor ve müşteri listesi sorguları için: dükkân+zaman dizini, gereken sütunları da taşısın
DROP INDEX IX_Appointments_ShopTime ON data.Appointments;
CREATE INDEX IX_Appointments_ShopTime ON data.Appointments (ShopId, StartsAt)
  INCLUDE (Status, StaffId, CustomerId, TotalPrice, Source, CustomerName, CustomerPhone);
