import time
from typing import Optional
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from db import init_db, connect, close
from models import VoteRequest, StateOut
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


app = FastAPI(title="Analog I API")

# Local dev: Next runs on 3000, API on 8000
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
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


def _read_state(con):
    ctrl = con.execute("""
      SELECT temperature, focus_keyword, vote_explore, vote_exploit, vote_reflect, updated_at
      FROM controls WHERE id=1
    """).fetchone()

    art = con.execute("""
      SELECT id, created_at, brain, cycle, artifact_type,
             title, body_markdown, monologue_public,
             channel, source_platform, source_id, source_parent_id, source_url
      FROM artifacts
      ORDER BY created_at DESC
      LIMIT 1
    """).fetchone()

    controls = {
        "temperature": float(ctrl[0]),
        "focus_keyword": ctrl[1],
        "vote_explore": int(ctrl[2]),
        "vote_exploit": int(ctrl[3]),
        "vote_reflect": int(ctrl[4]),
        "updated_at": str(ctrl[5]),
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
        }

    return {"artifact": artifact, "controls": controls}


@app.get("/state", response_model=StateOut)
def get_state():
    con = connect()
    return _read_state(con)


@app.post("/vote", response_model=StateOut)
def post_vote(req: VoteRequest):
    con = connect()

    if req.choice == "explore":
        con.execute("UPDATE controls SET vote_explore = vote_explore + 1, updated_at = CURRENT_TIMESTAMP WHERE id=1;")
    elif req.choice == "exploit":
        con.execute("UPDATE controls SET vote_exploit = vote_exploit + 1, updated_at = CURRENT_TIMESTAMP WHERE id=1;")
    else:
        con.execute("UPDATE controls SET vote_reflect = vote_reflect + 1, updated_at = CURRENT_TIMESTAMP WHERE id=1;")

    if req.temperature is not None:
        con.execute(
            "UPDATE controls SET temperature = ?, updated_at = CURRENT_TIMESTAMP WHERE id=1;",
            [float(req.temperature)]
        )

    if req.focus_keyword is not None:
        fk = req.focus_keyword.strip().lower()[:40]
        con.execute(
            "UPDATE controls SET focus_keyword = ?, updated_at = CURRENT_TIMESTAMP WHERE id=1;",
            [fk]
        )

    return _read_state(con)


@app.post("/publish", response_model=StateOut)
def publish(req: PublishRequest):
    """
    Publish a new artifact (title/body/monologue) via HTTP.
    This lets your agent (or push_fake_cycle) write through the API so only the API touches DuckDB.
    """
    con = connect()

    try:
        con.execute(
            """INSERT INTO artifacts
               (id, brain, cycle, artifact_type, title, body_markdown, monologue_public,
                channel, source_platform, source_id, source_parent_id, source_url)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);""",
            [int(req.id), req.brain, req.cycle, req.artifact_type,
             req.title, req.body_markdown, req.monologue_public,
             req.channel, req.source_platform, req.source_id,
             req.source_parent_id, req.source_url],
        )
    except Exception as e:
        # Most common: duplicate id
        raise HTTPException(status_code=400, detail=str(e))

    return _read_state(con)
