"""Tests for the score submission and leaderboard endpoints."""

import pytest


@pytest.fixture(autouse=True)
def _with_round(seeded_round):
    """Ensure a seeded round exists for all score tests."""
    pass


class TestPostScores:
    """Tests for POST /api/scores."""

    def test_submit_score_returns_rank(self, client):
        resp = client.post("/api/scores", json={
            "nickname": "alice",
            "level": 1,
            "score": 0.05,
            "evals_used": 30,
            "round_id": "round-1",
        })
        assert resp.status_code == 200
        data = resp.json()
        assert "id" in data
        assert data["rank"] == 1
        assert data["total_players"] == 1

    def test_rank_ordering(self, client):
        # Submit three scores — rank should reflect ascending score order
        client.post("/api/scores", json={
            "nickname": "alice", "level": 1, "score": 0.10, "evals_used": 30, "round_id": "round-1"
        })
        client.post("/api/scores", json={
            "nickname": "bob", "level": 1, "score": 0.02, "evals_used": 35, "round_id": "round-1"
        })
        resp = client.post("/api/scores", json={
            "nickname": "charlie", "level": 1, "score": 0.05, "evals_used": 28, "round_id": "round-1"
        })
        data = resp.json()
        # charlie (0.05) is better than alice (0.10) but worse than bob (0.02)
        assert data["rank"] == 2
        assert data["total_players"] == 3

    def test_invalid_round_returns_404(self, client):
        resp = client.post("/api/scores", json={
            "nickname": "alice", "level": 1, "score": 0.05, "evals_used": 30, "round_id": "nonexistent"
        })
        assert resp.status_code == 404

    def test_empty_nickname_returns_422(self, client):
        resp = client.post("/api/scores", json={
            "nickname": "", "level": 1, "score": 0.05, "evals_used": 30, "round_id": "round-1"
        })
        assert resp.status_code == 422

    def test_level_out_of_range_returns_422(self, client):
        resp = client.post("/api/scores", json={
            "nickname": "alice", "level": 5, "score": 0.05, "evals_used": 30, "round_id": "round-1"
        })
        assert resp.status_code == 422

    def test_score_with_path(self, client):
        resp = client.post("/api/scores", json={
            "nickname": "alice",
            "level": 2,
            "score": 0.03,
            "evals_used": 20,
            "path": [[1.2, -0.5], [0.8, -0.3]],
            "round_id": "round-1",
        })
        assert resp.status_code == 200
        assert resp.json()["rank"] == 1


class TestGetScores:
    """Tests for GET /api/scores."""

    def _seed_scores(self, client):
        """Helper to submit several scores."""
        scores = [
            ("alice", 1, 0.10, 30),
            ("bob", 1, 0.02, 35),
            ("charlie", 1, 0.05, 28),
            ("dave", 2, 0.50, 20),
        ]
        for nick, level, score, evals in scores:
            client.post("/api/scores", json={
                "nickname": nick, "level": level, "score": score, "evals_used": evals, "round_id": "round-1"
            })

    def test_returns_sorted_ascending(self, client):
        self._seed_scores(client)
        resp = client.get("/api/scores")
        assert resp.status_code == 200
        data = resp.json()
        scores = [entry["score"] for entry in data]
        assert scores == sorted(scores)

    def test_filter_by_level(self, client):
        self._seed_scores(client)
        resp = client.get("/api/scores?level=1")
        data = resp.json()
        assert len(data) == 3
        assert all(entry["level"] == 1 for entry in data)

    def test_filter_by_round_id(self, client):
        self._seed_scores(client)
        resp = client.get("/api/scores?round_id=round-1")
        data = resp.json()
        assert len(data) == 4

    def test_pagination_limit(self, client):
        self._seed_scores(client)
        resp = client.get("/api/scores?limit=2")
        data = resp.json()
        assert len(data) == 2

    def test_pagination_offset(self, client):
        self._seed_scores(client)
        resp = client.get("/api/scores?limit=2&offset=2")
        data = resp.json()
        assert len(data) == 2
        # Should skip the first 2 (bob=0.02, charlie=0.05) and return (alice=0.10, dave=0.50)
        assert data[0]["nickname"] == "alice"
        assert data[1]["nickname"] == "dave"

    def test_empty_leaderboard(self, client):
        resp = client.get("/api/scores")
        assert resp.status_code == 200
        assert resp.json() == []
