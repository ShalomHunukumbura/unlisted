#!/usr/bin/env bash
# Applies db/migrations/*.sql in order, once each, tracked in schema_migrations.
#
#   ./db/migrate.sh                          the local docker database
#   MIGRATE_URL=postgresql://... ./db/migrate.sh   any other (e.g. Neon); uses
#                                            psql if installed, else the docker one
set -euo pipefail

cd "$(dirname "$0")/.."
if [ -z "${MIGRATE_URL:-}" ]; then
  PSQL=(docker compose exec -T postgres psql -U jobsite -d jobsite -v ON_ERROR_STOP=1)
elif command -v psql >/dev/null; then
  PSQL=(psql "$MIGRATE_URL" -v ON_ERROR_STOP=1)
else
  PSQL=(docker compose exec -T postgres psql "$MIGRATE_URL" -v ON_ERROR_STOP=1)
fi

"${PSQL[@]}" -q -c "CREATE TABLE IF NOT EXISTS schema_migrations (
  version text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);"

for f in db/migrations/*.sql; do
  version="$(basename "$f")"
  applied="$("${PSQL[@]}" -tAc "SELECT 1 FROM schema_migrations WHERE version = '$version'")"
  if [ "$applied" = "1" ]; then
    echo "  skip    $version"
    continue
  fi
  echo "  apply   $version"
  # Migration and its bookkeeping in one transaction: a failure leaves no trace.
  { echo "BEGIN;"; cat "$f"; \
    echo "INSERT INTO schema_migrations (version) VALUES ('$version');"; \
    echo "COMMIT;"; } | "${PSQL[@]}" -q
done

echo "migrations up to date"
