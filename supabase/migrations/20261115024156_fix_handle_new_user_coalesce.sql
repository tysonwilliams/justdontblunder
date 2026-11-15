-- Signup returned 500: pg_catalog.coalesce is not a function.
-- coalesce is SQL syntax. This matches the hosted migration, which is already applied.

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    nullif(pg_catalog.left(coalesce(new.raw_user_meta_data ->> 'display_name', ''), 80), '')
  );
  return new;
end;
$$;
