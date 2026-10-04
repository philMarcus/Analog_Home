from pydantic import BaseModel, Field
from typing import Literal, Optional, List

MAX_SEED_LENGTH = 200
MAX_LABEL_LENGTH = 40


class VoteRequest(BaseModel):
    choice: Literal["1", "2", "3"]
    temperature: Optional[float] = Field(default=None, ge=0.0, le=2.0)


class SeedRequest(BaseModel):
    text: str = Field(max_length=MAX_SEED_LENGTH)


class SetTrajectoryRequest(BaseModel):
    """Agent sets new vote labels, resets counts, and optionally sets default temperature."""
    label_1: str = Field(max_length=MAX_LABEL_LENGTH)
    label_2: str = Field(max_length=MAX_LABEL_LENGTH)
    label_3: str = Field(max_length=MAX_LABEL_LENGTH)
    reason: str = Field(default="", max_length=500)
    default_temperature: Optional[float] = Field(default=None, ge=0.0, le=2.0)


class SeedOut(BaseModel):
    id: int
    text: str
    created_at: str


class ArtifactOut(BaseModel):
    id: int
    created_at: str
    brain: str
    cycle: Optional[int]
    artifact_type: str
    title: str
    body_markdown: str
    monologue_public: str
    channel: str
    source_platform: str
    source_id: str
    source_parent_id: str
    source_url: str
    search_queries: str = ""
    temperature: Optional[float] = None
    run_id: str = ""
    image_url: str = ""


class ControlsOut(BaseModel):
    temperature: float
    default_temperature: float = 0.7
    vote_1: int
    vote_2: int
    vote_3: int
    vote_label_1: str
    vote_label_2: str
    vote_label_3: str
    trajectory_reason: str = ""
    updated_at: str
    tagline: str = ""


class StateOut(BaseModel):
    artifact: Optional[ArtifactOut]
    controls: ControlsOut
    seeds: List[SeedOut]

# --- Semantic recall (pgvector) ---

class EmbeddingItem(BaseModel):
    """One embedded document: an artifact field or a non-artifact doc (memory note)."""
    artifact_id: Optional[int] = None
    source_ref: str = Field(default="", max_length=160)
    kind: str = Field(max_length=32)           # artifact_body | artifact_monologue | memory_note | post_memory
    brain: str = Field(default="", max_length=100)
    run_id: str = Field(default="", max_length=64)
    cycle: Optional[int] = None
    text: str
    model: str = Field(max_length=64)
    embedding: List[float]


class EmbeddingsUpsertRequest(BaseModel):
    items: List[EmbeddingItem] = Field(max_length=200)


class RecallRequest(BaseModel):
    embedding: List[float]
    k: int = Field(default=8, ge=1, le=50)
    kinds: List[str] = Field(default_factory=list)
    artifact_types: List[str] = Field(default_factory=list)
    run_id: str = ""              # restrict to one run
    exclude_run_id: str = ""      # e.g. the current run, to recall only previous lives
    min_score: float = Field(default=0.0, ge=-1.0, le=1.0)
    snippet_chars: int = Field(default=600, ge=50, le=4000)

