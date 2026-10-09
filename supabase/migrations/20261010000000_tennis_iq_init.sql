-- Tennis IQ v0.1 — schema, RLS, and server-authoritative scoring RPCs.
--
-- Trust model: the browser holds only the anon/publishable key. Anonymous sign-in
-- gives each device an `authenticated` session. Clients may read approved,
-- REDACTED challenges and their own rows; every XP/TIQ/battle/daily write goes
-- through the SECURITY DEFINER RPCs below, which derive the user from auth.uid().
-- Reward constants mirror REWARDS / TIEBREAK / DAILY_STRIDE in src/types/index.ts.

-- ---------------------------------------------------------------- tables
create table public.challenges (
  id                text primary key check (id ~ '^(rookie|challenger|strategist)-[0-9]{2}$'),
  track             text not null check (track in ('rookie', 'challenger', 'strategist')),
  kind              text not null check (kind in ('rules', 'court-position', 'shot-choice')),
  difficulty        smallint not null check (difficulty between 1 and 3),
  prompt            text not null check (length(prompt) > 0),
  options           jsonb not null check (jsonb_typeof(options) = 'array' and jsonb_array_length(options) = 4),
  correct_option_id text not null,
  explanation       text not null check (length(explanation) > 0),
  court             jsonb,
  source_name       text not null,
  source_url        text not null,
  approved          boolean not null default false,
  coach_review_required boolean not null default true,  -- editorial flag: needs expert coach verification
  created_at        timestamptz not null default now(),
  constraint correct_option_in_options check (
    jsonb_path_exists(options, '$[*] ? (@.id == $c)', jsonb_build_object('c', correct_option_id))
  )
);
create unique index challenges_prompt_key on public.challenges (prompt);

create table public.profiles (
  user_id      uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default 'Player' check (length(display_name) between 1 and 24),
  xp           integer not null default 0 check (xp >= 0),
  tiq_rating   integer not null default 500 check (tiq_rating >= 0),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table public.battle_sessions (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users (id) on delete cascade,
  player_points   smallint not null default 0 check (player_points >= 0),
  opponent_points smallint not null default 0 check (opponent_points >= 0),
  status          text not null default 'active' check (status in ('active', 'won', 'lost', 'abandoned')),
  bonus_awarded   boolean not null default false,
  started_at      timestamptz not null default now(),
  finished_at     timestamptz
);
create index battle_sessions_user_idx on public.battle_sessions (user_id, started_at desc);

create table public.attempts (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users (id) on delete cascade,
  challenge_id     text not null references public.challenges (id),
  mode             text not null check (mode in ('academy', 'battle', 'daily')),
  battle_id        uuid references public.battle_sessions (id) on delete set null,
  chosen_option_id text not null,
  is_correct       boolean not null,
  ranked           boolean not null,   -- first-ever attempt at this challenge => TIQ moves
  rewarded         boolean not null,   -- first correct answer to this challenge => +20 XP
  attempted_on     date not null default ((now() at time zone 'utc')::date),
  created_at       timestamptz not null default now()
);
create index attempts_user_idx on public.attempts (user_id, created_at desc);
-- Idempotency backstops (the RPC also serialises per user).
create unique index attempts_one_ranked on public.attempts (user_id, challenge_id) where ranked;
create unique index attempts_one_reward on public.attempts (user_id, challenge_id) where rewarded;

create table public.daily_completions (
  user_id          uuid not null references auth.users (id) on delete cascade,
  puzzle_date      date not null,
  challenge_id     text not null references public.challenges (id),
  first_attempt_id uuid not null references public.attempts (id),
  created_at       timestamptz not null default now(),
  primary key (user_id, puzzle_date)
);

-- ---------------------------------------------------------------- RLS + grants
alter table public.challenges        enable row level security;
alter table public.profiles          enable row level security;
alter table public.battle_sessions   enable row level security;
alter table public.attempts          enable row level security;
alter table public.daily_completions enable row level security;

revoke all on public.challenges, public.profiles, public.battle_sessions,
              public.attempts, public.daily_completions from anon, authenticated;

-- Challenges: column-level grant hides correct_option_id (and explanation, so the
-- answer can't be inferred pre-submit). Clients must select explicit columns.
grant select (id, track, kind, difficulty, prompt, options, court, source_name, source_url)
  on public.challenges to anon, authenticated;
create policy challenges_public_read on public.challenges
  for select to anon, authenticated using (approved);

-- Private rows: owner read only. All writes go through RPCs below.
grant select on public.profiles, public.battle_sessions, public.attempts, public.daily_completions
  to authenticated;
grant update (display_name) on public.profiles to authenticated;

create policy profiles_own_read   on public.profiles for select to authenticated using (user_id = (select auth.uid()));
create policy profiles_own_rename on public.profiles for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy battles_own_read    on public.battle_sessions   for select to authenticated using (user_id = (select auth.uid()));
create policy attempts_own_read   on public.attempts          for select to authenticated using (user_id = (select auth.uid()));
create policy daily_own_read      on public.daily_completions for select to authenticated using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------- helpers
create function public.utc_today() returns date
language sql stable set search_path = '' as $$ select (now() at time zone 'utc')::date $$;

-- Must match src/game/daily.ts: approved ids sorted bytewise (COLLATE "C"),
-- index = (days since 1970-01-01 * DAILY_STRIDE(7)) mod N.
create function public.daily_challenge_id(p_date date) returns text
language sql stable security definer set search_path = '' as $$
  select id from public.challenges where approved
  order by id collate "C"
  offset ((p_date - date '1970-01-01')::bigint * 7)
         % nullif((select count(*) from public.challenges where approved), 0)
  limit 1
$$;

-- Redacted JSON view of one challenge (camelCase keys, matching PublicChallenge).
create function public._public_challenge(c public.challenges) returns jsonb
language sql immutable set search_path = '' as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'id', c.id, 'track', c.track, 'kind', c.kind, 'difficulty', c.difficulty,
    'prompt', c.prompt, 'options', c.options, 'court', c.court,
    'sourceName', c.source_name, 'sourceUrl', c.source_url))
