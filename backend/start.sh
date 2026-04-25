#!/bin/sh

echo "=== TalentPilot Backend Startup ==="
echo "Python version: $(python --version)"
echo "DATABASE_URL set: $([ -n "$DATABASE_URL" ] && echo 'yes' || echo 'NO!')"
echo ""

echo "--- Running Alembic migrations ---"
# Temporary fix to bypass Alembic history validation and force stamp the database
echo "Forcefully stamping database to g2b3c4d5e6f7 via psycopg2..."
python -c "
import os
import psycopg2
try:
    conn = psycopg2.connect(os.environ['DATABASE_URL'])
    cur = conn.cursor()
    cur.execute('DELETE FROM alembic_version;')
    cur.execute(\"INSERT INTO alembic_version (version_num) VALUES ('g2b3c4d5e6f7');\")
    conn.commit()
    conn.close()
    print('Successfully stamped DB to g2b3c4d5e6f7')
except Exception as e:
    print('Failed to stamp DB:', e)
"

if alembic upgrade head; then
    echo "--- Migrations completed successfully ---"
else
    echo "!!! WARNING: Alembic migration failed (exit code $?) !!!"
    echo "!!! Starting server anyway — check migration logs above !!!"
fi

echo ""
echo "--- Starting uvicorn ---"
exec uvicorn main:app --host 0.0.0.0 --port 8000 --workers 2
