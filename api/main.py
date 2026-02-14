import time
from typing import List, Optional
from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware

from db import init_db, connect, close, effective_temperature, MAX_SEEDS_RETURNED, MAX_SEEDS, MAX_VOTES_PER_IP
from models import ArtifactOut, VoteRequest, SeedRequest, SetTrajectoryRequest, StateOut
from pydantic import BaseModel, Field


class PublishRequest(BaseModel):
    # Use epoch seconds by default so ID is easy and unique enough for now.
    id: int = Field(default_factory=lambda: int(time.time()))
    brain: str = Field(default="", max_length=100)
    cycle: Optional[int] = None
    artifact_type: str = Field(default="post", max_length=50)
    title: str = Field(default="", max_length=200)
    body_markdown: str = Field(default="", max_length=20000)
    monologue_public: str = Field(default="", max_length=20000)
    channel: str = Field(default="", max_length=100)
    source_platform: str = Field(default="", max_length=50)
    source_id: str = Field(default="", max_length=200)
    source_parent_id: str = Field(default="", max_length=200)
    source_url: str = Field(default="", max_length=500)
    search_queries: str = Field(default="", max_length=2000)
    temperature: Optional[float] = None


app = FastAPI(title="Analog I API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "https://marcusrecursives.com",
        "https://www.marcusrecursives.com",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def _startup():
    init_db()


@app.get("/healthz")
def healthz():
    """Lightweight health check — verifies DuckDB is queryable."""
    con = connect()
    con.execute("SELECT 1").fetchone()
    return {"ok": True}


@app.on_event("shutdown")
def _shutdown():
    close()


_ART_COLS = """id, created_at, brain, cycle, artifact_type,
             title, body_markdown, monologue_public,
             channel, source_platform, source_id, source_parent_id, source_url,
             search_queries, temperature"""


def _read_state(con):
    ctrl = con.execute("""
      SELECT temperature, temp_set_at, vote_1, vote_2, vote_3,
             vote_label_1, vote_label_2, vote_label_3, updated_at,
             trajectory_reason, default_temperature
      FROM controls WHERE id=1
    """).fetchone()

    art = con.execute(f"""
      SELECT {_ART_COLS}
      FROM artifacts
      ORDER BY created_at DESC
      LIMIT 1
    """).fetchone()

    seeds_rows = con.execute("""
      SELECT id, text, created_at FROM seeds
      ORDER BY created_at ASC LIMIT ?
    """, [MAX_SEEDS_RETURNED]).fetchall()

    default_temp = float(ctrl[10]) if ctrl[10] is not None else 0.7

    controls = {
        "temperature": effective_temperature(float(ctrl[0]), ctrl[1], default_temp),
        "default_temperature": default_temp,
        "vote_1": int(ctrl[2]),
        "vote_2": int(ctrl[3]),
        "vote_3": int(ctrl[4]),
        "vote_label_1": ctrl[5] or "",
        "vote_label_2": ctrl[6] or "",
        "vote_label_3": ctrl[7] or "",
        "updated_at": str(ctrl[8]),
        "trajectory_reason": ctrl[9] or "",
    }

    artifact = None
    if art:
        artifact = _art_row_to_dict(art)

    seeds = [{"id": int(r[0]), "text": r[1] or "", "created_at": str(r[2])} for r in seeds_rows]

    return {"artifact": artifact, "controls": controls, "seeds": seeds}


@app.get("/state", response_model=StateOut)
def get_state():
    con = connect()
    return _read_state(con)


def _art_row_to_dict(row) -> dict:
    return {
        "id": int(row[0]),
        "created_at": str(row[1]),
        "brain": row[2] or "",
        "cycle": row[3],
        "artifact_type": row[4] or "",
        "title": row[5] or "",
        "body_markdown": row[6] or "",
        "monologue_public": row[7] or "",
        "channel": row[8] or "",
        "source_platform": row[9] or "",
        "source_id": row[10] or "",
        "source_parent_id": row[11] or "",
        "source_url": row[12] or "",
        "search_queries": row[13] or "" if len(row) > 13 else "",
        "temperature": float(row[14]) if len(row) > 14 and row[14] is not None else None,
    }


@app.get("/artifacts", response_model=List[ArtifactOut])
def get_artifacts(limit: int = Query(default=5, ge=1, le=50), offset: int = Query(default=0, ge=0)):
    con = connect()
    rows = con.execute(f"""
      SELECT {_ART_COLS}
      FROM artifacts
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    """, [limit, offset]).fetchall()
    return [_art_row_to_dict(r) for r in rows]


@app.get("/artifacts/count")
def get_artifacts_count():
    con = connect()
    count = con.execute("SELECT COUNT(*) FROM artifacts").fetchone()[0]
    return {"count": int(count)}


def _get_client_ip(request: Request) -> str:
    return (request.headers.get("x-forwarded-for", "").split(",")[0].strip()
            or request.client.host)


@app.post("/vote", response_model=StateOut)
def post_vote(req: VoteRequest, request: Request):
    con = connect()

    # Rate-limit votes per IP (resets each trajectory cycle)
    ip = _get_client_ip(request)
    row = con.execute(
        "SELECT count FROM ip_rate_limits WHERE ip = ? AND action = 'vote'", [ip]
    ).fetchone()
    if row and row[0] >= MAX_VOTES_PER_IP:
        raise HTTPException(status_code=429, detail="Vote limit reached (5 per cycle)")
    con.execute("""
        INSERT INTO ip_rate_limits (ip, action, count) VALUES (?, 'vote', 1)
        ON CONFLICT (ip, action) DO UPDATE SET count = count + 1
    """, [ip])

    col = f"vote_{req.choice}"
    con.execute(
        f"UPDATE controls SET {col} = {col} + 1, updated_at = CURRENT_TIMESTAMP WHERE id=1;"
    )

    if req.temperature is not None:
        con.execute(
            "UPDATE controls SET temperature = ?, temp_set_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id=1;",
            [float(req.temperature)]
        )

    return _read_state(con)


@app.post("/temperature", response_model=StateOut)
def post_temperature(req: dict, request: Request):
    """Set temperature directly (without voting). One adjustment per IP per cycle, clamped to ±0.5."""
    t = req.get("temperature")
    if t is None:
        raise HTTPException(status_code=400, detail="temperature required")
    t = float(t)

    con = connect()
    ip = _get_client_ip(request)

    # Check if this IP already adjusted temperature this cycle
    row = con.execute(
        "SELECT count FROM ip_rate_limits WHERE ip = ? AND action = 'temp'", [ip]
    ).fetchone()
    if row:
        raise HTTPException(status_code=429, detail="Temperature already adjusted this cycle")

    # Clamp to ±0.5 from current effective temperature
    ctrl = con.execute(
        "SELECT temperature, temp_set_at, default_temperature FROM controls WHERE id=1"
    ).fetchone()
    default_temp = float(ctrl[2]) if ctrl[2] is not None else 0.7
    current = effective_temperature(float(ctrl[0]), ctrl[1], default_temp)
    t = max(current - 0.5, min(current + 0.5, t))
    t = max(0.0, min(2.0, t))

    # Record the adjustment
    con.execute(
        "INSERT INTO ip_rate_limits (ip, action, count) VALUES (?, 'temp', 1)", [ip]
    )
    con.execute(
        "UPDATE controls SET temperature = ?, temp_set_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id=1;",
        [t]
    )
    return _read_state(con)


@app.post("/seed", response_model=StateOut)
def post_seed(req: SeedRequest):
    con = connect()
    text = req.text.strip()[:200]
    if not text:
        raise HTTPException(status_code=400, detail="Seed text cannot be empty")
    count = con.execute("SELECT COUNT(*) FROM seeds").fetchone()[0]
    if count >= MAX_SEEDS:
        raise HTTPException(status_code=409, detail="Seedbank full \u2014 wait for the agent to consume seeds")
    next_id = con.execute("SELECT COALESCE(MAX(id), 0) + 1 FROM seeds").fetchone()[0]
    con.execute("INSERT INTO seeds (id, text) VALUES (?, ?);", [next_id, text])
    return _read_state(con)


@app.post("/consume-seeds")
def consume_seeds(req: dict):
    """Delete seeds by ID list. Called by agent after reading them."""
    ids = req.get("ids", [])
    if not ids:
        return {"deleted": 0}
    con = connect()
    placeholders = ",".join("?" for _ in ids)
    con.execute(f"DELETE FROM seeds WHERE id IN ({placeholders});", [int(i) for i in ids])
    return {"deleted": len(ids)}


@app.post("/set-trajectory", response_model=StateOut)
def set_trajectory(req: SetTrajectoryRequest):
    con = connect()

    # Build SET clause dynamically based on whether default_temperature is provided
    if req.default_temperature is not None:
        con.execute("""
          UPDATE controls SET
            vote_1 = 0, vote_2 = 0, vote_3 = 0,
            vote_label_1 = ?, vote_label_2 = ?, vote_label_3 = ?,
            trajectory_reason = ?,
            default_temperature = ?,
            updated_at = CURRENT_TIMESTAMP
          WHERE id=1;
        """, [req.label_1.strip()[:40], req.label_2.strip()[:40], req.label_3.strip()[:40],
              (req.reason or "").strip()[:500], float(req.default_temperature)])
    else:
        con.execute("""
          UPDATE controls SET
            vote_1 = 0, vote_2 = 0, vote_3 = 0,
            vote_label_1 = ?, vote_label_2 = ?, vote_label_3 = ?,
            trajectory_reason = ?,
            updated_at = CURRENT_TIMESTAMP
          WHERE id=1;
        """, [req.label_1.strip()[:40], req.label_2.strip()[:40], req.label_3.strip()[:40],
              (req.reason or "").strip()[:500]])

    # Reset per-IP rate limits for the new cycle
    con.execute("DELETE FROM ip_rate_limits")
    return _read_state(con)


@app.post("/publish", response_model=StateOut)
def publish(req: PublishRequest):
    """Publish a new artifact via HTTP. Only the API touches DuckDB."""
    con = connect()

    try:
        con.execute(
            """INSERT INTO artifacts
               (id, brain, cycle, artifact_type, title, body_markdown, monologue_public,
                channel, source_platform, source_id, source_parent_id, source_url,
                search_queries, temperature)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);""",
            [int(req.id), req.brain, req.cycle, req.artifact_type,
             req.title, req.body_markdown, req.monologue_public,
             req.channel, req.source_platform, req.source_id,
             req.source_parent_id, req.source_url, req.search_queries,
             req.temperature],
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

    return _read_state(con)
