import os
import duckdb
from dotenv import load_dotenv

load_dotenv()

DB_PATH = os.getenv("ANALOG_DB_PATH", "../data/analog.duckdb")

def connect():
    # DuckDB uses a file; ensure parent folder exists
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    return duckdb.connect(DB_PATH)

def init_db():
    con = connect()
    # Two tables only: controls + artifacts
    con.execute("""
    CREATE TABLE IF NOT EXISTS controls (
      id INTEGER PRIMARY KEY,
      temperature DOUBLE,
      focus_keyword VARCHAR,
      vote_explore INTEGER,
      vote_exploit INTEGER,
      vote_reflect INTEGER,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)

    con.execute("""
    CREATE TABLE IF NOT EXISTS artifacts (
      id BIGINT PRIMARY KEY,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      title VARCHAR,
      body_markdown VARCHAR,
      monologue_public VARCHAR
    );
    """)

    # Ensure exactly one controls row (id=1)
    con.execute("""
      INSERT INTO controls (id, temperature, focus_keyword, vote_explore, vote_exploit, vote_reflect)
      SELECT 1, 0.7, 'origin', 0, 0, 0
      WHERE NOT EXISTS (SELECT 1 FROM controls WHERE id=1);
    """)

    con.close()
