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
from sqlalchemy import create_engine, text

db_url = os.environ.get('DATABASE_URL')
if not db_url:
    print('No DATABASE_URL, skipping migration state check')
    sys.exit(0)

engine = create_engine(db_url)

# Use raw DBAPI connection for maximum reliability
raw_conn = engine.raw_connection()
try:
    cursor = raw_conn.cursor()
    
    # Check if users table has job_title_en column
    cursor.execute(\"\"\"
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'job_title_en'
    \"\"\")
    has_column = cursor.fetchone() is not None
    
    if has_column:
        print('job_title_en column exists -- migration state OK')
    else:
        print('!!! job_title_en column MISSING from users table')
        
        # Check current alembic version
        cursor.execute('SELECT version_num FROM alembic_version')
        row = cursor.fetchone()
        if row:
            current = row[0]
            print(f'    Current alembic version: {current}')
            
            # Re-stamp to the last version that actually applied
            print('    Re-stamping alembic to dd87278924a7...')
            cursor.execute(\"UPDATE alembic_version SET version_num = 'dd87278924a7'\")
            raw_conn.commit()
            print('    Done. alembic upgrade head should now apply EN migrations.')
        else:
            print('    No alembic_version row found')
except Exception as e:
    print(f'Migration state check error: {e}')
    try:
        raw_conn.rollback()
    except:
        pass
finally:
    raw_conn.close()

engine.dispose()
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
