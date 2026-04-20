#!/bin/sh

echo "=== TalentPilot Backend Startup ==="
echo "Python version: $(python --version)"
echo "DATABASE_URL set: $([ -n "$DATABASE_URL" ] && echo 'yes' || echo 'NO!')"
echo ""

echo "--- Running Alembic migrations ---"
if alembic upgrade head; then
    echo "--- Migrations completed successfully ---"
else
    echo "!!! WARNING: Alembic migration failed (exit code $?) !!!"
    echo "!!! Starting server anyway — check migration logs above !!!"
fi

echo ""
echo "--- Starting uvicorn ---"
exec uvicorn main:app --host 0.0.0.0 --port 8000 --workers 2
