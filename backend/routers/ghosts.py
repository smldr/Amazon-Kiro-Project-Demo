"""Ghost data endpoints — serve pre-computed optimizer traces."""

import json
from pathlib import Path

from fastapi import APIRouter, HTTPException

router = APIRouter(prefix="/api/ghosts", tags=["ghosts"])

GHOSTS_DIR = Path(__file__).parent.parent / "ghosts"


@router.get("/{level}")
async def get_ghost(level: int):
    """Return ghost JSON data for the given level (1-4)."""
    if level < 1 or level > 4:
        raise HTTPException(status_code=422, detail="Level must be between 1 and 4")

    ghost_file = GHOSTS_DIR / f"level{level}.json"
    if not ghost_file.exists():
        raise HTTPException(status_code=404, detail=f"Ghost data for level {level} not found")

    with open(ghost_file, "r") as f:
        data = json.load(f)

    return data
