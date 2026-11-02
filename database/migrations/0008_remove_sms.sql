-- =====================================================================
-- Bermatik — SMS kaldırıldı; bildirimler yalnızca telefon bildirimi (push)
-- =====================================================================

DROP PROCEDURE IF EXISTS api.Worker_NextSms;
DROP PROCEDURE IF EXISTS api.Worker_SmsResult;

DROP INDEX IF EXISTS IX_Notifications_SmsQueue ON data.Notifications;
ALTER TABLE data.Notifications DROP CONSTRAINT IF EXISTS CK_Notifications_Sms;
ALTER TABLE data.Notifications DROP COLUMN IF EXISTS SmsStatus;

ALTER TABLE data.Users DROP CONSTRAINT IF EXISTS DF_Users_SmsOptIn;
ALTER TABLE data.Users DROP COLUMN IF EXISTS SmsOptIn, SmsOptInAt;

ALTER TABLE data.PlatformSettings DROP CONSTRAINT IF EXISTS DF_PlatformSettings_Sms;
ALTER TABLE data.PlatformSettings DROP COLUMN IF EXISTS SmsEnabled;

ALTER TABLE data.Campaigns DROP CONSTRAINT IF EXISTS CK_Campaigns_Channel;
ALTER TABLE data.Campaigns DROP COLUMN IF EXISTS Channel;
