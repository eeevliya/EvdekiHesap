-- 00003_household_members.sql
create table household_members (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  user_id      uuid not null references profiles(id) on delete cascade,
  role         text not null check (role in ('manager', 'editor', 'viewer')),
  joined_at    timestamptz not null default now(),
  unique (household_id, user_id)
);

-- ── RLS helper functions ──────────────────────────────────────────────────────
-- These use security definer so they bypass RLS when called from policies,
-- preventing infinite recursion on the household_members table.

create or replace function is_household_member(hid uuid)
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from household_members
    where household_id = hid and user_id = auth.uid()
  );
$$;

create or replace function get_household_role(hid uuid)
returns text language sql security definer stable as $$
  select role from household_members
  where household_id = hid and user_id = auth.uid()
  limit 1;
$$;

-- ── households RLS (applied here because helpers must exist first) ────────────
create policy "Members can view their household"
  on households for select
  using (is_household_member(id));

create policy "Managers can update their household"
  on households for update
  using (get_household_role(id) = 'manager');

-- ── household_members RLS ─────────────────────────────────────────────────────
alter table household_members enable row level security;

create policy "Members can view their household's members"
  on household_members for select
  using (is_household_member(household_id));

create policy "Managers can add members"
  on household_members for insert
  with check (get_household_role(household_id) = 'manager');

create policy "Managers can update member roles"
  on household_members for update
  using (get_household_role(household_id) = 'manager');

create policy "Managers can remove members"
  on household_members for delete
  using (get_household_role(household_id) = 'manager');
