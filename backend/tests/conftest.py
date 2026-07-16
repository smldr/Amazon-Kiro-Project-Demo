"""Shared test fixtures for the backend test suite."""

import json
from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient

from main import app
from database import get_connection, init_db


@pytest.fixture(autouse=True)
def fresh_db(tmp_path, monkeypatch):
    """Use a temporary database for each test."""
    import database

    test_db = tmp_path / "test.db"
    monkeypatch.setattr(database, "DATABASE_PATH", test_db)
    init_db()
    yield


@pytest.fixture
def seeded_round(fresh_db):
    """Seed a single active round (round-1) for tests that need one."""
    conn = get_connection()
    conn.execute(
        "INSERT INTO rounds (id, mode, levels_open, ai_mode_unlocked, started_at) VALUES (?, ?, ?, ?, ?)",
        ("round-1", "challenge", json.dumps([1, 2, 3]), 0, datetime.now(timezone.utc).isoformat()),
    )
    conn.commit()
    conn.close()


@pytest.fixture
def client():
    """FastAPI test client."""
    return TestClient(app)
