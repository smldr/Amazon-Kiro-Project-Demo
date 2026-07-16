"""WebSocket endpoint for real-time leaderboard updates."""

import asyncio
import json
import logging
from typing import Set

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from database import get_connection
from models import ScoreEntry

logger = logging.getLogger(__name__)

router = APIRouter(tags=["websocket"])

# Connected WebSocket clients
connected_clients: Set[WebSocket] = set()


def _get_leaderboard_data() -> list[dict]:
    """Fetch the current leaderboard from the database."""
    conn = get_connection()
    try:
        rows = conn.execute(
            """SELECT id, nickname, level, score, evals_used, submitted_at
               FROM scores ORDER BY score ASC LIMIT 50"""
        ).fetchall()
        return [
            ScoreEntry(
                id=row["id"],
                nickname=row["nickname"],
                level=row["level"],
                score=row["score"],
                evals_used=row["evals_used"],
                submitted_at=row["submitted_at"],
            ).model_dump()
            for row in rows
        ]
    except Exception as e:
        logger.error(f"Error fetching leaderboard: {e}")
        return []
    finally:
        conn.close()


async def _send_player_count():
    """Broadcast current connected player count to all clients."""
    message = json.dumps({
        "type": "player_count",
        "count": len(connected_clients),
    })
    disconnected = set()
    for client in connected_clients:
        try:
            await client.send_text(message)
        except Exception:
            disconnected.add(client)
    connected_clients.difference_update(disconnected)


async def broadcast_leaderboard():
    """Broadcast the current leaderboard to all connected WebSocket clients.

    Call this after a score is submitted to push real-time updates.
    """
    if not connected_clients:
        return

    data = _get_leaderboard_data()
    message = json.dumps({
        "type": "leaderboard_update",
        "data": data,
    })

    disconnected = set()
    for client in connected_clients:
        try:
            await client.send_text(message)
        except Exception:
            disconnected.add(client)
    connected_clients.difference_update(disconnected)


@router.websocket("/ws/leaderboard")
async def websocket_leaderboard(websocket: WebSocket):
    """WebSocket endpoint for real-time leaderboard updates.

    On connection:
    - Accepts the WebSocket
    - Adds client to the connected set
    - Sends the current leaderboard immediately
    - Broadcasts updated player count to all clients
    - Keeps connection alive, handling disconnections gracefully
    """
    await websocket.accept()
    connected_clients.add(websocket)
    logger.info(f"WebSocket client connected. Total: {len(connected_clients)}")

    try:
        # Send current leaderboard to newly connected client
        data = _get_leaderboard_data()
        await websocket.send_text(json.dumps({
            "type": "leaderboard_update",
            "data": data,
        }))

        # Broadcast player count update to all clients
        await _send_player_count()

        # Keep connection alive — listen for messages (ping/pong handled by framework)
        while True:
            # We don't expect client messages, but we need to keep reading
            # to detect disconnections. Client can send ping/keepalive.
            await websocket.receive_text()

    except WebSocketDisconnect:
        logger.info("WebSocket client disconnected normally")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
    finally:
        connected_clients.discard(websocket)
        logger.info(f"WebSocket client removed. Total: {len(connected_clients)}")
        # Broadcast updated player count after disconnection
        await _send_player_count()
