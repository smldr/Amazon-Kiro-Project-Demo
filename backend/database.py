"""SQLite database setup and connection management."""

import sqlite3
from pathlib import Path

DATABASE_PATH = Path(__file__).parent / "scores.db"


def get_connection() -> sqlite3.Connection:
    """Create a new SQLite connection with row factory enabled."""
    conn = sqlite3.connect(str(DATABASE_PATH), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_db() -> None:
    """Create tables if they don't exist, and ensure a default round is active."""
    conn = get_connection()
    try:
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS rounds (
                id TEXT PRIMARY KEY,
                mode TEXT NOT NULL DEFAULT 'challenge',
                levels_open TEXT NOT NULL DEFAULT '[1,2,3]',
                ai_mode_unlocked INTEGER NOT NULL DEFAULT 0,
                started_at TEXT NOT NULL,
                ended_at TEXT
            );

            CREATE TABLE IF NOT EXISTS scores (
                id TEXT PRIMARY KEY,
                round_id TEXT NOT NULL REFERENCES rounds(id),
                nickname TEXT NOT NULL,
                level INTEGER NOT NULL,
                score REAL NOT NULL,
                evals_used INTEGER NOT NULL,
                path TEXT,
                submitted_at TEXT NOT NULL
            );
        """)
        conn.commit()

        # Ensure there's always an active round so scores can be submitted
        active = conn.execute(
            "SELECT id FROM rounds WHERE ended_at IS NULL LIMIT 1"
        ).fetchone()
        if active is None:
            import uuid
            from datetime import datetime, timezone
            round_id = str(uuid.uuid4())
            now = datetime.now(timezone.utc).isoformat()
            conn.execute(
                """INSERT INTO rounds (id, mode, levels_open, ai_mode_unlocked, started_at)
                   VALUES (?, 'challenge', '[1,2,3,4]', 0, ?)""",
                (round_id, now),
            )
            conn.commit()
            print(f"[init_db] Created default round: {round_id}")
    finally:
        conn.close()


def get_db():
    """FastAPI dependency that yields a database connection."""
    conn = get_connection()
    try:
        yield conn
    finally:
        conn.close()
