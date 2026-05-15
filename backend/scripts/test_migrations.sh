#!/usr/bin/env bash
# Smoke-test alembic migrations against a fresh ephemeral Postgres.
#
# Verifies that:
#   1. `alembic upgrade head` runs cleanly on an empty database
#   2. Schema is what models.py expects (key columns/constraints exist)
#   3. `alembic downgrade -1` + re-upgrade succeeds (idempotency)
#   4. Re-running `alembic upgrade head` is a no-op
#
# Requires: Docker, alembic on PATH (run from inside backend/.venv).
# Usage:    ./backend/scripts/test_migrations.sh

set -euo pipefail

CONTAINER="talentpilot-alembic-test-$$"
PORT="$(python3 -c 'import socket; s=socket.socket(); s.bind(("",0)); print(s.getsockname()[1])')"
DB_USER=test
DB_PASS=test
DB_NAME=test
DB_URL="postgresql://${DB_USER}:${DB_PASS}@localhost:${PORT}/${DB_NAME}"

cleanup() { docker rm -f "$CONTAINER" >/dev/null 2>&1 || true; }
trap cleanup EXIT

echo "==> Starting ephemeral Postgres (pgvector/pg16) on :${PORT}"
docker run -d --rm \
  --name "$CONTAINER" \
  -e POSTGRES_USER="$DB_USER" \
  -e POSTGRES_PASSWORD="$DB_PASS" \
  -e POSTGRES_DB="$DB_NAME" \
  -p "${PORT}:5432" \
  pgvector/pgvector:pg16 >/dev/null

echo -n "==> Waiting for Postgres "
for _ in $(seq 1 30); do
  if docker exec "$CONTAINER" pg_isready -U "$DB_USER" -d "$DB_NAME" >/dev/null 2>&1; then
    echo "ready"
    break
  fi
  echo -n "."
  sleep 1
done

cd "$(dirname "$0")/.."  # → backend/

export DATABASE_URL="$DB_URL"
# Minimal env to satisfy config.py validators
export JWT_SECRET=test-only-not-real
export OPENAI_API_KEY=sk-test-only-not-real
export CORS_ORIGINS=http://localhost:3000

echo "==> alembic upgrade head"
alembic upgrade head

echo
echo "==> Schema checks (post-upgrade)"
psql_check() {
  docker exec -i "$CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -tA -c "$1"
}

ORG_CREATED_AT=$(psql_check "SELECT column_name FROM information_schema.columns WHERE table_name='organization_access' AND column_name='created_at'")
ORG_GRANTED_AT=$(psql_check "SELECT column_name FROM information_schema.columns WHERE table_name='organization_access' AND column_name='granted_at'")
ORG_UNIQUE=$(psql_check "SELECT constraint_name FROM information_schema.table_constraints WHERE table_name='organization_access' AND constraint_name='uq_organization_access'")
TEAMS_TOKEN=$(psql_check "SELECT column_name FROM information_schema.columns WHERE table_name='teams' AND column_name='presentation_token'")
TEAMS_INDEX=$(psql_check "SELECT indexname FROM pg_indexes WHERE tablename='teams' AND indexname='ix_teams_presentation_token'")
PRT_CASCADE=$(psql_check "SELECT delete_rule FROM information_schema.referential_constraints WHERE constraint_name='password_reset_tokens_user_id_fkey'")

[[ "$ORG_CREATED_AT" == "created_at" ]] || { echo "FAIL: organization_access.created_at missing"; exit 1; }
[[ -z "$ORG_GRANTED_AT" ]]              || { echo "FAIL: organization_access.granted_at should not exist"; exit 1; }
[[ "$ORG_UNIQUE" == "uq_organization_access" ]] || { echo "FAIL: uq_organization_access missing"; exit 1; }
[[ "$TEAMS_TOKEN" == "presentation_token" ]]    || { echo "FAIL: teams.presentation_token missing"; exit 1; }
[[ "$TEAMS_INDEX" == "ix_teams_presentation_token" ]] || { echo "FAIL: ix_teams_presentation_token missing"; exit 1; }
[[ "$PRT_CASCADE" == "CASCADE" ]]               || { echo "FAIL: password_reset_tokens FK is not CASCADE (got: $PRT_CASCADE)"; exit 1; }

echo "    organization_access.created_at        ✓"
echo "    organization_access.granted_at dropped ✓"
echo "    uq_organization_access constraint     ✓"
echo "    teams.presentation_token              ✓"
echo "    ix_teams_presentation_token           ✓"
echo "    password_reset_tokens FK = CASCADE    ✓"

echo
echo "==> alembic downgrade -1, then upgrade head again (round-trip)"
alembic downgrade -1
alembic upgrade head

echo
echo "==> Second alembic upgrade head (should be no-op)"
alembic upgrade head

echo
echo "✅ Migration smoke test passed"
