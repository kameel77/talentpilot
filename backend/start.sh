#!/bin/sh
set -eu

echo "=== TalentPilot Backend Startup ==="
echo "Python version: $(python --version)"

if [ -z "${DATABASE_URL:-}" ]; then
    echo "FATAL: DATABASE_URL is not set"
    exit 1
fi
echo "DATABASE_URL: set"

echo ""
echo "--- Running Alembic migrations ---"
alembic upgrade head
echo "--- Migrations completed successfully ---"

echo ""
echo "--- Starting uvicorn ---"
exec uvicorn main:app --host 0.0.0.0 --port 8000 --workers 2
