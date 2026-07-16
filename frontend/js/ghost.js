/**
 * Ghost replay engine — loads and replays pre-computed optimizer paths.
 *
 * The ghost player steps through its path at a configurable rate (default 1 eval/second),
 * exposing state that game.js uses to overlay the ghost dot and update the display.
 *
 * @module ghost
 */

/**
 * Create a ghost player that replays optimizer path data.
 *
 * @param {object} [options={}]
 * @param {number} [options.rate=1000] - Replay speed in ms per evaluation step
 * @returns {object} GhostPlayer with start, stop, isPlaying, getCurrentState, onTick methods
 */
export function createGhostPlayer(options = {}) {
  const rate = options.rate || 1000; // ms per evaluation (default: 1 eval/second)

  let ghostData = null;
  let currentIndex = 0;
  let intervalId = null;
  let playing = false;
  let tickCallbacks = [];

  /**
   * Start replaying the ghost data.
   * @param {object} data - Ghost JSON data with path array
   */
  function start(data) {
    stop(); // Clear any existing replay
    ghostData = data;
    currentIndex = 0;
    playing = true;

    // Notify immediately with first position
    notifyTick();

    // Step through remaining positions
    intervalId = setInterval(() => {
      currentIndex++;
      if (currentIndex >= ghostData.path.length) {
        // Ghost has finished its run
        currentIndex = ghostData.path.length - 1;
        stop();
        return;
      }
      notifyTick();
    }, rate);
  }

  /**
   * Stop the ghost replay and clear the timer.
   */
  function stop() {
    if (intervalId !== null) {
      clearInterval(intervalId);
      intervalId = null;
    }
    playing = false;
  }

  /**
   * Check if the ghost is currently replaying.
   * @returns {boolean}
   */
  function isPlaying() {
    return playing;
  }

  /**
   * Get the ghost's current state.
   * @returns {{position: number[], value: number, eval: number, isPlaying: boolean, totalEvals: number, algorithm: string}|null}
   */
  function getCurrentState() {
    if (!ghostData || ghostData.path.length === 0) return null;

    const step = ghostData.path[currentIndex];
    return {
      position: step.position,
      value: step.value,
      eval: step.eval,
      isPlaying: playing,
      totalEvals: ghostData.budget,
      algorithm: ghostData.algorithm,
    };
  }

  /**
   * Register a callback to be notified on each tick (position change).
   * @param {function} callback - Called with getCurrentState() on each step
   */
  function onTick(callback) {
    tickCallbacks.push(callback);
  }

  /**
   * Notify all registered tick callbacks.
   */
  function notifyTick() {
    const state = getCurrentState();
    for (const cb of tickCallbacks) {
      cb(state);
    }
  }

  return { start, stop, isPlaying, getCurrentState, onTick };
}
