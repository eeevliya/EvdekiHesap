-- Revert crypto symbol codes to asset identifier only (e.g. BTCUSDT → BTC).
-- All related tables (assets, transactions, exchange_rates, price_fetch_log)
-- reference symbols by UUID, so only the code and name columns need updating.

update symbols
set code = 'BTC', name = 'Bitcoin', updated_at = now()
where code = 'BTCUSDT' and household_id is null;

update symbols
set code = 'ETH', name = 'Ethereum', updated_at = now()
where code = 'ETHUSDT' and household_id is null;
