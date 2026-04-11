-- 1. Extend the symbols.type check constraint to include 'stablecoin'.
--    The existing constraint is auto-named symbols_type_check by PostgreSQL.
alter table symbols drop constraint if exists symbols_type_check;
alter table symbols add constraint symbols_type_check check (type in (
  'fiat_currency',
  'stock',
  'tefas_fund',
  'physical_commodity',
  'cryptocurrency',
  'stablecoin',
  'custom'
));

-- 2. Require non-null primary_conversion_fiat for cryptocurrency and stablecoin.
--    Both types must know their pricing currency to derive exchange rates.
alter table symbols add constraint chk_asset_type_requires_fiat
  check (type not in ('cryptocurrency', 'stablecoin') or primary_conversion_fiat is not null);

-- 3. Seed USDT as a global stablecoin symbol (rate = 1:1 against USD; no API fetch).
insert into symbols (code, name, type, primary_conversion_fiat, is_active, household_id)
values ('USDT', 'Tether USD', 'stablecoin', 'USD', true, null)
on conflict do nothing;
