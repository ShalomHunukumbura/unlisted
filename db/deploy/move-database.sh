#!/usr/bin/env bash
# Moves the deployed database to a new, empty one (Neon to Supabase, 2026-10),
# in two steps, because the old one couldn't be read at the time (its free
# compute had run out until the next month):
#
#   TO_URL=... ./db/deploy/move-database.sh start
#       The schema, and the companies from the local database (they're managed
#       locally). The site works from the next sync on; jobs refill in ~30 min.
#       New rows' ids start at START_ID, above anything the old database used,
#       so the old rows can be added later without colliding.
#
#   FROM_URL=... TO_URL=... ./db/deploy/move-database.sh import
#       Once the old database can be read again: adds its accounts, alerts,
#       push subscriptions, applications, past weekly reports and what Google
#       has been told. Where someone has since signed up again with the same
#       email address, the new account is kept and the old one is skipped.
#       Safe to run more than once.
#
# TO_URL is Supabase's session pooler (port 5432). Needs only Docker: psql and
# pg_dump come from the postgres:17 image; `start` also needs the local
# database running (make up).
set -euo pipefail

cd "$(dirname "$0")/../.."
: "${TO_URL:?set TO_URL to the new database (Supabase session pooler, port 5432)}"

START_ID=1000000000

pg() { docker run --rm -i -v "$PWD:/repo" -w /repo -e MIGRATE_URL -e PGOPTIONS="-c client_min_messages=warning" postgres:17 "$@"; }
to() { pg psql "$TO_URL" -v ON_ERROR_STOP=1 "$@"; }

start() {
  echo "1/3 schema"
  MIGRATE_URL="$TO_URL" pg ./db/migrate.sh
  if [ "$(to -tAc 'SELECT count(*) FROM companies')" != "0" ]; then
    echo "The new database already has companies: not copying over them." >&2
    exit 1
  fi

  echo "2/3 companies from the local database"
  docker compose exec -T postgres pg_dump -U jobsite -d jobsite --data-only --no-owner --no-privileges \
      --table=public.companies --table=public.slug_probes \
    | to -q -o /dev/null
  # As reset-jobs.sql: the refill is every board's first sync, so its jobs
  # aren't taken for late reposts, and every board is due on the next run.
  to -q -c "UPDATE companies SET first_synced_at = NULL, last_success_at = NULL, last_synced_at = NULL"

  echo "3/3 new ids from $START_ID, clear of the old database's"
  to -q -o /dev/null -c "SELECT setval(format('%I.%I', schemaname, sequencename), $START_ID)
                           FROM pg_sequences
                          WHERE schemaname = 'public' AND sequencename <> 'companies_id_seq'"
  to -tAc "SELECT 'companies: ' || count(*) FROM companies"
  echo "done: point DATABASE_URL at the new database, then run the sync workflow"
}

# In the order their foreign keys need.
IMPORT=(profiles alert_subscriptions push_subscriptions applications weekly_reports index_pings)

import() {
  : "${FROM_URL:?set FROM_URL to the old database (Neon, its direct connection)}"
  echo "1/3 copy the old rows to a side schema"
  to -q -c "DROP SCHEMA IF EXISTS neon_import CASCADE; CREATE SCHEMA neon_import"
  for t in "${IMPORT[@]}"; do
    # The columns as the new table has them, read by name from the old one.
    cols="$(to -tAc "SELECT string_agg(quote_ident(column_name), ', ' ORDER BY ordinal_position)
                       FROM information_schema.columns WHERE table_schema = 'public' AND table_name = '$t'")"
    to -q -c "CREATE TABLE neon_import.$t (LIKE public.$t)"
    pg psql "$FROM_URL" -v ON_ERROR_STOP=1 -c "\\copy (SELECT $cols FROM public.$t) TO STDOUT" \
      | to -q -c "\\copy neon_import.$t ($cols) FROM STDIN"
  done

  echo "2/3 add them"
  to -q <<'SQL'
BEGIN;
INSERT INTO profiles SELECT * FROM neon_import.profiles ON CONFLICT DO NOTHING;
INSERT INTO alert_subscriptions SELECT * FROM neon_import.alert_subscriptions ON CONFLICT DO NOTHING;
-- Only for profiles that made it: a skipped one's rows have no owner.
INSERT INTO push_subscriptions SELECT p.* FROM neon_import.push_subscriptions p
 WHERE p.profile_id IS NULL OR EXISTS (SELECT 1 FROM profiles x WHERE x.id = p.profile_id)
ON CONFLICT DO NOTHING;
INSERT INTO applications SELECT a.* FROM neon_import.applications a
 WHERE EXISTS (SELECT 1 FROM profiles x WHERE x.id = a.profile_id)
ON CONFLICT DO NOTHING;
-- A week the new database has already worked out keeps its numbers.
INSERT INTO weekly_reports SELECT * FROM neon_import.weekly_reports ON CONFLICT DO NOTHING;
INSERT INTO index_pings SELECT * FROM neon_import.index_pings ON CONFLICT DO NOTHING;
COMMIT;
SQL

  echo "3/3 rows from the old database, and how many of them are in the new one"
  for t in "${IMPORT[@]}"; do
    case "$t" in
      applications) key="profile_id, job_id" ;;
      weekly_reports) key="week" ;;
      index_pings) key="job_id" ;;
      *) key="id" ;;
    esac
    to -tAc "SELECT format('  %-20s %8s %8s', '$t', count(*),
                    count(*) FILTER (WHERE ($(sed 's/\([a-z_]\+\)/o.\1/g' <<<"$key")) IN (SELECT $key FROM public.$t)))
               FROM neon_import.$t o"
  done
  to -q -c "DROP SCHEMA neon_import CASCADE"
  echo "done"
}

case "${1:-}" in
  start) start ;;
  import) import ;;
  *) echo "usage: $0 start | import" >&2; exit 2 ;;
esac
