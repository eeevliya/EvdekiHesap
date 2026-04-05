-- Fix display names for Turkish gold symbols
UPDATE symbols
SET name = CASE code
  WHEN 'ALTIN_GRAM'   THEN 'Gram Altın'
  WHEN 'ALTIN_CEYREK' THEN 'Çeyrek Altın'
  WHEN 'ALTIN_YARIM'  THEN 'Yarım Altın'
  WHEN 'ALTIN_TAM'    THEN 'Tam Altın'
END
WHERE code IN ('ALTIN_GRAM', 'ALTIN_CEYREK', 'ALTIN_YARIM', 'ALTIN_TAM')
  AND household_id IS NULL;
