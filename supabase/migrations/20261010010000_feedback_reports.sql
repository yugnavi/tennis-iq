-- User-submitted suggestions, recommendations, and bug reports.
-- Writes go through submit_feedback so each row is tied to auth.uid().

create table public.feedback_reports (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  kind        text not null check (kind in ('suggestion', 'recommendation', 'bug')),
  message     text not null check (length(message) between 5 and 2000),
  contact     text check (contact is null or length(contact) <= 120),
  page_url    text check (page_url is null or length(page_url) <= 500),
  user_agent  text check (user_agent is null or length(user_agent) <= 500),
  status      text not null default 'new' check (status in ('new', 'reviewed', 'closed')),
  created_at  timestamptz not null default now()
);

create index feedback_reports_created_idx on public.feedback_reports (created_at desc);
create index feedback_reports_kind_idx on public.feedback_reports (kind, created_at desc);

alter table public.feedback_reports enable row level security;
revoke all on public.feedback_reports from anon, authenticated;

create function public.submit_feedback(
  p_kind       text,
  p_message    text,
  p_contact    text default null,
  p_page_url   text default null,
  p_user_agent text default null
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  u    uuid := public._require_user();
  v_id uuid;
  v_message text := btrim(p_message);
  v_contact text := nullif(btrim(coalesce(p_contact, '')), '');
  v_page_url text := nullif(left(btrim(coalesce(p_page_url, '')), 500), '');
  v_user_agent text := nullif(left(btrim(coalesce(p_user_agent, '')), 500), '');
begin
  if p_kind not in ('suggestion', 'recommendation', 'bug') then
    raise exception 'invalid feedback kind' using errcode = '22023';
  end if;
  if length(v_message) < 5 or length(v_message) > 2000 then
    raise exception 'feedback message must be 5 to 2000 characters' using errcode = '22023';
  end if;
  if v_contact is not null and length(v_contact) > 120 then
    raise exception 'contact is too long' using errcode = '22023';
  end if;

  insert into public.feedback_reports (user_id, kind, message, contact, page_url, user_agent)
  values (u, p_kind, v_message, v_contact, v_page_url, v_user_agent)
  returning id into v_id;
  return v_id;
end $$;

revoke execute on function public.submit_feedback(text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.submit_feedback(text, text, text, text, text) to authenticated;
