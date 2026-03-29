-- 00005_symbols.sql
create table symbols (
  id                      uuid primary key default gen_random_uuid(),
  household_id            uuid references households(id) on delete cascade, -- null = global
  code                    text not null,
  name                    text,
  description             text,
  type                    text not null check (type in (
                            'fiat_currency',
                            'stock',
                            'tefas_fund',
                            'physical_commodity',
                            'cryptocurrency',
                            'custom'
                          )),
  primary_conversion_fiat text,           -- null for fiat symbols themselves
  is_active               boolean not null default true,
  fetch_config            jsonb,          -- symbol-type-specific config; structure defined per fetcher
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

-- Global symbols: code is globally unique (household_id IS NULL)
create unique index symbols_global_code_unique
  on symbols (code)
  where household_id is null;

-- Household symbols: code is unique within the household
create unique index symbols_household_code_unique
  on symbols (household_id, code)
  where household_id is not null;

-- ── RLS ───────────────────────────────────────────────────────────────────────
alter table symbols enable row level security;

-- Any authenticated user can read global symbols
create policy "Authenticated users can read global symbols"
  on symbols for select
  using (household_id is null and auth.uid() is not null);

-- Household members can read their household's symbols
create policy "Members can read household symbols"
  on symbols for select
  using (household_id is not null and is_household_member(household_id));

-- Only managers can create household-custom symbols
create policy "Managers can create household symbols"
  on symbols for insert
  with check (household_id is not null and get_household_role(household_id) = 'manager');

-- Only managers can update household-custom symbols
create policy "Managers can update household symbols"
  on symbols for update
  using (household_id is not null and get_household_role(household_id) = 'manager');

-- Only managers can delete household-custom symbols
create policy "Managers can delete household symbols"
  on symbols for delete
  using (household_id is not null and get_household_role(household_id) = 'manager');
