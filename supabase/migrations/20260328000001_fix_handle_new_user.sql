-- 00004b_fix_handle_new_user.sql
-- Supabase Cloud requires an explicit search_path on security definer functions.
-- Without it, the function cannot resolve unqualified table names like "profiles".
create or replace function handle_new_user()
returns trigger language plpgsql
security definer
set search_path = public
as $$
begin
  insert into profiles (id, display_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    new.email
  );
  return new;
end;
$$;

-- Apply the same fix to the RLS helpers
create or replace function is_household_member(hid uuid)
returns boolean language sql
security definer
set search_path = public
stable as $$
  select exists (
    select 1 from household_members
    where household_id = hid and user_id = auth.uid()
  );
$$;

create or replace function get_household_role(hid uuid)
returns text language sql
security definer
set search_path = public
stable as $$
  select role from household_members
  where household_id = hid and user_id = auth.uid()
  limit 1;
$$;
