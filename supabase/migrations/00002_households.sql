-- 00002_households.sql
create table households (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  display_currency text not null default 'TRY'
                     check (display_currency in ('TRY', 'USD', 'EUR')),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- RLS enabled here; policies are applied in 00003 after helper functions exist
alter table households enable row level security;
