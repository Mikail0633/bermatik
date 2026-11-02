-- =====================================================================
-- 0017: Bir telefon numarası yalnızca bir hesapta kullanılabilir
-- (e-posta zaten tekil: UQ_Users_Email). Önceden çakışan numaralarda
-- en eski hesap numarayı korur, diğerlerinin numarası boşaltılır;
-- site o kullanıcılardan yeni numara ister.
-- =====================================================================

WITH d AS (
  SELECT Id, ROW_NUMBER() OVER (PARTITION BY Phone ORDER BY CreatedAt, Id) AS rn
  FROM data.Users WHERE Phone IS NOT NULL
)
UPDATE u SET Phone = NULL, UpdatedAt = SYSUTCDATETIME()
FROM data.Users u JOIN d ON d.Id = u.Id
WHERE d.rn > 1;

CREATE UNIQUE INDEX UX_Users_Phone ON data.Users (Phone) WHERE Phone IS NOT NULL;
