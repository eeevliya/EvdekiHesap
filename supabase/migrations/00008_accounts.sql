-- 00008_accounts.sql
create table accounts (
  id                  uuid primary key default gen_random_uuid(),
  household_id        uuid not null references households(id) on delete cascade,
  owner_id            uuid not null references profiles(id),
  name                text not null,
  institution         text,
  account_identifier  text,   -- IBAN, wallet address, etc.
  default_symbol_id   uuid references symbols(id),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (household_id, name)
);

-- ── RLS ───────────────────────────────────────────────────────────────────────
alter table accounts enable row level security;

-- All household members can read accounts
create policy "Members can read accounts"
  on accounts for select
  using (is_household_member(household_id));

-- Editors and managers can create accounts
create policy "Editors and managers can create accounts"
  on accounts for insert
  with check (get_household_role(household_id) in ('editor', 'manager'));

-- Editors can update only their own accounts; managers can update any
create policy "Editors and managers can update accounts"
  on accounts for update
  using (
    get_household_role(household_id) = 'manager'
    or (get_household_role(household_id) = 'editor' and owner_id = auth.uid())
  );

-- Editors can delete only their own accounts; managers can delete any
create policy "Editors and managers can delete accounts"
  on accounts for delete
  using (
    get_household_role(household_id) = 'manager'
    or (get_household_role(household_id) = 'editor' and owner_id = auth.uid())
  );
