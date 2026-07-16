"""Round management endpoints — create, advance, and reset rounds."""

import json
import os
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
import sqlite3

from database import get_db
from models import RoundCreate, RoundResponse

router = APIRouter(prefix="/api/rounds", tags=["rounds"])

OPTIM_PIN = os.environ.get("OPTIM_PIN", "1234")


def _verify_pin(pin: str) -> None:
    """Raise 403 if pin does not match the configured OPTIM_PIN."""
    if pin != OPTIM_PIN:
        raise HTTPException(status_code=403, detail="Invalid PIN")


def _row_to_round(row: sqlite3.Row) -> RoundResponse:
    """Convert a database row to a RoundResponse."""
    return RoundResponse(
        id=row["id"],
        mode=row["mode"],
        levels_open=json.loads(row["levels_open"]),
        ai_mode_unlocked=bool(row["ai_mode_unlocked"]),
        started_at=row["started_at"],
        ended_at=row["ended_at"],
    )


@router.get("", response_model=Optional[RoundResponse])
def get_current_round(
    conn: sqlite3.Connection = Depends(get_db),
):
    """Return the current (most recent, not ended) round. Returns 404 if none active."""
    row = conn.execute(
        "SELECT * FROM rounds WHERE ended_at IS NULL ORDER BY started_at DESC LIMIT 1"
    ).fetchone()

    if row is None:
        raise HTTPException(status_code=404, detail="No active round")

    return _row_to_round(row)


@router.post("", response_model=RoundResponse, status_code=201)
def create_round(
    body: RoundCreate,
    conn: sqlite3.Connection = Depends(get_db),
):
    """Create a new round. Ends the current active round if one exists. PIN-protected."""
    _verify_pin(body.pin)

    now = datetime.now(timezone.utc).isoformat()

    # End any currently active round
    conn.execute(
        "UPDATE rounds SET ended_at = ? WHERE ended_at IS NULL",
        (now,),
    )

    round_id = str(uuid.uuid4())
    levels_open_json = json.dumps(body.levels_open)

    conn.execute(
        """INSERT INTO rounds (id, mode, levels_open, ai_mode_unlocked, started_at)
           VALUES (?, ?, ?, ?, ?)""",
        (
            round_id,
            body.mode,
            levels_open_json,
            int(body.ai_mode_unlocked),
            now,
        ),
    )
    conn.commit()

    return RoundResponse(
        id=round_id,
        mode=body.mode,
        levels_open=body.levels_open,
        ai_mode_unlocked=body.ai_mode_unlocked,
        started_at=now,
        ended_at=None,
    )


@router.delete("/{round_id}", response_model=RoundResponse)
def end_round(
    round_id: str,
    pin: str,
    conn: sqlite3.Connection = Depends(get_db),
):
    """End a specific round by setting ended_at. PIN-protected."""
    _verify_pin(pin)

    row = conn.execute(
        "SELECT * FROM rounds WHERE id = ?", (round_id,)
    ).fetchone()

    if row is None:
        raise HTTPException(status_code=404, detail="Round not found")

    if row["ended_at"] is not None:
        raise HTTPException(status_code=400, detail="Round already ended")

    now = datetime.now(timezone.utc).isoformat()
    conn.execute(
        "UPDATE rounds SET ended_at = ? WHERE id = ?",
        (now, round_id),
    )
    conn.commit()

    return RoundResponse(
        id=row["id"],
        mode=row["mode"],
        levels_open=json.loads(row["levels_open"]),
        ai_mode_unlocked=bool(row["ai_mode_unlocked"]),
        started_at=row["started_at"],
        ended_at=now,
    )


@router.patch("/{round_id}", response_model=RoundResponse)
def update_round(
    round_id: str,
    body: dict,
    conn: sqlite3.Connection = Depends(get_db),
):
    """Update round properties (e.g., ai_mode_unlocked). PIN-protected."""
    pin = body.get("pin")
    if not pin:
        raise HTTPException(status_code=422, detail="PIN required")
    _verify_pin(pin)

    row = conn.execute(
        "SELECT * FROM rounds WHERE id = ?", (round_id,)
    ).fetchone()

    if row is None:
        raise HTTPException(status_code=404, detail="Round not found")

    # Update allowed fields
    if "ai_mode_unlocked" in body:
        conn.execute(
            "UPDATE rounds SET ai_mode_unlocked = ? WHERE id = ?",
            (int(bool(body["ai_mode_unlocked"])), round_id),
        )

    if "levels_open" in body:
        conn.execute(
            "UPDATE rounds SET levels_open = ? WHERE id = ?",
            (json.dumps(body["levels_open"]), round_id),
        )

    if "mode" in body:
        conn.execute(
            "UPDATE rounds SET mode = ? WHERE id = ?",
            (body["mode"], round_id),
        )

    conn.commit()

    # Fetch updated row
    updated = conn.execute(
        "SELECT * FROM rounds WHERE id = ?", (round_id,)
    ).fetchone()

    return _row_to_round(updated)


@router.post("/{round_id}/reset", status_code=200)
def reset_leaderboard(
    round_id: str,
    pin: str,
    conn: sqlite3.Connection = Depends(get_db),
):
    """Delete all scores for a round (reset leaderboard). PIN-protected."""
    _verify_pin(pin)

    row = conn.execute(
        "SELECT id FROM rounds WHERE id = ?", (round_id,)
    ).fetchone()

    if row is None:
        raise HTTPException(status_code=404, detail="Round not found")

    result = conn.execute(
        "DELETE FROM scores WHERE round_id = ?", (round_id,)
    )
    conn.commit()

    return {"detail": "Leaderboard reset", "scores_deleted": result.rowcount}
