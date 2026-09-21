#!/usr/bin/env bash
set -euo pipefail

# Applies db/migrations/*.sql (repo root) inside the running `postgres`
# compose service, in filename order, idempotently: a `schema_migrations`
# bookkeeping table tracks what has already been applied, and each
# not-yet-applied file runs inside its own transaction together with the
# insert that records it -- a failing migration never gets marked as done.
#
# Run this from the deploy/ directory, after `docker compose up -d`:
#   ./migrate.sh

cd "$(dirname "${BASH_SOURCE[0]}")"

if [ ! -f .env ]; then
  echo "error: deploy/.env not found -- copy deploy/.env.example to deploy/.env first" >&2
  exit 1
fi

set -a
# shellcheck source=/dev/null
source .env
set +a

: "${POSTGRES_USER:?POSTGRES_USER must be set in deploy/.env}"
: "${POSTGRES_DB:?POSTGRES_DB must be set in deploy/.env}"

migrations_dir="../db/migrations"
if [ ! -d "$migrations_dir" ]; then
  echo "error: $migrations_dir not found" >&2
  exit 1
fi

psql_exec() {
  docker compose exec -T postgres psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" "$@"
}

# Bookkeeping table. `create table if not exists` makes this call itself
# idempotent too.
psql_exec -q -c \
  "create table if not exists public.schema_migrations (filename text primary key, applied_at timestamptz not null default now());" \
  >/dev/null

applied=0
skipped=0

while IFS= read -r file; do
  name="$(basename "$file")"

  already="$(psql_exec -t -A -c "select 1 from public.schema_migrations where filename = '$name';")"
  if [ "$already" = "1" ]; then
    echo "skip:  $name (already applied)"
    skipped=$((skipped + 1))
    continue
  fi

  echo "apply: $name"
  {
    printf 'begin;\n'
    cat "$file"
    printf "\ninsert into public.schema_migrations (filename) values ('%s');\n" "$name"
    printf 'commit;\n'
  } | psql_exec -q
  applied=$((applied + 1))
done < <(find "$migrations_dir" -maxdepth 1 -type f -name '*.sql' | sort)

echo ""
echo "Done: ${applied} applied, ${skipped} skipped."
