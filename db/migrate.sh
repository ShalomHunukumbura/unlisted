#!/usr/bin/env bash
# Applies db/migrations/*.sql in order, once each, tracked in schema_migrations.
set -euo pipefail

cd "$(dirname "$0")/.."
PSQL=(docker compose exec -T postgres psql -U jobsite -d jobsite -v ON_ERROR_STOP=1)

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
