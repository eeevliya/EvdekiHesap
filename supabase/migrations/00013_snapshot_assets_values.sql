-- 00013_snapshot_assets_values.sql
-- Replace exchange_rate + value_in_display_currency with explicit value_try/usd/eur columns.
alter table snapshot_assets
  drop column exchange_rate,
  drop column value_in_display_currency,
  add column value_try numeric,
  add column value_usd numeric,
  add column value_eur numeric;
