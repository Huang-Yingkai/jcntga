#!/usr/bin/env bash
# Runs the migrations + RLS checks on a throwaway local PostgreSQL 16.
set -euo pipefail
cd "$(dirname "$0")/.."
BIN=/usr/lib/postgresql/16/bin
DATA=$(mktemp -d); SOCK=$(mktemp -d)
chown postgres "$DATA" "$SOCK" 2>/dev/null || true
run() { if [ "$(id -u)" = 0 ]; then su postgres -c "$*"; else bash -c "$*"; fi; }
run "$BIN/initdb -D $DATA -A trust -U postgres >/dev/null"
run "$BIN/pg_ctl -D $DATA -o '-k $SOCK -c listen_addresses=' -l $DATA/log -w start >/dev/null"
trap 'run "$BIN/pg_ctl -D $DATA -m fast stop >/dev/null"; rm -rf "$DATA" "$SOCK"' EXIT
PSQL="psql -h $SOCK -U postgres -d postgres -v ON_ERROR_STOP=1 -q"
$PSQL -f tests/supabase_mock.sql
for f in supabase/migrations/*.sql; do $PSQL -f "$f"; done
$PSQL -f tests/rls_test.sql
$PSQL -f tests/courses_test.sql

course_id=$($PSQL -At -c "select id from public.courses where title = 'Last seat test'")
book_last_seat() {
  $PSQL -v course_id="$course_id" -v registration_id="$1" -v VERBOSITY=verbose <<'SQL'
begin;
set local role anon;
select public.book_course_seat(:'course_id', :'registration_id', '{"a":"1","b":"2","c":"3","d":"4","e":"5"}');
select pg_sleep(0.5);
commit;
SQL
}

book_last_seat 00000000-0000-0000-0000-000000000011 > "$DATA/booking-1.log" 2>&1 &
first=$!
book_last_seat 00000000-0000-0000-0000-000000000012 > "$DATA/booking-2.log" 2>&1 &
second=$!
first_status=0
second_status=0
wait "$first" || first_status=$?
wait "$second" || second_status=$?

if ! { [[ $first_status = 0 ]] && grep -q 'P0001: COURSE_FULL' "$DATA/booking-2.log"; } &&
   ! { [[ $second_status = 0 ]] && grep -q 'P0001: COURSE_FULL' "$DATA/booking-1.log"; }; then
  cat "$DATA/booking-1.log" "$DATA/booking-2.log"
  echo 'FAIL: exactly one concurrent booking must succeed' >&2
  exit 1
fi

result=$($PSQL -At -c "select booked_seats, (select count(*) from public.course_registrations where course_id = courses.id) from public.courses where id = '$course_id'")
[[ $result = '1|1' ]]
echo 'PASS: concurrent bookings leave exactly one reservation and one booked seat'
