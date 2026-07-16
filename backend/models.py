"""Pydantic models for request/response schemas."""

from typing import Optional
from pydantic import BaseModel, Field


class ScoreSubmission(BaseModel):
    """Score submission from a player."""
    nickname: str = Field(..., min_length=1, max_length=20)
    level: int = Field(..., ge=1, le=4)
    score: float = Field(..., ge=0.0)
    evals_used: int = Field(..., ge=0)
    path: Optional[list[list[float]]] = None
    round_id: str


class ScoreResponse(BaseModel):
    """Response after submitting a score."""
    id: str
    rank: int
    total_players: int


class ScoreEntry(BaseModel):
    """A single leaderboard entry."""
    id: str
    nickname: str
    level: int
    score: float
    evals_used: int
    submitted_at: str


class RoundCreate(BaseModel):
    """Request to create or advance a round."""
    mode: str = Field(default="challenge")
    levels_open: list[int] = Field(default=[1, 2, 3])
    ai_mode_unlocked: bool = False
    pin: str = Field(..., min_length=1)


class RoundResponse(BaseModel):
    """Round information returned to clients."""
    id: str
    mode: str
    levels_open: list[int]
    ai_mode_unlocked: bool
    started_at: str
    ended_at: Optional[str] = None
