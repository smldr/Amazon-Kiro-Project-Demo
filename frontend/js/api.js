/** API client — REST calls and WebSocket with auto-reconnect. */

import { update as updateConnectionStatus, STATE as CS } from "./connection-status.js";

const BASE_URL = window.location.origin;

function getWsUrl(path) {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}${path}`;
}

export async function submitScore({ nickname, level, score, evals_used, path, round_id }) {
  const payload = { nickname, level, score, evals_used, path, round_id };
  try {
    return await _postScore(payload);
  } catch (firstError) {
    await _delay(2000);
    try {
      return await _postScore(payload);
    } catch (secondError) {
      _storeFailedScore(payload);
      throw new Error(`Score submission failed after retry: ${secondError.message}`);
    }
  }
}

async function _postScore(payload) {
  const response = await fetch(`${BASE_URL}/api/scores`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Score submission failed (${response.status}): ${detail}`);
  }
  return response.json();
}

function _storeFailedScore(payload) {
  try {
    const key = "optimgame_failed_scores";
    const existing = localStorage.getItem(key);
    const scores = existing ? JSON.parse(existing) : [];
    scores.push({ ...payload, failed_at: new Date().toISOString() });
    localStorage.setItem(key, JSON.stringify(scores));
  } catch (e) { /* localStorage unavailable */ }
}

function _delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function getScores(options = {}) {
  const params = new URLSearchParams();
  if (options.level != null) params.set("level", String(options.level));
  if (options.round_id != null) params.set("round_id", options.round_id);
  if (options.limit != null) params.set("limit", String(options.limit));
  if (options.offset != null) params.set("offset", String(options.offset));
  const query = params.toString();
  const url = `${BASE_URL}/api/scores${query ? "?" + query : ""}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to fetch scores (${response.status})`);
  return response.json();
}

export async function getGhost(level) {
  const response = await fetch(`${BASE_URL}/api/ghosts/${level}`);
  if (!response.ok) throw new Error(`Failed to fetch ghost (${response.status})`);
  return response.json();
}

export async function getRound() {
  const response = await fetch(`${BASE_URL}/api/rounds`);
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Failed to fetch round (${response.status})`);
  return response.json();
}

export function connectLeaderboard({ onUpdate, onPlayerCount, onStatusChange }) {
  let ws = null;
  let reconnectAttempt = 0;
  let reconnectTimer = null;
  let closed = false;

  function setStatus(status) {
    if (onStatusChange) onStatusChange(status);
  }

  function connect() {
    if (closed) return;
    setStatus("reconnecting");
    const url = getWsUrl("/ws/leaderboard");
    ws = new WebSocket(url);

    ws.addEventListener("open", () => {
      reconnectAttempt = 0;
      setStatus("connected");
    });

    ws.addEventListener("message", (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === "leaderboard_update" && onUpdate) onUpdate(msg.data);
        else if (msg.type === "player_count" && onPlayerCount) onPlayerCount(msg.count);
      } catch (e) { /* ignore malformed */ }
    });

    ws.addEventListener("close", () => {
      if (closed) return;
      setStatus("reconnecting");
      scheduleReconnect();
    });

    ws.addEventListener("error", () => { if (ws) ws.close(); });
  }

  function scheduleReconnect() {
    if (closed) return;
    reconnectAttempt++;
    const delay = Math.min(1000 * Math.pow(2, reconnectAttempt - 1), 10000);
    reconnectTimer = setTimeout(() => connect(), delay);
  }

  function close() {
    closed = true;
    setStatus("disconnected");
    if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
    if (ws) { ws.close(); ws = null; }
  }

  connect();
  return { close };
}
