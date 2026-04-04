-- Add gain/loss columns to snapshot_assets, mirroring the value_try/usd/eur pattern.
-- Only trade and interest transactions contribute to G/L; all other types are excluded.
-- Nullable — existing snapshots remain valid.
alter table snapshot_assets
  add column gain_loss_try numeric,
  add column gain_loss_usd numeric,
  add column gain_loss_eur numeric;
