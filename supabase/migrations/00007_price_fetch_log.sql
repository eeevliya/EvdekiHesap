-- 00007_price_fetch_log.sql
create table price_fetch_log (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid references households(id) on delete cascade, -- null for global symbol fetches
  symbol_id    uuid references symbols(id) on delete set null,
  status       text not null check (status in ('success', 'error', 'skipped')),
  message      text,
  fetched_at   timestamptz not null default now()
);

-- RLS
alter table price_fetch_log enable row level security;

-- Members can read their household's log; global logs (household_id IS NULL) readable by all authenticated users
create policy "Price fetch log readable by household members"
  on price_fetch_log for select
  to authenticated
  using (
    household_id is null
    or is_household_member(household_id)
  );

-- Only service role can insert (no authenticated insert policy; service role bypasses RLS).
