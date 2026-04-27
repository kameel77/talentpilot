#!/bin/sh

echo "=== TalentPilot Backend Startup ==="
echo "Python version: $(python --version)"
echo "DATABASE_URL set: $([ -n "$DATABASE_URL" ] && echo 'yes' || echo 'NO!')"
echo ""

echo "--- Checking migration state ---"

# One-time fix: if alembic thinks it's up to date but EN columns are missing,
# re-stamp to dd87278924a7 so that i4d5e6f7g8h9 and j5e6f7g8h9i0 actually run.
python -c "
import os, sys
from sqlalchemy import create_engine, text, inspect

db_url = os.environ.get('DATABASE_URL')
if not db_url:
    print('No DATABASE_URL, skipping migration state check')
    sys.exit(0)

engine = create_engine(db_url)
with engine.connect() as conn:
    inspector = inspect(engine)
    if 'users' not in inspector.get_table_names():
        print('Users table does not exist yet, skipping fix')
        sys.exit(0)

    columns = [c['name'] for c in inspector.get_columns('users')]
    if 'job_title_en' not in columns:
        print('!!! job_title_en column missing — checking alembic_version...')
        if 'alembic_version' in inspector.get_table_names():
            result = conn.execute(text('SELECT version_num FROM alembic_version'))
            row = result.fetchone()
            if row:
                current = row[0]
                print(f'    Current alembic version: {current}')
                # If alembic is past dd87278924a7 but columns are missing, re-stamp
                if current in ('i4d5e6f7g8h9', 'j5e6f7g8h9i0'):
                    print('    Re-stamping to dd87278924a7 so EN migrations re-run...')
                    conn.execute(text(\"UPDATE alembic_version SET version_num = 'dd87278924a7'\"))
                    conn.commit()
                    print('    Done. Alembic upgrade head will now apply EN field migrations.')
    else:
        print('job_title_en column exists — migration state OK')
" || echo "Migration state check script failed, continuing..."

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
