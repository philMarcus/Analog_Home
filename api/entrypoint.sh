#!/bin/bash
# Startup entrypoint: validates DuckDB health before launching the app.
# If the DB is corrupted (WAL replay crash), backs it up and recreates fresh.

DB_PATH="${ANALOG_DB_PATH:-/data/analog.duckdb}"

# Quick health check: try to open the DB with DuckDB
if [ -f "$DB_PATH" ]; then
    python3 -c "import duckdb; c=duckdb.connect('${DB_PATH}'); c.execute('SELECT 1'); c.close()" 2>/dev/null
    if [ $? -ne 0 ]; then
        TIMESTAMP=$(date +%Y%m%d_%H%M%S)
        BACKUP="${DB_PATH%.duckdb}_backup_${TIMESTAMP}.duckdb"
        echo "[RECOVERY] DB health check failed. Backing up to $BACKUP"
        cp "$DB_PATH" "$BACKUP" 2>/dev/null
        cp "${DB_PATH}.wal" "${BACKUP}.wal" 2>/dev/null
        rm -f "$DB_PATH" "${DB_PATH}.wal"
        echo "[RECOVERY] Corrupted DB removed. Will recreate on startup."
    else
        echo "[STARTUP] DB health check passed."
    fi
fi

exec uvicorn main:app --host 0.0.0.0 --port 8080
