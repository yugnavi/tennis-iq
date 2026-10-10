#!/usr/bin/env bash
# Runs the SQL test-suite against a throwaway local Postgres cluster (no Docker needed).
#
#   bash supabase/scripts/test-sql.sh
#
# Needs Postgres >= 15 client+server binaries (initdb, pg_ctl, psql). Found via $PG_BIN,
# `pg_config --bindir`, or Homebrew's postgresql@17/16/15. Port: $TIQ_TEST_PGPORT (default 54329).
#
# 1. Apply supabase/tests/_stub_supabase.sql (roles + auth schema), every migration, fixtures,
#    then supabase/tests/*.test.sql (ASSERT-based; any failure aborts).
# 2. Concurrency: 24 parallel duplicate submissions must yield exactly one award per rule.
# 3. If supabase/seed.sql exists: load it into a fresh DB twice (idempotency) and check 200/200/200.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PORT="${TIQ_TEST_PGPORT:-54329}"

find_bin() {
  if [[ -n "${PG_BIN:-}" ]]; then echo "$PG_BIN"; return; fi
  if command -v pg_config >/dev/null && [[ -x "$(pg_config --bindir)/initdb" ]]; then pg_config --bindir; return; fi
  for v in 17 16 15; do
    for p in "/opt/homebrew/opt/postgresql@$v/bin" "/usr/local/opt/postgresql@$v/bin" "/usr/lib/postgresql/$v/bin"; do
      [[ -x "$p/initdb" ]] && { echo "$p"; return; }
    done
  done
  echo "test-sql: Postgres binaries not found (set PG_BIN)" >&2; exit 2
}
BIN="$(find_bin)"
TMP="$(mktemp -d)"
cleanup() { "$BIN/pg_ctl" -D "$TMP/data" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$TMP"; }
trap cleanup EXIT

"$BIN/initdb" -D "$TMP/data" -U postgres --auth=trust >/dev/null
# TCP only: unix socket paths under $TMPDIR can exceed the 103-byte limit on macOS.
"$BIN/pg_ctl" -D "$TMP/data" -o "-p $PORT -k '' -h 127.0.0.1" -l "$TMP/pg.log" -w start >/dev/null

psql() { "$BIN/psql" -h 127.0.0.1 -p "$PORT" -U postgres -v ON_ERROR_STOP=1 -q -X "$@"; }

setup_db() {
  "$BIN/createdb" -h 127.0.0.1 -p "$PORT" -U postgres "$1"
  psql -d "$1" -f "$ROOT/supabase/tests/_stub_supabase.sql" >/dev/null
  for m in "$ROOT"/supabase/migrations/*.sql; do psql -d "$1" -f "$m" >/dev/null; done
}

echo "== migrations + scoring/RLS tests"
setup_db tiq_test
psql -d tiq_test -f "$ROOT/supabase/tests/fixtures.sql" >/dev/null
for t in "$ROOT"/supabase/tests/*.test.sql; do psql -d tiq_test -f "$t"; done

echo "== concurrency: 24 parallel duplicate submissions"
U=44444444-4444-4444-4444-444444444444
pids=()
for _ in $(seq 1 12); do
  psql -d tiq_test -tA -c "set role authenticated; select set_config('request.jwt.claim.sub', '$U', false);
    select public.submit_answer('strategist-05', 'a', 'academy');
    select public.submit_answer(public.daily_challenge_id(public.utc_today()), 'c', 'daily');" >/dev/null &
  pids+=($!)
done
for p in "${pids[@]}"; do wait "$p"; done
RESULT="$(psql -d tiq_test -tA -F'|' -c "
  select p.xp,
         (select count(*) from attempts where user_id = '$U' and rewarded),
         (select count(*) from daily_completions where user_id = '$U'),
         (select count(*) from attempts where user_id = '$U')
    from profiles p where p.user_id = '$U'")"
[[ "$(psql -d tiq_test -tA -c "select public.daily_challenge_id(public.utc_today())")" == "strategist-05" ]] && EXPECTED_REWARDED=1
if [[ "$RESULT" != "30|1|1|24" ]]; then
  echo "FAIL concurrency: got xp|rewarded|dailies|attempts = $RESULT (want 30|1|1|24)" >&2; exit 1
fi
echo "ok ($RESULT)"

if [[ -f "$ROOT/supabase/seed.sql" ]]; then
  echo "== seed.sql loads, is idempotent, and has 200/200/200 approved challenges"
  setup_db tiq_seed
  psql -d tiq_seed -f "$ROOT/supabase/seed.sql" >/dev/null
  psql -d tiq_seed -f "$ROOT/supabase/seed.sql" >/dev/null
  COUNTS="$(psql -d tiq_seed -tA -c "select string_agg(track || '=' || n, ',' order by track) from
    (select track, count(*) n from challenges where approved group by track) s")"
  if [[ "$COUNTS" != "challenger=200,rookie=200,strategist=200" ]]; then
    echo "FAIL seed counts: $COUNTS" >&2; exit 1
  fi
  echo "ok ($COUNTS)"
else
  echo "== seed.sql not found (run: npm run seed:generate) — skipped"
fi

echo "ALL SUPABASE SQL CHECKS PASSED"
