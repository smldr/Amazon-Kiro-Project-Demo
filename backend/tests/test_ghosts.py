"""Tests for the ghost data API endpoint."""

import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from main import app


@pytest.fixture
def client():
    """FastAPI test client."""
    return TestClient(app)


class TestGetGhost:
    """Tests for GET /api/ghosts/{level}."""

    def test_get_ghost_level1(self, client):
        """Returns ghost data for level 1."""
        response = client.get("/api/ghosts/1")
        assert response.status_code == 200
        data = response.json()
        assert data["level"] == 1
        assert data["dimensions"] == 1
        assert data["algorithm"] == "CMA-ES"
        assert "path" in data
        assert "final_position" in data
        assert "final_value" in data

    def test_get_ghost_level2(self, client):
        """Returns ghost data for level 2."""
        response = client.get("/api/ghosts/2")
        assert response.status_code == 200
        data = response.json()
        assert data["level"] == 2
        assert data["dimensions"] == 2

    def test_get_ghost_level3(self, client):
        """Returns ghost data for level 3."""
        response = client.get("/api/ghosts/3")
        assert response.status_code == 200
        data = response.json()
        assert data["level"] == 3
        assert data["dimensions"] == 5

    def test_get_ghost_level4(self, client):
        """Returns ghost data for level 4."""
        response = client.get("/api/ghosts/4")
        assert response.status_code == 200
        data = response.json()
        assert data["level"] == 4
        assert data["dimensions"] == 10

    def test_ghost_path_structure(self, client):
        """Ghost path entries have expected fields."""
        response = client.get("/api/ghosts/1")
        data = response.json()
        for entry in data["path"]:
            assert "eval" in entry
            assert "position" in entry
            assert "value" in entry
            assert isinstance(entry["position"], list)

    def test_invalid_level_zero(self, client):
        """Level 0 returns 422."""
        response = client.get("/api/ghosts/0")
        assert response.status_code == 422

    def test_invalid_level_five(self, client):
        """Level 5 returns 422."""
        response = client.get("/api/ghosts/5")
        assert response.status_code == 422

    def test_invalid_level_negative(self, client):
        """Negative level returns 422."""
        response = client.get("/api/ghosts/-1")
        assert response.status_code == 422

    def test_invalid_level_non_integer(self, client):
        """Non-integer level returns 422."""
        response = client.get("/api/ghosts/abc")
        assert response.status_code == 422
