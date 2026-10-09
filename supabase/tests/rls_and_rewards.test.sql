-- Server-authoritative scoring, RLS and grant tests. Run by supabase/scripts/test-sql.sh
-- after _stub_supabase.sql, the migrations and fixtures.sql. Any failed ASSERT aborts the run.
\set ON_ERROR_STOP 1
\set QUIET 1

-- Expect a statement to fail with a given SQLSTATE.
create function tests.expect_error(p_sql text, p_state text) returns void
language plpgsql as $$
begin
  execute p_sql;
  raise exception 'expected % from: %', p_state, p_sql;
exception when others then
  if sqlstate <> p_state then
    raise exception 'expected % but got % (%) from: %', p_state, sqlstate, sqlerrm, p_sql;
  end if;
end $$;
grant execute on function tests.expect_error(text, text) to anon, authenticated;

\echo 'daily formula: bytewise order, (days * 7) mod N'
do $$ begin
  assert public.daily_challenge_id('1970-01-01') = 'challenger-01', 'day 0 -> index 0';
  assert public.daily_challenge_id('1970-01-02') = 'challenger-08', 'day 1 -> index 7';
  -- sorted: challenger-01..10, rookie-01..10, strategist-01..10
  assert public.daily_challenge_id('1970-01-06') = 'challenger-06', 'day 5 -> index 35 mod 30 = 5';
  assert public.daily_challenge_id('1970-01-03') = 'rookie-05', 'day 2 -> index 14';
  -- 2026-10-10 is day 20736; 20736*7 = 145152; mod 30 = 12 -> rookie-03
  assert public.daily_challenge_id('2026-10-10') = 'rookie-03', '2026-10-10 -> index 12';
  assert public.daily_challenge_id('2026-10-10') is distinct from public.daily_challenge_id('2026-10-11'), 'changes by date';
end $$;

-- ===================================================================== user 1
set role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false) \gset

\echo 'profile created by auth trigger with defaults'
do $$ declare p public.profiles; begin
  p := public.ensure_profile();
  assert p.xp = 0 and p.tiq_rating = 500 and p.display_name = 'Player', 'defaults';
end $$;

\echo 'academy: first correct = +20 XP, +15 TIQ; retry unranked and unrewarded'
do $$ declare r jsonb; begin
  r := public.submit_answer('rookie-01', 'a', 'academy');
  assert (r->>'is_correct')::bool and (r->>'ranked')::bool, 'correct+ranked';
  assert (r->>'xp')::int = 20 and (r->>'tiq_rating')::int = 515, 'xp 20 tiq 515';
  assert (r->>'xp_delta')::int = 20 and (r->>'tiq_delta')::int = 15, 'deltas';
  assert r->>'correct_option_id' = 'a' and r->>'explanation' is not null, 'feedback returned';
  assert r->>'user_id' = '11111111-1111-1111-1111-111111111111' and r->>'display_name' = 'Player', 'identity';
  r := public.submit_answer('rookie-01', 'a', 'academy');
  assert not (r->>'ranked')::bool and (r->>'xp_delta')::int = 0 and (r->>'tiq_delta')::int = 0, 'retry: nothing';
  assert jsonb_array_length(r->'awards') = 0, 'retry: no awards';
end $$;

\echo 'academy: first wrong = -5 TIQ, later correct = +20 XP but no TIQ'
do $$ declare r jsonb; begin
  r := public.submit_answer('rookie-02', 'b', 'academy');
  assert not (r->>'is_correct')::bool and (r->>'tiq_delta')::int = -5 and (r->>'xp_delta')::int = 0, 'wrong first';
  r := public.submit_answer('rookie-02', 'a', 'academy');
  assert (r->>'xp_delta')::int = 20 and (r->>'tiq_delta')::int = 0 and not (r->>'ranked')::bool, 'correct later';
end $$;

\echo 'validation: foreign option, unknown/unapproved challenge, bad mode'
select tests.expect_error($$select public.submit_answer('rookie-03', 'z', 'academy')$$, '22023') \g /dev/null
select tests.expect_error($$select public.submit_answer('rookie-03', 'a', 'cheat')$$, '22023') \g /dev/null
select tests.expect_error($$select public.submit_answer('nope-01', 'a', 'academy')$$, '22023') \g /dev/null
select tests.expect_error($$select public.submit_answer('rookie-99', 'a', 'academy')$$, '22023') \g /dev/null

