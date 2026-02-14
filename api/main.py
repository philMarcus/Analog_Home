import time
from typing import List, Optional
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from db import init_db, connect, close, effective_temperature, MAX_SEEDS_RETURNED
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


def _read_state(con):
    ctrl = con.execute("""
      SELECT temperature, temp_set_at, vote_1, vote_2, vote_3,
             vote_label_1, vote_label_2, vote_label_3, updated_at,
             trajectory_reason
      FROM controls WHERE id=1
    """).fetchone()

    art = con.execute("""
      SELECT id, created_at, brain, cycle, artifact_type,
             title, body_markdown, monologue_public,
             channel, source_platform, source_id, source_parent_id, source_url,
             search_queries
      FROM artifacts
      ORDER BY created_at DESC
      LIMIT 1
    """).fetchone()

    seeds_rows = con.execute("""
      SELECT id, text, created_at FROM seeds
      ORDER BY created_at DESC LIMIT ?
    """, [MAX_SEEDS_RETURNED]).fetchall()

    controls = {
        "temperature": effective_temperature(float(ctrl[0]), ctrl[1]),
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
        artifact = {
            "id": int(art[0]),
            "created_at": str(art[1]),
            "brain": art[2] or "",
            "cycle": art[3],
            "artifact_type": art[4] or "",
            "title": art[5] or "",
            "body_markdown": art[6] or "",
            "monologue_public": art[7] or "",
            "channel": art[8] or "",
            "source_platform": art[9] or "",
            "source_id": art[10] or "",
            "source_parent_id": art[11] or "",
            "source_url": art[12] or "",
            "search_queries": art[13] or "",
        }

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
    }


@app.get("/artifacts", response_model=List[ArtifactOut])
def get_artifacts(limit: int = Query(default=5, ge=1, le=50)):
    con = connect()
    rows = con.execute("""
      SELECT id, created_at, brain, cycle, artifact_type,
             title, body_markdown, monologue_public,
             channel, source_platform, source_id, source_parent_id, source_url,
             search_queries
      FROM artifacts
      ORDER BY created_at DESC
      LIMIT ?
    """, [limit]).fetchall()
    return [_art_row_to_dict(r) for r in rows]


@app.post("/vote", response_model=StateOut)
def post_vote(req: VoteRequest):
    con = connect()
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
def post_temperature(req: dict):
    """Set temperature directly (without voting)."""
    t = req.get("temperature")
    if t is None:
        raise HTTPException(status_code=400, detail="temperature required")
    t = max(0.0, min(2.0, float(t)))
    con = connect()
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
    con.execute("""
      UPDATE controls SET
        vote_1 = 0, vote_2 = 0, vote_3 = 0,
        vote_label_1 = ?, vote_label_2 = ?, vote_label_3 = ?,
        trajectory_reason = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id=1;
    """, [req.label_1.strip()[:40], req.label_2.strip()[:40], req.label_3.strip()[:40],
          (req.reason or "").strip()[:500]])
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
                search_queries)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);""",
            [int(req.id), req.brain, req.cycle, req.artifact_type,
             req.title, req.body_markdown, req.monologue_public,
             req.channel, req.source_platform, req.source_id,
             req.source_parent_id, req.source_url, req.search_queries],
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

    return _read_state(con)
