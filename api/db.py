import os
import datetime
import duckdb
from dotenv import load_dotenv

load_dotenv()

DB_PATH = os.getenv("ANALOG_DB_PATH", "../data/analog.duckdb")

# ---------------------------------------------------------------------------
# Configurable defaults (easy to find and tweak)
# ---------------------------------------------------------------------------
DEFAULT_TEMPERATURE = 0.7
TEMP_DECAY_HOURS = 24
DEFAULT_VOTE_LABELS = ("emergence", "entropy", "self")
MAX_SEEDS_RETURNED = 10

# Keep a single connection per API process to avoid Windows file-lock churn.
_CON = None


def connect() -> duckdb.DuckDBPyConnection:
    global _CON
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    if _CON is None:
        _CON = duckdb.connect(DB_PATH)
    return _CON


def close() -> None:
    global _CON
    if _CON is not None:
        try:
            _CON.close()
        finally:
            _CON = None


def init_db() -> None:
    con = connect()

    con.execute("""
    CREATE TABLE IF NOT EXISTS controls (
      id INTEGER PRIMARY KEY,
      temperature DOUBLE,
      temp_set_at TIMESTAMP,
      vote_1 INTEGER,
      vote_2 INTEGER,
      vote_3 INTEGER,
      vote_label_1 VARCHAR,
      vote_label_2 VARCHAR,
      vote_label_3 VARCHAR,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)

    con.execute("""
    CREATE TABLE IF NOT EXISTS seeds (
      id INTEGER PRIMARY KEY,
      text VARCHAR,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)

    con.execute("""
    CREATE TABLE IF NOT EXISTS artifacts (
      id BIGINT PRIMARY KEY,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      brain VARCHAR,
      cycle INTEGER,
      artifact_type VARCHAR,
      title VARCHAR,
      body_markdown VARCHAR,
      monologue_public VARCHAR,
      channel VARCHAR,
      source_platform VARCHAR,
      source_id VARCHAR,
      source_parent_id VARCHAR,
      source_url VARCHAR
    );
    """)

    # Ensure exactly one controls row (id=1)
    con.execute("""
      INSERT INTO controls (id, temperature, temp_set_at, vote_1, vote_2, vote_3,
                            vote_label_1, vote_label_2, vote_label_3)
      SELECT 1, ?, NULL, 0, 0, 0, ?, ?, ?
      WHERE NOT EXISTS (SELECT 1 FROM controls WHERE id=1);
    """, [DEFAULT_TEMPERATURE, *DEFAULT_VOTE_LABELS])


def effective_temperature(stored_temp: float, temp_set_at) -> float:
    """Decay temperature toward DEFAULT_TEMPERATURE over TEMP_DECAY_HOURS."""
    if temp_set_at is None or stored_temp == DEFAULT_TEMPERATURE:
        return DEFAULT_TEMPERATURE
    now = datetime.datetime.now(datetime.timezone.utc)
    if isinstance(temp_set_at, str):
        temp_set_at = datetime.datetime.fromisoformat(temp_set_at)
    if temp_set_at.tzinfo is None:
        temp_set_at = temp_set_at.replace(tzinfo=datetime.timezone.utc)
    elapsed_hours = (now - temp_set_at).total_seconds() / 3600
    if elapsed_hours >= TEMP_DECAY_HOURS:
        return DEFAULT_TEMPERATURE
    t = elapsed_hours / TEMP_DECAY_HOURS
    return round(stored_temp + (DEFAULT_TEMPERATURE - stored_temp) * t, 4)
