-- Crash reports from the app. Insert-only for anon and authenticated.
-- The row is the message, the stack, the route, the app version, and the platform.
-- There is no account id, no email column, and no IP column.
-- Do not run supabase db push. Apply this after review.

create table public.client_errors (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default pg_catalog.now(),
  message text not null,
  stack text,
  route text,
  app_version text not null,
  platform text not null,
  constraint client_errors_message_length check (char_length(message) between 1 and 500),
  constraint client_errors_stack_length check (stack is null or char_length(stack) between 1 and 4000),
  constraint client_errors_route_path check (
    route is null or (
      char_length(route) between 1 and 200
      and route ~ '^/[A-Za-z0-9._~/-]*$'
    )
  ),
  constraint client_errors_app_version_length check (char_length(app_version) between 1 and 40),
  constraint client_errors_platform_check check (platform in ('web', 'ios', 'android')),
  constraint client_errors_message_plain check (
    message !~ '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}'
  ),
  constraint client_errors_stack_plain check (
    stack is null or stack !~ '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}'
  )
);

comment on table public.client_errors is
  'Crash reports. Message, stack, route, app version, and platform. No account id, mail address, or client address column.';

create index client_errors_created_at_idx on public.client_errors (created_at desc);

alter table public.client_errors enable row level security;

revoke all on table public.client_errors from public, anon, authenticated;
grant insert on table public.client_errors to anon, authenticated;

revoke all on sequence public.client_errors_id_seq from public, anon, authenticated;
grant usage on sequence public.client_errors_id_seq to anon, authenticated;

create policy client_errors_insert_anon
  on public.client_errors
  for insert
  to anon
  with check (true);

create policy client_errors_insert_authenticated
  on public.client_errors
  for insert
  to authenticated
  with check (true);
