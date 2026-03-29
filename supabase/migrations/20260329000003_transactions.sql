-- ── 10. transactions ──────────────────────────────────────────────────────────

create table transactions (
  id             uuid primary key default gen_random_uuid(),
  household_id   uuid not null references households(id) on delete cascade,
  type           text not null check (type in ('deposit', 'debit', 'transfer', 'interest', 'trade')),
  date           timestamptz not null default now(),
  to_asset_id    uuid references assets(id),
  from_asset_id  uuid references assets(id),
  fee_asset_id   uuid references assets(id),
  to_amount      numeric check (to_amount > 0),
  from_amount    numeric check (from_amount > 0),
  fee_amount     numeric check (fee_amount >= 0),
  exchange_rate  numeric check (exchange_rate > 0),
  notes          text,
  created_by     uuid not null references profiles(id),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  constraint chk_deposit  check (type != 'deposit'  or (to_asset_id is not null and to_amount is not null and from_asset_id is null and from_amount is null)),
  constraint chk_debit    check (type != 'debit'    or (from_asset_id is not null and from_amount is not null and to_asset_id is null and to_amount is null)),
  constraint chk_interest check (type != 'interest' or (to_asset_id is not null and to_amount is not null and from_asset_id is null and from_amount is null)),
  constraint chk_transfer check (type != 'transfer' or (to_asset_id is not null and from_asset_id is not null and to_amount is not null and from_amount is not null)),
  constraint chk_trade    check (type != 'trade'    or (to_asset_id is not null and from_asset_id is not null and to_amount is not null and from_amount is not null and exchange_rate is not null)),
  constraint chk_fee      check (fee_amount is null or fee_asset_id is not null)
);

create index transactions_household_date_idx on transactions (household_id, date desc);

-- ── RLS ───────────────────────────────────────────────────────────────────────

alter table transactions enable row level security;

create policy "members can view transactions" on transactions
  for select using (is_household_member(household_id));

create policy "editors and managers can insert transactions" on transactions
  for insert with check (
    is_household_member(household_id) and
    get_household_role(household_id) in ('editor', 'manager')
  );

create policy "editors and managers can update transactions" on transactions
  for update using (
    is_household_member(household_id) and
    get_household_role(household_id) in ('editor', 'manager')
  );

create policy "editors and managers can delete transactions" on transactions
  for delete using (
    is_household_member(household_id) and
    get_household_role(household_id) in ('editor', 'manager')
  );

-- ── RPC: apply_transaction ────────────────────────────────────────────────────
-- Inserts a transaction and atomically adjusts asset amounts.
-- Returns the new transaction's id.

create or replace function apply_transaction(
  p_household_id  uuid,
  p_type          text,
  p_date          timestamptz,
  p_to_asset_id   uuid,
  p_from_asset_id uuid,
  p_fee_asset_id  uuid,
  p_to_amount     numeric,
  p_from_amount   numeric,
  p_fee_amount    numeric,
  p_exchange_rate numeric,
  p_notes         text,
  p_created_by    uuid
) returns uuid language plpgsql security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  insert into transactions (
    household_id, type, date,
    to_asset_id, from_asset_id, fee_asset_id,
    to_amount, from_amount, fee_amount,
    exchange_rate, notes, created_by
  ) values (
    p_household_id, p_type, p_date,
    p_to_asset_id, p_from_asset_id, p_fee_asset_id,
    p_to_amount, p_from_amount, p_fee_amount,
    p_exchange_rate, p_notes, p_created_by
  ) returning id into v_id;

  if p_to_asset_id   is not null and p_to_amount   is not null then
    update assets set amount = amount + p_to_amount,   updated_at = now() where id = p_to_asset_id;
  end if;
  if p_from_asset_id is not null and p_from_amount is not null then
    update assets set amount = amount - p_from_amount, updated_at = now() where id = p_from_asset_id;
  end if;
  if p_fee_asset_id  is not null and p_fee_amount  is not null and p_fee_amount > 0 then
    update assets set amount = amount - p_fee_amount,  updated_at = now() where id = p_fee_asset_id;
  end if;

  return v_id;
end;
$$;

-- ── RPC: reverse_and_delete_transaction ───────────────────────────────────────
-- Reverses all asset amount changes from a transaction then deletes it.

create or replace function reverse_and_delete_transaction(
  p_transaction_id uuid
) returns void language plpgsql security definer
set search_path = public
as $$
declare
  t transactions%rowtype;
begin
  select * into t from transactions where id = p_transaction_id;
  if not found then raise exception 'transaction not found'; end if;

  if t.to_asset_id   is not null and t.to_amount   is not null then
    update assets set amount = amount - t.to_amount,   updated_at = now() where id = t.to_asset_id;
  end if;
  if t.from_asset_id is not null and t.from_amount is not null then
    update assets set amount = amount + t.from_amount, updated_at = now() where id = t.from_asset_id;
  end if;
  if t.fee_asset_id  is not null and t.fee_amount  is not null and t.fee_amount > 0 then
    update assets set amount = amount + t.fee_amount,  updated_at = now() where id = t.fee_asset_id;
  end if;

  delete from transactions where id = p_transaction_id;
end;
$$;

-- ── RPC: update_transaction ───────────────────────────────────────────────────
-- Reverses old asset changes, applies new values, updates the transaction row.
-- Only amount/fee/exchange_rate/notes/date fields are mutable post-creation.
-- Note: reverse step uses t.fee_asset_id; apply step uses p_fee_asset_id —
-- intentionally different variables to handle fee asset changes correctly.

create or replace function update_transaction(
  p_transaction_id uuid,
  p_date           timestamptz,
  p_to_amount      numeric,
  p_from_amount    numeric,
  p_fee_asset_id   uuid,
  p_fee_amount     numeric,
  p_exchange_rate  numeric,
  p_notes          text
) returns void language plpgsql security definer
set search_path = public
as $$
declare
  t transactions%rowtype;
begin
  select * into t from transactions where id = p_transaction_id;
  if not found then raise exception 'transaction not found'; end if;

  -- Reverse old asset impacts
  if t.to_asset_id   is not null and t.to_amount   is not null then
    update assets set amount = amount - t.to_amount,   updated_at = now() where id = t.to_asset_id;
  end if;
  if t.from_asset_id is not null and t.from_amount is not null then
    update assets set amount = amount + t.from_amount, updated_at = now() where id = t.from_asset_id;
  end if;
  if t.fee_asset_id  is not null and t.fee_amount  is not null and t.fee_amount > 0 then
    update assets set amount = amount + t.fee_amount,  updated_at = now() where id = t.fee_asset_id;
  end if;

  -- Apply new asset impacts (to_asset_id and from_asset_id cannot change)
  if t.to_asset_id   is not null and p_to_amount   is not null then
    update assets set amount = amount + p_to_amount,   updated_at = now() where id = t.to_asset_id;
  end if;
  if t.from_asset_id is not null and p_from_amount is not null then
    update assets set amount = amount - p_from_amount, updated_at = now() where id = t.from_asset_id;
  end if;
  if p_fee_asset_id  is not null and p_fee_amount  is not null and p_fee_amount > 0 then
    update assets set amount = amount - p_fee_amount,  updated_at = now() where id = p_fee_asset_id;
  end if;

  -- Update the transaction record
  update transactions set
    date          = p_date,
    to_amount     = p_to_amount,
    from_amount   = p_from_amount,
    fee_asset_id  = p_fee_asset_id,
    fee_amount    = p_fee_amount,
    exchange_rate = p_exchange_rate,
    notes         = p_notes,
    updated_at    = now()
  where id = p_transaction_id;
end;
$$;
