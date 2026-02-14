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
    """Agent sets new vote labels and resets counts."""
    label_1: str = Field(max_length=MAX_LABEL_LENGTH)
    label_2: str = Field(max_length=MAX_LABEL_LENGTH)
    label_3: str = Field(max_length=MAX_LABEL_LENGTH)
    reason: str = Field(default="", max_length=500)


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


class ControlsOut(BaseModel):
    temperature: float
    vote_1: int
    vote_2: int
    vote_3: int
    vote_label_1: str
    vote_label_2: str
    vote_label_3: str
    trajectory_reason: str = ""
    updated_at: str


class StateOut(BaseModel):
    artifact: Optional[ArtifactOut]
    controls: ControlsOut
    seeds: List[SeedOut]
