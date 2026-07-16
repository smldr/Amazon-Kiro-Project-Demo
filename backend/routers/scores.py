"""Score submission and leaderboard endpoints."""
import json
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
import sqlite3

from database import get_db
from models import ScoreSubmission, ScoreResponse, ScoreEntry

router = APIRouter(prefix="/api/scores", tags=["scores"])


@router.post("", response_model=ScoreResponse)
async def submit_score(
    submission: ScoreSubmission,
    background_tasks: BackgroundTasks,
    conn: sqlite3.Connection = Depends(get_db),
):
    """Accept a score submission, store it, and return the player's rank."""
    # Verify the round exists
    row = conn.execute(
        "SELECT id FROM rounds WHERE id = ?", (submission.round_id,)
    ).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Round not found")

    score_id = str(uuid.uuid4())
    submitted_at = datetime.now(timezone.utc).isoformat()

    # Serialize the path if provided
    path_json = json.dumps(submission.path) if submission.path else None

    conn.execute(
        """INSERT INTO scores (id, round_id, nickname, level, score, evals_used, path, submitted_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            score_id,
            submission.round_id,
            submission.nickname,
            submission.level,
            submission.score,
            submission.evals_used,
            path_json,
            submitted_at,
        ),
    )
    conn.commit()

    # Compute rank: higher level beats lower level; within same level, lower score wins
    # Count scores that are strictly better: either higher level, or same level with lower score
    rank_row = conn.execute(
        """SELECT COUNT(*) as better FROM scores
           WHERE round_id = ? AND (
             level > ? OR (level = ? AND score < ?)
           )""",
        (submission.round_id, submission.level, submission.level, submission.score),
    ).fetchone()
    rank = rank_row["better"] + 1

    # Total players in same round (overall, not per-level)
    total_row = conn.execute(
        """SELECT COUNT(*) as total FROM scores
           WHERE round_id = ?""",
        (submission.round_id,),
    ).fetchone()
    total_players = total_row["total"]

    # Broadcast leaderboard update to all WebSocket clients
    from routers.websocket import broadcast_leaderboard
    background_tasks.add_task(broadcast_leaderboard)

    return ScoreResponse(id=score_id, rank=rank, total_players=total_players)


@router.get("", response_model=list[ScoreEntry])
def get_scores(
    level: Optional[int] = Query(None, ge=1, le=4),
    round_id: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    conn: sqlite3.Connection = Depends(get_db),
):
    """Return the sorted leaderboard with optional filters and pagination."""
    query = "SELECT id, nickname, level, score, evals_used, submitted_at FROM scores"
    conditions = []
    params: list = []

    if level is not None:
        conditions.append("level = ?")
        params.append(level)

    if round_id is not None:
        conditions.append("round_id = ?")
        params.append(round_id)

    if conditions:
        query += " WHERE " + " AND ".join(conditions)

    # Lower score is better, but higher level is better
    # Sort by level DESC first (reward harder levels), then score ASC within same level
    query += " ORDER BY level DESC, score ASC LIMIT ? OFFSET ?"
    params.extend([limit, offset])

    rows = conn.execute(query, params).fetchall()

    return [
        ScoreEntry(
            id=row["id"],
            nickname=row["nickname"],
            level=row["level"],
            score=row["score"],
            evals_used=row["evals_used"],
            submitted_at=row["submitted_at"],
        )
        for row in rows
    ]