$$;

-- Positive-only streaks over the user's daily completions (gaps-and-islands).
create function public._streaks(p_user uuid, p_today date, out current_streak int, out best_streak int)
language sql stable security definer set search_path = '' as $$
  with d as (
    select puzzle_date, puzzle_date - (row_number() over (order by puzzle_date))::int as grp
      from public.daily_completions where user_id = p_user
  ), runs as (
    select max(puzzle_date) as last_day, count(*)::int as len from d group by grp
  )
  select coalesce((select len from runs where last_day >= p_today - 1 order by last_day desc limit 1), 0),
         coalesce((select max(len) from runs), 0)
$$;

-- Lock (creating if needed) the caller's profile row; serialises concurrent RPCs per user.
create function public._lock_profile(p_user uuid) returns public.profiles
language plpgsql security definer set search_path = '' as $$
declare r public.profiles;
begin
  insert into public.profiles (user_id) values (p_user) on conflict do nothing;
  select * into r from public.profiles where user_id = p_user for update;
  return r;
end $$;
revoke execute on function public._lock_profile(uuid) from public, anon, authenticated;

create function public._require_user() returns uuid
language plpgsql stable set search_path = '' as $$
declare u uuid := auth.uid();
begin
  if u is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  return u;
end $$;

-- ---------------------------------------------------------------- RPCs
create function public.ensure_profile() returns public.profiles
language plpgsql security definer set search_path = '' as $$
begin
  return public._lock_profile(public._require_user());
end $$;

create function public.start_battle() returns public.battle_sessions
language plpgsql security definer set search_path = '' as $$
declare u uuid := public._require_user(); b public.battle_sessions;
begin
  perform public._lock_profile(u);
  update public.battle_sessions set status = 'abandoned', finished_at = now()
    where user_id = u and status = 'active';
  insert into public.battle_sessions (user_id) values (u) returning * into b;
  return b;
end $$;

