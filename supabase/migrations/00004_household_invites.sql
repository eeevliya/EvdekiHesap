-- 00004_household_invites.sql
create table household_invites (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  code         text not null unique,
  role         text not null check (role in ('editor', 'viewer')),
  created_by   uuid not null references profiles(id),
  expires_at   timestamptz,               -- null = no expiry
  max_uses     integer,                   -- null = unlimited
  use_count    integer not null default 0,
  created_at   timestamptz not null default now()
);

-- RLS
alter table household_invites enable row level security;

create policy "Members can view their household's invites"
  on household_invites for select
  using (is_household_member(household_id));

create policy "Managers can create invites"
  on household_invites for insert
  with check (get_household_role(household_id) = 'manager');

create policy "Managers can delete invites"
  on household_invites for delete
  using (get_household_role(household_id) = 'manager');
