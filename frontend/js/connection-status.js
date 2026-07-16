/** Connection status indicator — offline/reconnecting/connected banner. */

export const STATE = Object.freeze({
  CONNECTED: "connected",
  RECONNECTING: "reconnecting",
  OFFLINE: "offline",
});

let bannerEl = null;
let iconEl = null;
let textEl = null;
let currentState = STATE.CONNECTED;
let hideTimer = null;
let initialized = false;

export function initConnectionStatus() {
  if (initialized) return;
  initialized = true;
  createBanner();
  window.addEventListener("offline", () => update(STATE.OFFLINE));
  window.addEventListener("online", () => update(STATE.RECONNECTING));
  if (!navigator.onLine) update(STATE.OFFLINE);
}

export function update(state) {
  if (!bannerEl || state === currentState) return;
  currentState = state;
  if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }

  bannerEl.classList.remove(
    "connection-status--connected",
    "connection-status--reconnecting",
    "connection-status--offline"
  );

  switch (state) {
    case STATE.OFFLINE:
      bannerEl.classList.add("connection-status--offline");
      iconEl.textContent = "\u25CF";
      textEl.textContent = "Offline";
      bannerEl.setAttribute("aria-live", "assertive");
      break;
    case STATE.RECONNECTING:
      bannerEl.classList.add("connection-status--reconnecting");
      iconEl.textContent = "\u25CC";
      textEl.textContent = "Reconnecting\u2026";
      bannerEl.setAttribute("aria-live", "polite");
      break;
    case STATE.CONNECTED:
      bannerEl.classList.add("connection-status--connected");
      bannerEl.style.transform = "translateY(0)";
      iconEl.textContent = "\u25CF";
      textEl.textContent = "Connected";
      bannerEl.setAttribute("aria-live", "polite");
      hideTimer = setTimeout(() => {
        bannerEl.style.transform = "";
        bannerEl.classList.remove("connection-status--connected");
      }, 2000);
      break;
  }
}

export function getState() { return currentState; }

function createBanner() {
  bannerEl = document.createElement("div");
  bannerEl.className = "connection-status";
  bannerEl.setAttribute("role", "status");
  bannerEl.setAttribute("aria-live", "polite");
  bannerEl.setAttribute("aria-label", "Connection status");
  iconEl = document.createElement("span");
  iconEl.className = "connection-status__icon";
  iconEl.setAttribute("aria-hidden", "true");
  textEl = document.createElement("span");
  textEl.className = "connection-status__text";
  bannerEl.appendChild(iconEl);
  bannerEl.appendChild(textEl);
  document.body.insertBefore(bannerEl, document.body.firstChild);
}
