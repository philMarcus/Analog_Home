from pydantic import BaseModel, Field
from typing import Literal, Optional

VoteChoice = Literal["explore", "exploit", "reflect"]

class VoteRequest(BaseModel):
    choice: VoteChoice
    # Optional bounded adjustments
    temperature: Optional[float] = Field(default=None, ge=0.0, le=2.0)
    focus_keyword: Optional[str] = Field(default=None, max_length=40)

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

class ControlsOut(BaseModel):
    temperature: float
    focus_keyword: str
    vote_explore: int
    vote_exploit: int
    vote_reflect: int
    updated_at: str

class StateOut(BaseModel):
    artifact: Optional[ArtifactOut]
    controls: ControlsOut
