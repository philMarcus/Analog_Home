import json
import time
from typing import List, Optional
from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware

from db import init_db, get_pool, close, effective_temperature, MAX_SEEDS_RETURNED, MAX_SEEDS, MAX_VOTES_PER_IP
from models import ArtifactOut, VoteRequest, SeedRequest, SetTrajectoryRequest, StateOut
from pydantic import BaseModel, Field


class DaemonTickRequest(BaseModel):
    tick: int
    brain: str = ""
    run_id: str = ""
    lines: List[str] = []
    sentry_interval: int = 300
    complete: bool = False


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
    run_id: str = Field(default="", max_length=64)
    image_url: str = Field(default="", max_length=800000)


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


@app.on_event("shutdown")
def _shutdown():
    close()


@app.get("/healthz")
def healthz():
    """Lightweight health check — verifies Postgres is reachable."""
    with get_pool().connection() as conn:
        conn.execute("SELECT 1").fetchone()
    return {"ok": True}


_ART_COLS = """id, created_at, brain, cycle, artifact_type,
             title, body_markdown, monologue_public,
             channel, source_platform, source_id, source_parent_id, source_url,
             search_queries, temperature, run_id, image_url"""


def _read_state(conn):
    ctrl = conn.execute("""
      SELECT temperature, temp_set_at, vote_1, vote_2, vote_3,
             vote_label_1, vote_label_2, vote_label_3, updated_at,
             trajectory_reason, default_temperature, tagline
      FROM controls WHERE id=1
    """).fetchone()

    art = conn.execute(f"""
      SELECT {_ART_COLS}
      FROM artifacts
      ORDER BY created_at DESC
      LIMIT 1
    """).fetchone()

    seeds_rows = conn.execute("""
      SELECT id, text, created_at FROM seeds
      ORDER BY created_at ASC LIMIT %s
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
        "tagline": ctrl[11] or "" if len(ctrl) > 11 else "",
    }

    artifact = None
    if art:
        artifact = _art_row_to_dict(art)

    seeds = [{"id": int(r[0]), "text": r[1] or "", "created_at": str(r[2])} for r in seeds_rows]

    return {"artifact": artifact, "controls": controls, "seeds": seeds}


@app.get("/state", response_model=StateOut)
def get_state():
    with get_pool().connection() as conn:
        return _read_state(conn)


def _art_row_to_dict(row, slim: bool = False) -> dict:
    image_url = row[16] or "" if len(row) > 16 else ""
    d = {
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
        "run_id": row[15] or "" if len(row) > 15 else "",
        "image_url": "" if slim else image_url,
        "has_image": bool(image_url),
    }
    return d


@app.get("/artifacts")
def get_artifacts(
    limit: int = Query(default=5, ge=1, le=50),
    offset: int = Query(default=0, ge=0),
    run_id: Optional[str] = Query(default=None),
    artifact_type: Optional[str] = Query(default=None),
    sort: str = Query(default="desc"),
    include_images: bool = Query(default=False),
):
    order = "ASC" if sort.lower() == "asc" else "DESC"
    with get_pool().connection() as conn:
        conditions = []
        params: list = []
        if run_id:
            conditions.append("run_id = %s")
            params.append(run_id)
        if artifact_type:
            conditions.append("artifact_type = %s")
            params.append(artifact_type)
        where = ("WHERE " + " AND ".join(conditions)) if conditions else ""
        params.extend([limit, offset])
        rows = conn.execute(f"""
          SELECT {_ART_COLS} FROM artifacts
          {where} ORDER BY created_at {order} LIMIT %s OFFSET %s
        """, params).fetchall()
        slim = not include_images
        return [_art_row_to_dict(r, slim=slim) for r in rows]


@app.get("/artifacts/{artifact_id}")
def get_artifact_by_id(artifact_id: int):
    """Get a single artifact by ID."""
    with get_pool().connection() as conn:
        row = conn.execute(f"SELECT {_ART_COLS} FROM artifacts WHERE id = %s", [artifact_id]).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Artifact not found")
        return _art_row_to_dict(row)


@app.get("/featured")
def get_featured():
    """Get the currently featured artifact."""
    with get_pool().connection() as conn:
        row = conn.execute(f"""
          SELECT {_ART_COLS} FROM artifacts WHERE is_featured = TRUE LIMIT 1
        """).fetchone()
        if row:
            return _art_row_to_dict(row)
        return None


@app.post("/feature/{artifact_id}")
def feature_artifact(artifact_id: int):
    """Mark an artifact as featured (only one at a time)."""
    with get_pool().connection() as conn:
        conn.execute("UPDATE artifacts SET is_featured = FALSE WHERE is_featured = TRUE")
        conn.execute("UPDATE artifacts SET is_featured = TRUE WHERE id = %s", [artifact_id])
        conn.commit()
    return {"ok": True, "featured_id": artifact_id}


@app.get("/latest-image")
def get_latest_image():
    """Return the most recent artifact that has an image_url."""
    with get_pool().connection() as conn:
        row = conn.execute(f"""
          SELECT {_ART_COLS} FROM artifacts
          WHERE image_url IS NOT NULL AND image_url != ''
          ORDER BY created_at DESC LIMIT 1
        """).fetchone()
        if row:
            return _art_row_to_dict(row)
        return None


@app.post("/daemon-tick")
def post_daemon_tick(req: DaemonTickRequest):
    """Push daemon tick lines (per-role, appends to current tick)."""
    with get_pool().connection() as conn:
        existing = conn.execute(
            "SELECT id, tick_data FROM daemon_ticks WHERE tick=%s AND run_id=%s",
            [req.tick, req.run_id]
        ).fetchone()
        if existing:
            data = existing[1] if isinstance(existing[1], dict) else json.loads(existing[1])
            data.setdefault("lines", []).extend(req.lines)
            data["complete"] = req.complete
            data["sentry_interval"] = req.sentry_interval
            conn.execute(
                "UPDATE daemon_ticks SET tick_data=%s, updated_at=CURRENT_TIMESTAMP WHERE id=%s",
                [json.dumps(data), existing[0]]
            )
        else:
            data = {"lines": req.lines, "sentry_interval": req.sentry_interval, "complete": req.complete}
            conn.execute(
                "INSERT INTO daemon_ticks (tick, brain, run_id, tick_data) VALUES (%s,%s,%s,%s)",
                [req.tick, req.brain, req.run_id, json.dumps(data)]
            )
        conn.execute(
            "DELETE FROM daemon_ticks WHERE id NOT IN (SELECT id FROM daemon_ticks ORDER BY created_at DESC LIMIT 50)"
        )
        conn.commit()
    return {"ok": True}


@app.get("/daemon/live")
def get_daemon_live(limit: int = Query(default=10, ge=1, le=50)):
    """Get recent daemon ticks for live terminal display."""
    with get_pool().connection() as conn:
        rows = conn.execute(
            "SELECT tick, created_at, tick_data FROM daemon_ticks ORDER BY created_at DESC LIMIT %s",
            [limit]
        ).fetchall()
    return [{
        "tick": r[0],
        "created_at": str(r[1]),
        "data": r[2] if isinstance(r[2], dict) else json.loads(r[2]) if r[2] else {},
    } for r in reversed(rows)]


@app.get("/audience")
def get_audience_stats():
    """Audience engagement summary for the agent's feedback loop."""
    with get_pool().connection() as conn:
        ctrl = conn.execute("""
          SELECT vote_1, vote_2, vote_3, vote_label_1, vote_label_2, vote_label_3,
                 updated_at, trajectory_reason
          FROM controls WHERE id=1
        """).fetchone()

        # Seed stats
        seed_count = conn.execute("SELECT COUNT(*) FROM seeds").fetchone()[0]
        last_seed = conn.execute(
            "SELECT created_at FROM seeds ORDER BY created_at DESC LIMIT 1"
        ).fetchone()

        # Vote rate stats from ip_rate_limits
        unique_voters = conn.execute(
            "SELECT COUNT(DISTINCT ip) FROM ip_rate_limits WHERE action = 'vote'"
        ).fetchone()[0]
        unique_seeders = conn.execute(
            "SELECT COUNT(DISTINCT ip) FROM ip_rate_limits WHERE action = 'seed'"
        ).fetchone()[0]

        total_votes = (int(ctrl[0]) + int(ctrl[1]) + int(ctrl[2])) if ctrl else 0

        return {
            "total_votes": total_votes,
            "vote_1": int(ctrl[0]) if ctrl else 0,
            "vote_2": int(ctrl[1]) if ctrl else 0,
            "vote_3": int(ctrl[2]) if ctrl else 0,
            "vote_label_1": ctrl[3] or "" if ctrl else "",
            "vote_label_2": ctrl[4] or "" if ctrl else "",
            "vote_label_3": ctrl[5] or "" if ctrl else "",
            "last_vote_at": str(ctrl[6]) if ctrl else None,
            "unique_voters": int(unique_voters),
            "seeds_pending": int(seed_count),
            "unique_seeders": int(unique_seeders),
            "last_seed_at": str(last_seed[0]) if last_seed else None,
        }


@app.get("/artifacts/count")
def get_artifacts_count(run_id: Optional[str] = Query(default=None)):
    with get_pool().connection() as conn:
        if run_id:
            count = conn.execute("SELECT COUNT(*) FROM artifacts WHERE run_id = %s", [run_id]).fetchone()[0]
        else:
            count = conn.execute("SELECT COUNT(*) FROM artifacts").fetchone()[0]
        return {"count": int(count)}


@app.get("/runs")
def get_runs():
    """List all runs with summary info (most recent first), including first artifact title."""
    with get_pool().connection() as conn:
        rows = conn.execute("""
          SELECT r.run_id,
                 r.brain,
                 r.artifact_count,
                 r.started_at,
                 r.last_artifact_at,
                 r.first_cycle,
                 r.last_cycle,
                 ft.title AS first_title
          FROM (
              SELECT run_id,
                     brain,
                     COUNT(*) AS artifact_count,
                     MIN(created_at) AS started_at,
                     MAX(created_at) AS last_artifact_at,
                     MIN(cycle) AS first_cycle,
                     MAX(cycle) AS last_cycle
              FROM artifacts
              WHERE run_id != '' AND run_id IS NOT NULL
              GROUP BY run_id, brain
          ) r
          LEFT JOIN LATERAL (
              SELECT title FROM artifacts
              WHERE run_id = r.run_id
                AND artifact_type NOT LIKE 'system_%%'
                AND title != ''
              ORDER BY created_at ASC
              LIMIT 1
          ) ft ON true
          ORDER BY r.started_at DESC
        """).fetchall()

        runs = []
        for r in rows:
            runs.append({
                "run_id": r[0],
                "brain": r[1],
                "artifact_count": int(r[2]),
                "started_at": str(r[3]),
                "last_artifact_at": str(r[4]),
                "first_cycle": r[5],
                "last_cycle": r[6],
                "first_title": r[7] or "",
            })
        return runs


def _get_client_ip(request: Request) -> str:
    return (request.headers.get("x-forwarded-for", "").split(",")[0].strip()
            or request.client.host)


@app.post("/vote", response_model=StateOut)
def post_vote(req: VoteRequest, request: Request):
    with get_pool().connection() as conn:
        # Rate-limit votes per IP (resets each trajectory cycle)
        ip = _get_client_ip(request)
        row = conn.execute(
            "SELECT count FROM ip_rate_limits WHERE ip = %s AND action = 'vote'", [ip]
        ).fetchone()
        if row and row[0] >= MAX_VOTES_PER_IP:
            raise HTTPException(status_code=429, detail="Vote limit reached (5 per cycle)")
        conn.execute("""
            INSERT INTO ip_rate_limits (ip, action, count) VALUES (%s, 'vote', 1)
            ON CONFLICT (ip, action) DO UPDATE SET count = ip_rate_limits.count + 1
        """, [ip])

        col = f"vote_{req.choice}"
        conn.execute(
            f"UPDATE controls SET {col} = {col} + 1, updated_at = CURRENT_TIMESTAMP WHERE id=1;"
        )

        if req.temperature is not None:
            conn.execute(
                "UPDATE controls SET temperature = %s, temp_set_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id=1;",
                [float(req.temperature)]
            )

        state = _read_state(conn)
        conn.commit()
        return state


@app.post("/temperature", response_model=StateOut)
def post_temperature(req: dict, request: Request):
    """Set temperature directly. One adjustment per IP per cycle, clamped to +/-0.5."""
    t = req.get("temperature")
    if t is None:
        raise HTTPException(status_code=400, detail="temperature required")
    t = float(t)

    with get_pool().connection() as conn:
        ip = _get_client_ip(request)

        # Check if this IP already adjusted temperature this cycle
        row = conn.execute(
            "SELECT count FROM ip_rate_limits WHERE ip = %s AND action = 'temp'", [ip]
        ).fetchone()
        if row:
            raise HTTPException(status_code=429, detail="Temperature already adjusted this cycle")

        # Clamp to +/-0.5 from current effective temperature
        ctrl = conn.execute(
            "SELECT temperature, temp_set_at, default_temperature FROM controls WHERE id=1"
        ).fetchone()
        default_temp = float(ctrl[2]) if ctrl[2] is not None else 0.7
        current = effective_temperature(float(ctrl[0]), ctrl[1], default_temp)
        t = max(current - 0.5, min(current + 0.5, t))
        t = max(0.0, min(2.0, t))

        # Record the adjustment
        conn.execute(
            "INSERT INTO ip_rate_limits (ip, action, count) VALUES (%s, 'temp', 1)", [ip]
        )
        conn.execute(
            "UPDATE controls SET temperature = %s, temp_set_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id=1;",
            [t]
        )
        state = _read_state(conn)
        conn.commit()
        return state


@app.post("/seed", response_model=StateOut)
def post_seed(req: SeedRequest):
    with get_pool().connection() as conn:
        text = req.text.strip()[:200]
        if not text:
            raise HTTPException(status_code=400, detail="Seed text cannot be empty")
        count = conn.execute("SELECT COUNT(*) FROM seeds").fetchone()[0]
        if count >= MAX_SEEDS:
            raise HTTPException(status_code=409, detail="Seedbank full \u2014 wait for the agent to consume seeds")
        next_id = conn.execute("SELECT COALESCE(MAX(id), 0) + 1 FROM seeds").fetchone()[0]
        conn.execute("INSERT INTO seeds (id, text) VALUES (%s, %s);", [next_id, text])
        state = _read_state(conn)
        conn.commit()
        return state


@app.post("/consume-seeds")
def consume_seeds(req: dict):
    """Delete seeds by ID list. Called by agent after reading them."""
    ids = req.get("ids", [])
    if not ids:
        return {"deleted": 0}
    with get_pool().connection() as conn:
        conn.execute("DELETE FROM seeds WHERE id = ANY(%s)", [[int(i) for i in ids]])
        conn.commit()
    return {"deleted": len(ids)}


@app.post("/set-trajectory", response_model=StateOut)
def set_trajectory(req: SetTrajectoryRequest):
    with get_pool().connection() as conn:
        # Build SET clause dynamically based on whether default_temperature is provided
        if req.default_temperature is not None:
            conn.execute("""
              UPDATE controls SET
                vote_1 = 0, vote_2 = 0, vote_3 = 0,
                vote_label_1 = %s, vote_label_2 = %s, vote_label_3 = %s,
                trajectory_reason = %s,
                default_temperature = %s,
                updated_at = CURRENT_TIMESTAMP
              WHERE id=1;
            """, [req.label_1.strip()[:40], req.label_2.strip()[:40], req.label_3.strip()[:40],
                  (req.reason or "").strip()[:500], float(req.default_temperature)])
        else:
            conn.execute("""
              UPDATE controls SET
                vote_1 = 0, vote_2 = 0, vote_3 = 0,
                vote_label_1 = %s, vote_label_2 = %s, vote_label_3 = %s,
                trajectory_reason = %s,
                updated_at = CURRENT_TIMESTAMP
              WHERE id=1;
            """, [req.label_1.strip()[:40], req.label_2.strip()[:40], req.label_3.strip()[:40],
                  (req.reason or "").strip()[:500]])

        # Reset per-IP rate limits for the new cycle
        conn.execute("DELETE FROM ip_rate_limits")
        state = _read_state(conn)
        conn.commit()
        return state


@app.post("/default-temperature", response_model=StateOut)
def set_default_temperature(req: dict):
    """Set the agent's preferred default temperature (the value user nudges decay toward)."""
    t = req.get("temperature")
    if t is None:
        raise HTTPException(status_code=400, detail="temperature required")
    t = max(0.0, min(2.0, float(t)))
    with get_pool().connection() as conn:
        conn.execute(
            "UPDATE controls SET default_temperature = %s, updated_at = CURRENT_TIMESTAMP WHERE id=1;",
            [t]
        )
        state = _read_state(conn)
        conn.commit()
        return state


@app.post("/tagline", response_model=StateOut)
def set_tagline(req: dict):
    """Set the site tagline (agent-controlled subtitle)."""
    text = (req.get("tagline") or "").strip()
    if not text:
        raise HTTPException(status_code=400, detail="tagline required")
    if len(text) > 200:
        text = text[:200]
    with get_pool().connection() as conn:
        conn.execute(
            "UPDATE controls SET tagline = %s, updated_at = CURRENT_TIMESTAMP WHERE id=1;",
            [text]
        )
        state = _read_state(conn)
        conn.commit()
        return state


@app.delete("/artifacts/{artifact_id}")
def delete_artifact(artifact_id: int):
    """Delete a single artifact by ID."""
    with get_pool().connection() as conn:
        result = conn.execute("DELETE FROM artifacts WHERE id = %s", [artifact_id])
        conn.commit()
        if result.rowcount == 0:
            raise HTTPException(status_code=404, detail="Artifact not found")
        return {"deleted": artifact_id}


@app.post("/publish", response_model=StateOut)
def publish(req: PublishRequest):
    """Publish a new artifact."""
    with get_pool().connection() as conn:
        try:
            conn.execute(
                """INSERT INTO artifacts
                   (id, brain, cycle, artifact_type, title, body_markdown, monologue_public,
                    channel, source_platform, source_id, source_parent_id, source_url,
                    search_queries, temperature, run_id, image_url)
                   VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                   ON CONFLICT (id) DO UPDATE SET
                    brain=EXCLUDED.brain, cycle=EXCLUDED.cycle, artifact_type=EXCLUDED.artifact_type,
                    title=EXCLUDED.title, body_markdown=EXCLUDED.body_markdown,
                    monologue_public=EXCLUDED.monologue_public, channel=EXCLUDED.channel,
                    source_platform=EXCLUDED.source_platform, source_id=EXCLUDED.source_id,
                    source_parent_id=EXCLUDED.source_parent_id, source_url=EXCLUDED.source_url,
                    search_queries=EXCLUDED.search_queries, temperature=EXCLUDED.temperature,
                    run_id=EXCLUDED.run_id, image_url=EXCLUDED.image_url;""",
                [int(req.id), req.brain, req.cycle, req.artifact_type,
                 req.title, req.body_markdown, req.monologue_public,
                 req.channel, req.source_platform, req.source_id,
                 req.source_parent_id, req.source_url, req.search_queries,
                 req.temperature, req.run_id, req.image_url],
            )
        except Exception as e:
            raise HTTPException(status_code=400, detail=str(e))

        state = _read_state(conn)
        conn.commit()
        return state
