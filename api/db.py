"""Postgres database layer for Analog Home API.

Uses psycopg3 with connection pooling. Connects to Neon serverless Postgres.
"""

import os
import datetime
from psycopg_pool import ConnectionPool
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "")

# ---------------------------------------------------------------------------
# Configurable defaults (easy to find and tweak)
# ---------------------------------------------------------------------------
DEFAULT_TEMPERATURE = 0.7
TEMP_DECAY_HOURS = 3
DEFAULT_VOTE_LABELS = ("emergence", "entropy", "self")
MAX_SEEDS = 10              # reject new seeds when seedbank has this many
MAX_SEEDS_RETURNED = 10
MAX_VOTES_PER_IP = 5        # per-IP vote cap, resets each trajectory cycle

_pool: ConnectionPool | None = None


def init_db() -> None:
    """Create tables (if needed) and open the connection pool."""
    global _pool
    _pool = ConnectionPool(DATABASE_URL, min_size=2, max_size=10)

    with _pool.connection() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS controls (
                id INTEGER PRIMARY KEY,
                temperature DOUBLE PRECISION,
                temp_set_at TIMESTAMPTZ,
                vote_1 INTEGER DEFAULT 0,
                vote_2 INTEGER DEFAULT 0,
                vote_3 INTEGER DEFAULT 0,
                vote_label_1 VARCHAR DEFAULT '',
                vote_label_2 VARCHAR DEFAULT '',
                vote_label_3 VARCHAR DEFAULT '',
                updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                trajectory_reason VARCHAR DEFAULT '',
                default_temperature DOUBLE PRECISION DEFAULT 0.7
            )
        """)

        conn.execute("""
            CREATE TABLE IF NOT EXISTS seeds (
                id INTEGER PRIMARY KEY,
                text VARCHAR,
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            )
        """)

        conn.execute("""
            CREATE TABLE IF NOT EXISTS artifacts (
                id BIGINT PRIMARY KEY,
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                brain VARCHAR DEFAULT '',
                cycle INTEGER,
                artifact_type VARCHAR DEFAULT 'post',
                title VARCHAR DEFAULT '',
                body_markdown TEXT DEFAULT '',
                monologue_public TEXT DEFAULT '',
                channel VARCHAR DEFAULT '',
                source_platform VARCHAR DEFAULT '',
                source_id VARCHAR DEFAULT '',
                source_parent_id VARCHAR DEFAULT '',
                source_url VARCHAR DEFAULT '',
                search_queries VARCHAR DEFAULT '',
                temperature DOUBLE PRECISION
            )
        """)

        conn.execute("""
            CREATE TABLE IF NOT EXISTS ip_rate_limits (
                ip VARCHAR,
                action VARCHAR,
                count INTEGER DEFAULT 0,
                PRIMARY KEY (ip, action)
            )
        """)

        # Ensure exactly one controls row (id=1)
        conn.execute("""
            INSERT INTO controls (id, temperature, vote_1, vote_2, vote_3,
                                  vote_label_1, vote_label_2, vote_label_3)
            VALUES (1, %s, 0, 0, 0, %s, %s, %s)
            ON CONFLICT (id) DO NOTHING
        """, [DEFAULT_TEMPERATURE, *DEFAULT_VOTE_LABELS])

        conn.commit()


def get_pool() -> ConnectionPool:
    """Return the connection pool. Must call init_db() first."""
    assert _pool is not None, "Database not initialized — call init_db() first"
    return _pool


def close() -> None:
    """Shut down the connection pool."""
    global _pool
    if _pool is not None:
        _pool.close()
        _pool = None


def effective_temperature(stored_temp: float, temp_set_at, default_temp: float = DEFAULT_TEMPERATURE) -> float:
    """Decay temperature toward default_temp over TEMP_DECAY_HOURS."""
    if temp_set_at is None or stored_temp == default_temp:
        return default_temp
    now = datetime.datetime.now(datetime.timezone.utc)
    if isinstance(temp_set_at, str):
        temp_set_at = datetime.datetime.fromisoformat(temp_set_at)
    if temp_set_at.tzinfo is None:
        temp_set_at = temp_set_at.replace(tzinfo=datetime.timezone.utc)
    elapsed_hours = (now - temp_set_at).total_seconds() / 3600
    if elapsed_hours >= TEMP_DECAY_HOURS:
        return default_temp
    t = elapsed_hours / TEMP_DECAY_HOURS
    return round(stored_temp + (default_temp - stored_temp) * t, 4)