\echo 'daily: wrong challenge rejected; first completion +10 XP once (even if wrong); retry no reward'
do $$ declare r jsonb; today_id text := public.daily_challenge_id(public.utc_today()); other text; d jsonb; begin
  select id into other from public.challenges where id <> today_id limit 1;  -- RLS limits to approved
  perform tests.expect_error(format('select public.submit_answer(%L, %L, %L)', other, 'a', 'daily'), '22023');
  d := public.get_daily();
  assert d->'challenge'->>'id' = today_id and not (d->>'already_completed')::bool, 'get_daily before';
  assert d->'challenge' ? 'sourceUrl' and not (d->'challenge' ? 'correctOptionId')
     and not (d->'challenge' ? 'correct_option_id') and not (d->'challenge' ? 'explanation'), 'daily challenge redacted';
  r := public.submit_answer(today_id, 'b', 'daily');
  assert (r->'daily'->>'first_completion')::bool and r->'awards' @> '[{"kind":"daily_first_completion","xp":10}]', 'first daily';
  r := public.submit_answer(today_id, 'b', 'daily');
  assert not (r->'daily'->>'first_completion')::bool and (r->>'xp_delta')::int = 0, 'second daily';
  d := public.get_daily();
  assert (d->>'already_completed')::bool and (d->>'current_streak')::int = 1 and (d->>'best_streak')::int = 1, 'get_daily after';
end $$;

\echo 'tie-break: 7-0 ends; bonus +10 once; finished battle rejects answers'
do $$ declare b public.battle_sessions; r jsonb; begin
  b := public.start_battle();
  assert b.status = 'active' and b.player_points = 0, 'new battle';
  r := tests.play(b.id, 'WWWWWWW');
  assert r->'battle'->>'status' = 'won' and (r->'battle'->>'player_points')::int = 7, '7-0 won';
  assert r->'awards' @> '[{"kind":"battle_complete","xp":10}]', 'bonus';
  perform tests.expect_error(format('select public.submit_answer(%L,%L,%L,%L)', 'rookie-01', 'a', 'battle', b.id), '22023');
  perform tests.expect_error($q$select public.submit_answer('rookie-01', 'a', 'battle', null)$q$, '22023');
end $$;

\echo 'tie-break: no win at 7-6, 7-5 / 8-6 / 10-8 end correctly, losses too'
do $$ declare b public.battle_sessions; r jsonb; begin
  b := public.start_battle();
  r := tests.play(b.id, 'WWWWWWLLLLLLW');            -- 7-6
  assert r->'battle'->>'status' = 'active', 'no false win at 7-6';
  r := tests.play(b.id, 'W');                        -- 8-6 (sequence restarts at challenge 1; fine)
  assert r->'battle'->>'status' = 'won' and r->'battle'->>'player_points' = '8', '8-6 won';

  b := public.start_battle();
  r := tests.play(b.id, 'WWWWWLLLLLWW');             -- 7-5
  assert r->'battle'->>'status' = 'won' and r->'battle'->>'opponent_points' = '5', '7-5 won';

  b := public.start_battle();
  r := tests.play(b.id, 'WWWWWWLLLLLLWLWLWLLL');      -- 6-6 … 9-9, 9-10, 9-11
  assert r->'battle'->>'status' = 'lost', 'long tiebreak lost';

  b := public.start_battle();
  r := tests.play(b.id, 'WWWWWWLLLLLLWLWLWW');        -- 6-6, 7-6, 7-7, 8-7, 8-8, 9-8, 10-8
  assert r->'battle'->>'status' = 'won' and r->'battle'->>'player_points' = '10'
     and r->'battle'->>'opponent_points' = '8', '10-8 won';
end $$;

\echo 'tie-break: starting a new battle abandons the active one; abandon is idempotent, no bonus'
do $$ declare b1 public.battle_sessions; b2 public.battle_sessions; xp0 int; begin
  b1 := public.start_battle();
  perform tests.play(b1.id, 'WL');
  b2 := public.start_battle();
  assert (select status from public.battle_sessions where id = b1.id) = 'abandoned', 'auto-abandoned';
  select xp into xp0 from public.profiles;
  perform public.abandon_battle(b2.id);
  perform public.abandon_battle(b2.id);
  assert (select status from public.battle_sessions where id = b2.id) = 'abandoned', 'abandoned';
  assert (select xp from public.profiles) = xp0, 'no bonus for abandon';
end $$;

\echo 'progress summary'
do $$ declare p jsonb; begin
  p := public.get_progress();
  assert (p->'by_track'->'rookie'->>'total')::int = 10, 'rookie total excludes unapproved';
  assert (p->'by_track'->'rookie'->>'mastered')::int = (
    select count(distinct a.challenge_id) from public.attempts a
     where a.is_correct and a.challenge_id like 'rookie-%') and (p->'by_track'->'rookie'->>'mastered')::int >= 2, 'rookie mastered';
  assert (p->>'total_attempts')::int = (select count(*) from public.attempts), 'attempt count';
  assert (p->>'battles_won')::int = 4 and (p->>'battles_played')::int = 5, 'battles';
  assert (p->>'daily_completions')::int = 1, 'dailies';
  assert (p->>'xp')::int = (select xp from public.profiles), 'xp matches';
end $$;

