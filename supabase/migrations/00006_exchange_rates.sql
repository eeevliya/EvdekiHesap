-- 00006_exchange_rates.sql
-- Stores one rate per symbol per fetch. household_id mirrors the symbol's household_id.
-- Global symbol rates (household_id = null) are readable by all authenticated users.
create table exchange_rates (
  id           uuid primary key default gen_random_uuid(),
  symbol_id    uuid not null references symbols(id) on delete cascade,
  household_id uuid references households(id) on delete cascade, -- null for global symbols
  rate         numeric not null,   -- price of 1 unit in primary_conversion_fiat
  fetched_at   timestamptz not null default now(),
  source       text                -- e.g., 'tcmb', 'coingecko', 'tefas', 'binance'
);

-- Index for latest-rate lookups
create index exchange_rates_symbol_fetched_idx on exchange_rates (symbol_id, fetched_at desc);

-- RLS
alter table exchange_rates enable row level security;

-- Any authenticated user can read global rates (household_id IS NULL)
create policy "Global rates readable by authenticated users"
  on exchange_rates for select
  to authenticated
  using (household_id is null);

-- Household members can read their own household rates
create policy "Household rates readable by members"
  on exchange_rates for select
  to authenticated
  using (
    household_id is not null
    and is_household_member(household_id)
  );

-- Only service role can insert/update/delete (cron jobs)
-- No INSERT/UPDATE/DELETE policies for authenticated users; service role bypasses RLS.
