-- seed.sql — global symbols (household_id = null)
-- These are seeded once and are readable by all authenticated users.
-- Run after all migrations have been applied.

insert into symbols (code, name, type, primary_conversion_fiat, is_active, household_id) values
  -- Fiat currencies (no primary_conversion_fiat — they ARE the fiat)
  ('TRY', 'Turkish Lira',    'fiat_currency', null,  true, null),
  ('USD', 'US Dollar',       'fiat_currency', null,  true, null),
  ('EUR', 'Euro',            'fiat_currency', null,  true, null),
  ('GBP', 'British Pound',   'fiat_currency', null,  true, null),

  -- Cryptocurrencies — code is asset identifier; primary_conversion_fiat is pricing currency
  ('BTC',  'Bitcoin',     'cryptocurrency', 'USD', true, null),
  ('ETH',  'Ethereum',    'cryptocurrency', 'USD', true, null),

  -- Stablecoins — fixed 1:1 rate against primary_conversion_fiat; no API fetch
  ('USDT', 'Tether USD',  'stablecoin',     'USD', true, null),

  -- Physical commodities — international (priced in USD)
  ('XAU', 'Gold (Troy oz)',  'physical_commodity', 'USD', true, null),
  ('XAG', 'Silver (Troy oz)','physical_commodity', 'USD', true, null),

  -- Physical commodities — Turkish gold variants (priced in TRY)
  ('ALTIN_GRAM',    'Gram Altın',    'physical_commodity', 'TRY', true, null),
  ('ALTIN_CEYREK',  'Çeyrek Altın',  'physical_commodity', 'TRY', true, null),
  ('ALTIN_YARIM',   'Yarım Altın',   'physical_commodity', 'TRY', true, null),
  ('ALTIN_TAM',     'Tam Altın',     'physical_commodity', 'TRY', true, null)

on conflict do nothing;
