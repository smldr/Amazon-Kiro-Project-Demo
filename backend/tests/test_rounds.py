"""Tests for round management endpoints."""

import pytest

from database import get_connection


PIN = "1234"
WRONG_PIN = "9999"


class TestCreateRound:
    """Tests for POST /api/rounds."""

    def test_create_round_with_valid_pin(self, client):
        resp = client.post("/api/rounds", json={
            "pin": PIN,
            "mode": "challenge",
            "levels_open": [1, 2, 3],
        })
        assert resp.status_code == 201
        data = resp.json()
        assert data["mode"] == "challenge"
        assert data["levels_open"] == [1, 2, 3]
        assert data["ai_mode_unlocked"] is False
        assert data["ended_at"] is None
        assert "id" in data
        assert "started_at" in data

    def test_create_round_with_invalid_pin_returns_403(self, client):
        resp = client.post("/api/rounds", json={
            "pin": WRONG_PIN,
            "mode": "challenge",
            "levels_open": [1, 2, 3],
        })
        assert resp.status_code == 403

    def test_create_round_with_ai_unlocked(self, client):
        resp = client.post("/api/rounds", json={
            "pin": PIN,
            "mode": "challenge",
            "levels_open": [1, 2, 3, 4],
            "ai_mode_unlocked": True,
        })
        assert resp.status_code == 201
        assert resp.json()["ai_mode_unlocked"] is True

    def test_creating_new_round_ends_previous(self, client):
        # Create the first round
        resp1 = client.post("/api/rounds", json={"pin": PIN})
        round1_id = resp1.json()["id"]

        # Create a second round — first should now be ended
        client.post("/api/rounds", json={"pin": PIN})

        # Verify the first round has ended_at set
        conn = get_connection()
        row = conn.execute("SELECT ended_at FROM rounds WHERE id = ?", (round1_id,)).fetchone()
        conn.close()
        assert row["ended_at"] is not None


class TestGetRound:
    """Tests for GET /api/rounds."""

    def test_returns_active_round(self, client):
        # Create a round first
        create_resp = client.post("/api/rounds", json={"pin": PIN})
        round_id = create_resp.json()["id"]

        resp = client.get("/api/rounds")
        assert resp.status_code == 200
        assert resp.json()["id"] == round_id
        assert resp.json()["ended_at"] is None

    def test_returns_404_when_no_active_round(self, client):
        resp = client.get("/api/rounds")
        assert resp.status_code == 404


class TestEndRound:
    """Tests for DELETE /api/rounds/{round_id}."""

    def test_end_round_with_valid_pin(self, client):
        # Create a round
        create_resp = client.post("/api/rounds", json={"pin": PIN})
        round_id = create_resp.json()["id"]

        # End it
        resp = client.delete(f"/api/rounds/{round_id}?pin={PIN}")
        assert resp.status_code == 200
        assert resp.json()["ended_at"] is not None

    def test_end_round_with_invalid_pin_returns_403(self, client):
        create_resp = client.post("/api/rounds", json={"pin": PIN})
        round_id = create_resp.json()["id"]

        resp = client.delete(f"/api/rounds/{round_id}?pin={WRONG_PIN}")
        assert resp.status_code == 403

    def test_end_nonexistent_round_returns_404(self, client):
        resp = client.delete(f"/api/rounds/fake-id?pin={PIN}")
        assert resp.status_code == 404

    def test_end_already_ended_round_returns_400(self, client):
        create_resp = client.post("/api/rounds", json={"pin": PIN})
        round_id = create_resp.json()["id"]

        # End once
        client.delete(f"/api/rounds/{round_id}?pin={PIN}")
        # Try to end again
        resp = client.delete(f"/api/rounds/{round_id}?pin={PIN}")
        assert resp.status_code == 400


class TestResetLeaderboard:
    """Tests for POST /api/rounds/{round_id}/reset."""

    def test_reset_deletes_scores(self, client):
        # Create a round and submit a score
        create_resp = client.post("/api/rounds", json={"pin": PIN})
        round_id = create_resp.json()["id"]

        client.post("/api/scores", json={
            "nickname": "alice", "level": 1, "score": 0.05, "evals_used": 30, "round_id": round_id
        })

        # Reset
        resp = client.post(f"/api/rounds/{round_id}/reset?pin={PIN}")
        assert resp.status_code == 200
        assert resp.json()["scores_deleted"] == 1

        # Verify scores are gone
        scores_resp = client.get(f"/api/scores?round_id={round_id}")
        assert scores_resp.json() == []

    def test_reset_with_invalid_pin_returns_403(self, client):
        create_resp = client.post("/api/rounds", json={"pin": PIN})
        round_id = create_resp.json()["id"]

        resp = client.post(f"/api/rounds/{round_id}/reset?pin={WRONG_PIN}")
        assert resp.status_code == 403

    def test_reset_nonexistent_round_returns_404(self, client):
        resp = client.post(f"/api/rounds/fake-id/reset?pin={PIN}")
        assert resp.status_code == 404


class TestUpdateRound:
    """Tests for PATCH /api/rounds/{round_id}."""

    def test_unlock_ai_mode(self, client):
        # Create a round with AI mode locked
        create_resp = client.post("/api/rounds", json={
            "pin": PIN,
            "mode": "challenge",
            "levels_open": [1, 2, 3, 4],
            "ai_mode_unlocked": False,
        })
        round_id = create_resp.json()["id"]
        assert create_resp.json()["ai_mode_unlocked"] is False

        # Unlock AI mode
        resp = client.patch(f"/api/rounds/{round_id}", json={
            "pin": PIN,
            "ai_mode_unlocked": True,
        })
        assert resp.status_code == 200
        assert resp.json()["ai_mode_unlocked"] is True

    def test_update_round_with_invalid_pin_returns_403(self, client):
        create_resp = client.post("/api/rounds", json={"pin": PIN})
        round_id = create_resp.json()["id"]

        resp = client.patch(f"/api/rounds/{round_id}", json={
            "pin": WRONG_PIN,
            "ai_mode_unlocked": True,
        })
        assert resp.status_code == 403

    def test_update_nonexistent_round_returns_404(self, client):
        resp = client.patch("/api/rounds/fake-id", json={
            "pin": PIN,
            "ai_mode_unlocked": True,
        })
        assert resp.status_code == 404

    def test_update_round_without_pin_returns_422(self, client):
        create_resp = client.post("/api/rounds", json={"pin": PIN})
        round_id = create_resp.json()["id"]

        resp = client.patch(f"/api/rounds/{round_id}", json={
            "ai_mode_unlocked": True,
        })
        assert resp.status_code == 422

    def test_update_levels_open(self, client):
        create_resp = client.post("/api/rounds", json={
            "pin": PIN,
            "levels_open": [1, 2],
        })
        round_id = create_resp.json()["id"]

        resp = client.patch(f"/api/rounds/{round_id}", json={
            "pin": PIN,
            "levels_open": [1, 2, 3, 4],
        })
        assert resp.status_code == 200
        assert resp.json()["levels_open"] == [1, 2, 3, 4]
