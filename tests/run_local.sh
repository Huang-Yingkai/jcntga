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
