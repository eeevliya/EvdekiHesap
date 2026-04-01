-- 00012_snapshot_assets.sql
create table snapshot_assets (
  id                        uuid primary key default gen_random_uuid(),
  snapshot_id               uuid not null references snapshots(id) on delete cascade,
  household_id              uuid not null references households(id) on delete cascade,
  asset_id                  uuid not null references assets(id),
  symbol_id                 uuid not null references symbols(id),
  amount                    numeric not null,
  exchange_rate             numeric not null,
  value_in_display_currency numeric not null,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

alter table snapshot_assets enable row level security;

-- Members can read their household's snapshot assets (service role bypasses RLS for writes)
create policy "members can select snapshot_assets"
  on snapshot_assets for select
  using (is_household_member(household_id));
