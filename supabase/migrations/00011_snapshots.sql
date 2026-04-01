-- 00011_snapshots.sql
create table snapshots (
  id              uuid primary key default gen_random_uuid(),
  household_id    uuid not null references households(id) on delete cascade,
  taken_at        timestamptz not null default now(),
  net_worth_try   numeric,
  net_worth_usd   numeric,
  net_worth_eur   numeric,
  trigger         text not null check (trigger in ('scheduled', 'manual')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index snapshots_household_taken_idx on snapshots (household_id, taken_at desc);

alter table snapshots enable row level security;

-- Members can read their household's snapshots (service role bypasses RLS for writes)
create policy "members can select snapshots"
  on snapshots for select
  using (is_household_member(household_id));
