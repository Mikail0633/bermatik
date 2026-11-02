-- "Tıraş" yerine "traş" yazımı (site sahibinin tercihi). Yalnızca Bermatik'in kendi metinleri:
-- hizmet kategorileri ve hazır mesajlar. Yer adları (Tıraşlar Köyü vb.) ve dükkânların kendi yazdıkları değişmez.
-- BIN2: büyük/küçük harf ayrı eşleşsin (Tıraş → Traş, tıraş → traş)
UPDATE data.ServiceCategories
SET Name = REPLACE(REPLACE(Name COLLATE Latin1_General_BIN2, N'Tıraş', N'Traş'), N'tıraş', N'traş'),
    Description = REPLACE(REPLACE(Description COLLATE Latin1_General_BIN2, N'Tıraş', N'Traş'), N'tıraş', N'traş')
WHERE Name LIKE N'%ıraş%' OR Description LIKE N'%ıraş%';

UPDATE data.MessageTemplates
SET Title = REPLACE(REPLACE(Title COLLATE Latin1_General_BIN2, N'Tıraş', N'Traş'), N'tıraş', N'traş'),
    Body = REPLACE(REPLACE(Body COLLATE Latin1_General_BIN2, N'Tıraş', N'Traş'), N'tıraş', N'traş')
WHERE Title LIKE N'%ıraş%' OR Body LIKE N'%ıraş%';
GO
