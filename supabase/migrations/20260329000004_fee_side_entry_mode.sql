-- Replace fee_asset_id with fee_side; add entry_mode.
-- Migrates existing fee data before dropping the old column.
-- Recreates all three transaction RPCs with net-delta logic and new signatures.

-- ── Schema changes ─────────────────────────────────────────────────────────────

alter table transactions
  add column fee_side   text check (fee_side   in ('to', 'from')),
  add column entry_mode text check (entry_mode in ('both_amounts', 'to_amount_and_rate', 'from_amount_and_rate'));

-- Migrate existing fee_asset_id → fee_side
-- (dev data only; rows where fee_asset_id doesn't match to/from silently lose the fee)
update transactions set fee_side = 'to'   where fee_asset_id is not null and fee_asset_id = to_asset_id;
update transactions set fee_side = 'from' where fee_asset_id is not null and fee_asset_id = from_asset_id;

-- Drop old chk_fee (references fee_asset_id), drop the column, add new constraint
alter table transactions drop constraint chk_fee;
alter table transactions drop column fee_asset_id;
alter table transactions add constraint chk_fee check (fee_amount is null or fee_side is not null);

-- ── apply_transaction ──────────────────────────────────────────────────────────
-- The fee asset is always derived from fee_side + to_asset_id / from_asset_id.
-- Asset updates are combined per unique asset_id (no separate fee row).

create or replace function apply_transaction(
  p_household_id  uuid,
  p_type          text,
  p_date          timestamptz,
  p_to_asset_id   uuid,
  p_from_asset_id uuid,
  p_fee_side      text,          -- 'to', 'from', or null
  p_to_amount     numeric,
  p_from_amount   numeric,
  p_fee_amount    numeric,
  p_exchange_rate numeric,
  p_entry_mode    text,
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
    to_asset_id, from_asset_id,
    fee_side, fee_amount,
    to_amount, from_amount,
    exchange_rate, entry_mode, notes, created_by
  ) values (
    p_household_id, p_type, p_date,
    p_to_asset_id, p_from_asset_id,
    p_fee_side, p_fee_amount,
    p_to_amount, p_from_amount,
    p_exchange_rate, p_entry_mode, p_notes, p_created_by
  ) returning id into v_id;

  -- to_asset: gains to_amount, minus fee if fee_side = 'to'
  if p_to_asset_id is not null and p_to_amount is not null then
    if p_fee_side = 'to' and p_fee_amount is not null and p_fee_amount > 0 then
      update assets set amount = amount + p_to_amount - p_fee_amount, updated_at = now()
        where id = p_to_asset_id;
    else
      update assets set amount = amount + p_to_amount, updated_at = now()
        where id = p_to_asset_id;
    end if;
  end if;

  -- from_asset: loses from_amount, plus fee if fee_side = 'from'
  if p_from_asset_id is not null and p_from_amount is not null then
    if p_fee_side = 'from' and p_fee_amount is not null and p_fee_amount > 0 then
      update assets set amount = amount - p_from_amount - p_fee_amount, updated_at = now()
        where id = p_from_asset_id;
    else
      update assets set amount = amount - p_from_amount, updated_at = now()
        where id = p_from_asset_id;
    end if;
  end if;

  return v_id;
end;
$$;

-- ── reverse_and_delete_transaction ─────────────────────────────────────────────
-- Net-delta per unique asset — no intermediate state, no ordering issue.

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

  -- to_asset: reverse gain (subtract to_amount), restore fee if fee_side = 'to'
  if t.to_asset_id is not null and t.to_amount is not null then
    if t.fee_side = 'to' and t.fee_amount is not null and t.fee_amount > 0 then
      update assets set amount = amount - t.to_amount + t.fee_amount, updated_at = now()
        where id = t.to_asset_id;
    else
      update assets set amount = amount - t.to_amount, updated_at = now()
        where id = t.to_asset_id;
    end if;
  end if;

  -- from_asset: restore loss (add from_amount back), restore fee if fee_side = 'from'
  if t.from_asset_id is not null and t.from_amount is not null then
    if t.fee_side = 'from' and t.fee_amount is not null and t.fee_amount > 0 then
      update assets set amount = amount + t.from_amount + t.fee_amount, updated_at = now()
        where id = t.from_asset_id;
    else
      update assets set amount = amount + t.from_amount, updated_at = now()
        where id = t.from_asset_id;
    end if;
  end if;

  delete from transactions where id = p_transaction_id;
end;
$$;

-- ── update_transaction ─────────────────────────────────────────────────────────
-- Single-pass net-delta per unique asset.
-- fee_side is immutable (not a parameter); uses stored t.fee_side.
-- entry_mode is immutable (not a parameter); uses stored t.entry_mode.
--
-- Delta formulas:
--   to_asset:   (p_to_amount   - t.to_amount)   + if fee_side='to':   (t.fee_amount - p_fee_amount)
--   from_asset: (t.from_amount - p_from_amount) + if fee_side='from':  (t.fee_amount - p_fee_amount)

create or replace function update_transaction(
  p_transaction_id uuid,
  p_date           timestamptz,
  p_to_amount      numeric,
  p_from_amount    numeric,
  p_fee_amount     numeric,
  p_exchange_rate  numeric,
  p_notes          text
) returns void language plpgsql security definer
set search_path = public
as $$
declare
  t            transactions%rowtype;
  v_to_delta   numeric;
  v_from_delta numeric;
begin
  select * into t from transactions where id = p_transaction_id;
  if not found then raise exception 'transaction not found'; end if;

  -- Compute and apply to_asset delta in one UPDATE
  if t.to_asset_id is not null then
    v_to_delta := coalesce(p_to_amount, 0) - coalesce(t.to_amount, 0);
    if t.fee_side = 'to' then
      v_to_delta := v_to_delta + coalesce(t.fee_amount, 0) - coalesce(p_fee_amount, 0);
    end if;
    update assets set amount = amount + v_to_delta, updated_at = now()
      where id = t.to_asset_id;
  end if;

  -- Compute and apply from_asset delta in one UPDATE
  if t.from_asset_id is not null then
    v_from_delta := coalesce(t.from_amount, 0) - coalesce(p_from_amount, 0);
    if t.fee_side = 'from' then
      v_from_delta := v_from_delta + coalesce(t.fee_amount, 0) - coalesce(p_fee_amount, 0);
    end if;
    update assets set amount = amount + v_from_delta, updated_at = now()
      where id = t.from_asset_id;
  end if;

  update transactions set
    date          = p_date,
    to_amount     = p_to_amount,
    from_amount   = p_from_amount,
    fee_amount    = p_fee_amount,
    exchange_rate = p_exchange_rate,
    notes         = p_notes,
    updated_at    = now()
  where id = p_transaction_id;
end;
$$;
