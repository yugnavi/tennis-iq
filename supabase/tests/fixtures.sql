-- Synthetic challenge bank for SQL tests (independent of the real content in seed.sql).
-- Correct option is always 'a'. Ids mirror production format so daily ordering is realistic.
insert into public.challenges
  (id, track, kind, difficulty, prompt, options, correct_option_id, explanation,
   source_name, source_url, approved, coach_review_required)
select format('%s-%s', t, lpad(i::text, 2, '0')), t, 'rules', 1,
       format('Fixture prompt %s %s', t, i),
       '[{"id":"a","label":"A"},{"id":"b","label":"B"},{"id":"c","label":"C"},{"id":"d","label":"D"}]',
       'a', 'Fixture explanation text', 'ITF Rules of Tennis', 'https://www.itftennis.com/', true, false
  from unnest(array['rookie', 'challenger', 'strategist']) t, generate_series(1, 10) i;

-- An unapproved draft that must never be visible or answerable.
insert into public.challenges
  (id, track, kind, difficulty, prompt, options, correct_option_id, explanation,
   source_name, source_url, approved)
values ('rookie-99', 'rookie', 'rules', 1, 'Unapproved draft prompt',
        '[{"id":"a","label":"A"},{"id":"b","label":"B"},{"id":"c","label":"C"},{"id":"d","label":"D"}]',
        'a', 'Draft explanation', 'n/a', 'https://example.com/', false);

insert into auth.users (id) values
  ('11111111-1111-1111-1111-111111111111'),
  ('22222222-2222-2222-2222-222222222222'),
  ('33333333-3333-3333-3333-333333333333'),
  ('44444444-4444-4444-4444-444444444444');

-- Test helper: answer a battle with a W/L sequence ('W' = correct, 'L' = wrong), cycling through
-- challenges. Returns the last submit_answer result. Runs as the calling role (security invoker).
create schema tests;
grant usage on schema tests to anon, authenticated;
create function tests.play(p_battle uuid, p_seq text) returns jsonb
language plpgsql as $$
declare r jsonb; i int;
begin
  for i in 1 .. length(p_seq) loop
    r := public.submit_answer(
      (select id from public.challenges order by id collate "C" offset (i - 1) % 30 limit 1),  -- RLS: approved only
      case substr(p_seq, i, 1) when 'W' then 'a' else 'b' end,
      'battle', p_battle);
  end loop;
  return r;
end $$;
grant execute on function tests.play(uuid, text) to authenticated;
