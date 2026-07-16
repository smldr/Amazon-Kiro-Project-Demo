/**
 * API client — REST calls and WebSocket connection to the backend.
 *
 * All functions use the same origin as the page (backend serves frontend).
 * WebSocket includes exponential backoff auto-reconnect (capped at 5s).
 *
 * @module api
 */

// ============================================================
// Base URL Configuration
// ============================================================

const BASE_URL = window.location.origin;

/**
 * Derive WebSocket URL from the current page location.
 * Uses wss:// for https:// pages, ws:// otherwise.
 */
function getWsUrl(path) {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}${path}`;
}

// ============================================================
// REST API Functions
// ============================================================

/**
 * Submit a score to the backend leaderboard.
 *
 * @param {object} scoreData
 * @param {string} scoreData.nickname - Player nickname (1-20 chars)
 * @param {number} scoreData.level - Level ID (1-4)
 * @param {number} scoreData.score - Final Griewank value (≥ 0)
 * @param {number} scoreData.evals_used - Number of evaluations used
 * @param {Array} scoreData.path - Array of position snapshots
 * @param {string} scoreData.round_id - Active round ID
 * @returns {Promise<{id: string, rank: number, total_players: number}>}
 * @throws {Error} If submission fails
 */
export async function submitScore({ nickname, level, score, evals_used, path, round_id }) {
  const response = await fetch(`${BASE_URL}/api/scores`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nickname, level, score, evals_used, path, round_id }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Score submission failed (${response.status}): ${detail}`);
  }

  return response.json();
}

/**
 * Get the leaderboard scores sorted by score ascending (lower is better).
 *
 * @param {object} [options={}]
 * @param {number} [options.level] - Filter by level (1-4)
 * @param {string} [options.round_id] - Filter by round ID
 * @param {number} [options.limit=50] - Max entries to return
 * @param {number} [options.offset=0] - Pagination offset
 * @returns {Promise<Array<{id, nickname, level, score, evals_used, submitted_at}>>}
 */
export async function getScores(options = {}) {
  const params = new URLSearchParams();

  if (options.level != null) params.set("level", String(options.level));
  if (options.round_id != null) params.set("round_id", options.round_id);
  if (options.limit != null) params.set("limit", String(options.limit));
  if (options.offset != null) params.set("offset", String(options.offset));

  const query = params.toString();
  const url = `${BASE_URL}/api/scores${query ? "?" + query : ""}`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch scores (${response.status})`);
  }

  return response.json();
}

/**
 * Get the current active round state.
 *
 * @returns {Promise<object|null>} Round object or null if no active round
 */
export async function getRound() {
  const response = await fetch(`${BASE_URL}/api/rounds`);

  if (response.status === 404) {
    // No active round
    return null;
  }

  if (!response.ok) {
    throw new Error(`Failed to fetch round (${response.status})`);
  }

  return response.json();
}

// ============================================================
// WebSocket Connection
// ============================================================

/**
 * Create a WebSocket connection to the leaderboard endpoint.
 * Automatically reconnects with exponential backoff (1s, 2s, 3s, capped at 5s).
 *
 * @param {object} callbacks
 * @param {function} callbacks.onUpdate - Called with array of score entries on leaderboard updates
 * @param {function} callbacks.onPlayerCount - Called with player count number
 * @returns {{ close: function }} Object with close() method to cleanly disconnect
 */
export function connectLeaderboard({ onUpdate, onPlayerCount }) {
  let ws = null;
  let reconnectAttempt = 0;
  let reconnectTimer = null;
  let closed = false;

  function connect() {
    if (closed) return;

    const url = getWsUrl("/ws/leaderboard");
    ws = new WebSocket(url);

    ws.addEventListener("open", () => {
      // Reset backoff on successful connection
      reconnectAttempt = 0;
    });

    ws.addEventListener("message", (event) => {
      try {
        const msg = JSON.parse(event.data);

        if (msg.type === "leaderboard_update" && onUpdate) {
          onUpdate(msg.data);
        } else if (msg.type === "player_count" && onPlayerCount) {
          onPlayerCount(msg.count);
        }
      } catch (e) {
        // Ignore malformed messages
      }
    });

    ws.addEventListener("close", () => {
      if (closed) return;
      scheduleReconnect();
    });

    ws.addEventListener("error", () => {
      // Error will be followed by close — reconnect handled there
      if (ws) {
        ws.close();
      }
    });
  }

  function scheduleReconnect() {
    if (closed) return;

    reconnectAttempt++;
    // Backoff: 1s, 2s, 3s, 4s, 5s (capped)
    const delay = Math.min(reconnectAttempt * 1000, 5000);

    reconnectTimer = setTimeout(() => {
      connect();
    }, delay);
  }

  function close() {
    closed = true;
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    if (ws) {
      ws.close();
      ws = null;
    }
  }

  // Start the initial connection
  connect();

  return { close };
}
