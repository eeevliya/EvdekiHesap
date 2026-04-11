-- 20260411000003_latest_exchange_rates_view.sql
-- View returning the single most-recent rate per symbol.
-- Uses DISTINCT ON (symbol_id) so the DB returns exactly one row per symbol
-- instead of sending the full rate history to the application layer.
-- The existing index on exchange_rates(symbol_id, fetched_at DESC) makes this fast.
-- RLS on the underlying exchange_rates table is respected (SECURITY INVOKER, the default).
create view latest_exchange_rates as
select distinct on (symbol_id)
  symbol_id,
  household_id,
  rate,
  fetched_at,
  source
from exchange_rates
order by symbol_id, fetched_at desc;