\echo 'RLS / grants: no answers, no direct writes'
select tests.expect_error($$select correct_option_id from public.challenges$$, '42501') \g /dev/null
select tests.expect_error($$select explanation from public.challenges$$, '42501') \g /dev/null
select tests.expect_error($$select * from public.challenges$$, '42501') \g /dev/null
select tests.expect_error($$update public.profiles set xp = 99999$$, '42501') \g /dev/null
select tests.expect_error($$update public.profiles set tiq_rating = 9999$$, '42501') \g /dev/null
select tests.expect_error($$insert into public.attempts (user_id, challenge_id, mode, chosen_option_id, is_correct, ranked, rewarded) values (auth.uid(), 'rookie-05', 'academy', 'a', true, true, true)$$, '42501') \g /dev/null
select tests.expect_error($$insert into public.daily_completions (user_id, puzzle_date, challenge_id, first_attempt_id) values (auth.uid(), '2000-01-01', 'rookie-01', gen_random_uuid())$$, '42501') \g /dev/null
select tests.expect_error($$update public.battle_sessions set player_points = 7$$, '42501') \g /dev/null
select tests.expect_error($$delete from public.attempts$$, '42501') \g /dev/null
select tests.expect_error($$select public._lock_profile(auth.uid())$$, '42501') \g /dev/null
do $$ begin
  update public.profiles set display_name = 'Ace';
  assert (select display_name from public.profiles) = 'Ace', 'can rename self';
  assert (select count(*) from (select id from public.challenges) s) = 30, 'sees 30 approved only';
end $$;

-- ===================================================================== user 2 (isolation)
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', false) \gset
\echo 'isolation: user 2 sees only own rows'
do $$ begin
  assert (select count(*) from public.profiles) = 1, 'own profile only';
  assert (select user_id from public.profiles) = '22222222-2222-2222-2222-222222222222', 'it is mine';
  assert (select count(*) from public.attempts) = 0, 'no foreign attempts';
  assert (select count(*) from public.battle_sessions) = 0, 'no foreign battles';
  assert (select count(*) from public.daily_completions) = 0, 'no foreign dailies';
  update public.profiles set display_name = 'Hacker' where user_id = '11111111-1111-1111-1111-111111111111';
end $$;
reset role;
do $$ begin
  assert (select display_name from public.profiles where user_id = '11111111-1111-1111-1111-111111111111') = 'Ace',
    'cannot rename another user';
end $$;
set role authenticated;
select tests.expect_error(
  $$select public.submit_answer('rookie-01', 'a', 'battle', (select id from public.battle_sessions limit 1))$$, '22023') \g /dev/null

\echo 'TIQ floor at 0'
reset role;
update public.profiles set tiq_rating = 3 where user_id = '22222222-2222-2222-2222-222222222222';
set role authenticated;
do $$ declare r jsonb; begin
  r := public.submit_answer('strategist-01', 'b', 'academy');
  assert (r->>'tiq_rating')::int = 0 and (r->>'tiq_delta')::int = -3, 'floored';
end $$;

-- ===================================================================== streaks
reset role;
\echo 'streaks: positive-only, current ends today or yesterday'
do $$ declare u uuid := '33333333-3333-3333-3333-333333333333'; t date := public.utc_today(); a uuid; d date; s record; begin
  foreach d in array array[t - 1, t - 2, t - 3, t - 6, t - 7, t - 8, t - 9, t - 20] loop
    insert into public.attempts (user_id, challenge_id, mode, chosen_option_id, is_correct, ranked, rewarded, attempted_on)
    values (u, 'rookie-01', 'daily', 'a', true, false, false, d) returning id into a;
    insert into public.daily_completions values (u, d, 'rookie-01', a);
  end loop;
  select * into s from public._streaks(u, t);
  assert s.current_streak = 3 and s.best_streak = 4, format('got %s/%s', s.current_streak, s.best_streak);
  select * into s from public._streaks(u, t + 2);
  assert s.current_streak = 0 and s.best_streak = 4, 'missed day restarts current, keeps best';
end $$;

-- ===================================================================== anon (no session)
set role anon;
select set_config('request.jwt.claim.sub', '', false) \gset
\echo 'anon: can read redacted challenges, cannot call scoring RPCs or read private tables'
do $$ begin
  assert (select count(*) from (select id, prompt, options, court from public.challenges) s) = 30, 'anon read';
end $$;
select tests.expect_error($$select public.submit_answer('rookie-01', 'a', 'academy')$$, '42501') \g /dev/null
select tests.expect_error($$select public.get_daily()$$, '42501') \g /dev/null
select tests.expect_error($$select public.start_battle()$$, '42501') \g /dev/null
select tests.expect_error($$select * from public.profiles$$, '42501') \g /dev/null
select tests.expect_error($$select * from public.attempts$$, '42501') \g /dev/null

reset role;
\echo 'ALL SQL TESTS PASSED'
