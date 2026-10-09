-- Minimal stand-in for the parts of a hosted Supabase project the migrations rely on
-- (roles, auth.users, auth.uid()). Used ONLY by supabase/scripts/test-sql.sh on vanilla Postgres.
do $$ begin  -- roles are cluster-wide; the runner creates several databases
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end $$;
grant usage on schema public to anon, authenticated, service_role;

create schema auth;
grant usage on schema auth to anon, authenticated, service_role;

create table auth.users (
  id uuid primary key default gen_random_uuid(),
  is_anonymous boolean not null default true,
  created_at timestamptz not null default now()
);

create function auth.uid() returns uuid
language sql stable as $$
  select nullif(
    coalesce(
      current_setting('request.jwt.claim.sub', true),
      current_setting('request.jwt.claims', true)::jsonb ->> 'sub'
    ), ''
  )::uuid
$$;
grant execute on function auth.uid() to anon, authenticated, service_role;