create function public.abandon_battle(p_battle_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.battle_sessions set status = 'abandoned', finished_at = now()
   where id = p_battle_id and user_id = public._require_user() and status = 'active';
end $$;

create function public.submit_answer(
  p_challenge_id text,
  p_choice_id    text,
  p_mode         text,
  p_battle_id    uuid default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  u          uuid := public._require_user();
  prof       public.profiles;
  ch         public.challenges;
  b          public.battle_sessions;
  v_correct  boolean;
  v_ranked   boolean;
  v_rewarded boolean;
  v_attempt  uuid;
  v_today    date := public.utc_today();
  v_xp       integer := 0;
  v_tiq      integer := 0;
  v_awards   jsonb := '[]'::jsonb;
  v_daily    jsonb;
  v_first    boolean;
  v_old_tiq  integer;
begin
  if p_mode not in ('academy', 'battle', 'daily') then
    raise exception 'invalid mode' using errcode = '22023';
  end if;

  prof := public._lock_profile(u);   -- per-user serialisation point

  select * into ch from public.challenges where id = p_challenge_id and approved;
  if not found then raise exception 'unknown challenge' using errcode = '22023'; end if;
  if not jsonb_path_exists(ch.options, '$[*] ? (@.id == $c)', jsonb_build_object('c', p_choice_id)) then
    raise exception 'option does not belong to challenge' using errcode = '22023';
  end if;

  if p_mode = 'battle' then
    select * into b from public.battle_sessions
     where id = p_battle_id and user_id = u for update;
    if not found or b.status <> 'active' then
      raise exception 'battle not active' using errcode = '22023';
    end if;
  elsif p_mode = 'daily' and p_challenge_id <> public.daily_challenge_id(v_today) then
    raise exception 'not today''s daily challenge' using errcode = '22023';
  end if;

  v_correct  := (p_choice_id = ch.correct_option_id);
  v_ranked   := not exists (select 1 from public.attempts where user_id = u and challenge_id = ch.id and ranked);
  v_rewarded := v_correct and not exists (select 1 from public.attempts where user_id = u and challenge_id = ch.id and rewarded);

  insert into public.attempts (user_id, challenge_id, mode, battle_id, chosen_option_id, is_correct, ranked, rewarded, attempted_on)
  values (u, ch.id, p_mode, case when p_mode = 'battle' then b.id end, p_choice_id, v_correct, v_ranked, v_rewarded, v_today)
  returning id into v_attempt;

  if v_rewarded then
    v_xp := v_xp + 20;
    v_awards := v_awards || jsonb_build_object('kind', 'first_correct', 'xp', 20);
  end if;
  if v_ranked then
    v_tiq := case when v_correct then 15 else -5 end;
  end if;

  if p_mode = 'daily' then
    insert into public.daily_completions (user_id, puzzle_date, challenge_id, first_attempt_id)
    values (u, v_today, ch.id, v_attempt)
    on conflict do nothing;
    v_first := found;
    if v_first then
      v_xp := v_xp + 10;
      v_awards := v_awards || jsonb_build_object('kind', 'daily_first_completion', 'xp', 10);
    end if;
    v_daily := jsonb_build_object('puzzle_date', v_today, 'first_completion', v_first);
  end if;

  if p_mode = 'battle' then
    if v_correct then b.player_points := b.player_points + 1;
    else b.opponent_points := b.opponent_points + 1; end if;
    if greatest(b.player_points, b.opponent_points) >= 7
       and abs(b.player_points - b.opponent_points) >= 2 then
      b.status := case when b.player_points > b.opponent_points then 'won' else 'lost' end;
      b.finished_at := now();
      if not b.bonus_awarded then
        b.bonus_awarded := true;
        v_xp := v_xp + 10;
        v_awards := v_awards || jsonb_build_object('kind', 'battle_complete', 'xp', 10);
      end if;
    end if;
    update public.battle_sessions
       set player_points = b.player_points, opponent_points = b.opponent_points,
           status = b.status, finished_at = b.finished_at, bonus_awarded = b.bonus_awarded
     where id = b.id;
  end if;

  v_old_tiq := prof.tiq_rating;
  update public.profiles
     set xp = xp + v_xp,
         tiq_rating = greatest(0, tiq_rating + v_tiq),
         updated_at = now()
   where user_id = u
  returning * into prof;

  return jsonb_build_object(
    'attempt_id',        v_attempt,
    'is_correct',        v_correct,
    'correct_option_id', ch.correct_option_id,
    'explanation',       ch.explanation,
    'ranked',            v_ranked,
    'user_id',           prof.user_id,
    'display_name',      prof.display_name,
    'xp',                prof.xp,
    'tiq_rating',        prof.tiq_rating,
    'xp_delta',          v_xp,
    'tiq_delta',         prof.tiq_rating - v_old_tiq,
    'awards',            v_awards,
    'battle',            case when p_mode = 'battle' then jsonb_build_object(
                           'id', b.id, 'player_points', b.player_points,
                           'opponent_points', b.opponent_points, 'status', b.status) end,
    'daily',             v_daily
  );
end $$;

create function public.get_daily() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  u       uuid := public._require_user();
  v_today date := public.utc_today();
  ch      public.challenges;
  st      record;
begin
  select * into ch from public.challenges where id = public.daily_challenge_id(v_today);
  if not found then raise exception 'no approved challenges' using errcode = 'P0002'; end if;
  select * into st from public._streaks(u, v_today);
  return jsonb_build_object(
    'date',              v_today,
    'challenge',         public._public_challenge(ch),
    'already_completed', exists (select 1 from public.daily_completions where user_id = u and puzzle_date = v_today),
    'current_streak',    st.current_streak,
    'best_streak',       st.best_streak
  );
end $$;

create function public.get_progress() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  u    uuid := public._require_user();
  prof public.profiles;
  st   record;
  v_by jsonb;
begin
  insert into public.profiles (user_id) values (u) on conflict do nothing;
  select * into prof from public.profiles where user_id = u;
  select * into st from public._streaks(u, public.utc_today());

  select jsonb_object_agg(t.track, jsonb_build_object(
           'attempted', coalesce(a.attempted, 0),
           'correct',   coalesce(a.correct, 0),
           'mastered',  coalesce(a.mastered, 0),
           'total',     t.total))
    into v_by
    from (select track, count(*)::int as total from public.challenges where approved group by track
          union all select x, 0 from unnest(array['rookie','challenger','strategist']) x
          where not exists (select 1 from public.challenges where approved and track = x)) t
    left join (
      select c.track,
             count(*)::int                                            as attempted,
             count(*) filter (where a.is_correct)::int                as correct,
             count(distinct a.challenge_id) filter (where a.is_correct)::int as mastered
        from public.attempts a join public.challenges c on c.id = a.challenge_id
       where a.user_id = u group by c.track
    ) a on a.track = t.track;

  return jsonb_build_object(
    'user_id',           prof.user_id,
    'display_name',      prof.display_name,
    'xp',                prof.xp,
    'tiq_rating',        prof.tiq_rating,
    'total_attempts',    (select count(*) from public.attempts where user_id = u),
    'total_correct',     (select count(*) from public.attempts where user_id = u and is_correct),
    'by_track',          v_by,
    'battles_played',    (select count(*) from public.battle_sessions where user_id = u and status in ('won', 'lost')),
    'battles_won',       (select count(*) from public.battle_sessions where user_id = u and status = 'won'),
    'daily_completions', (select count(*) from public.daily_completions where user_id = u),
    'current_streak',    st.current_streak,
    'best_streak',       st.best_streak
  );
end $$;

-- Function grants: nothing callable by default; only signed-in (incl. anonymous) users.
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function public.ensure_profile()                         to authenticated;
grant execute on function public.start_battle()                           to authenticated;
grant execute on function public.abandon_battle(uuid)                     to authenticated;
grant execute on function public.submit_answer(text, text, text, uuid)    to authenticated;
grant execute on function public.get_daily()                              to authenticated;
grant execute on function public.get_progress()                           to authenticated;
grant execute on function public.daily_challenge_id(date)                 to anon, authenticated;
grant execute on function public.utc_today()                              to anon, authenticated;

-- New auth users (anonymous sign-in) get a profile immediately.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (user_id) values (new.id) on conflict do nothing;
  return new;
end $$;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();
