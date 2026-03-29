-- Rename global crypto symbols so the code IS the Binance pair.
-- Fetchers now use symbol.code directly — no fetch_config needed.
--
-- assets, transactions, exchange_rates, and price_fetch_log all reference
-- symbols by UUID (symbol_id), so renaming the code here automatically
-- applies to all related rows without any further updates.

update symbols
set code = 'BTCUSDT', name = 'Bitcoin (USDT)', updated_at = now()
where code = 'BTC' and household_id is null;

update symbols
set code = 'ETHUSDT', name = 'Ethereum (USDT)', updated_at = now()
where code = 'ETH' and household_id is null;
