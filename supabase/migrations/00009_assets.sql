-- 00009_assets.sql
create table assets (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  account_id   uuid not null references accounts(id) on delete cascade,
  symbol_id    uuid not null references symbols(id),
  amount       numeric not null default 0 check (amount >= 0),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (account_id, symbol_id)
);

-- ── RLS ───────────────────────────────────────────────────────────────────────
alter table assets enable row level security;

-- All household members can read assets
create policy "Members can read assets"
  on assets for select
  using (is_household_member(household_id));

-- Editors and managers can create assets
create policy "Editors and managers can create assets"
  on assets for insert
  with check (get_household_role(household_id) in ('editor', 'manager'));

-- Editors and managers can update assets
create policy "Editors and managers can update assets"
  on assets for update
  using (get_household_role(household_id) in ('editor', 'manager'));

-- Editors and managers can delete assets
create policy "Editors and managers can delete assets"
  on assets for delete
  using (get_household_role(household_id) in ('editor', 'manager'));
