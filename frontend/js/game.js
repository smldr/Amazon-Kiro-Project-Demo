/**
 * Game state machine — level config, mode management, orchestration.
 *
 * This is the central coordinator. It manages:
 * - Level configuration (dimensions, ranges, budgets)
 * - Game modes (explore, challenge, ai)
 * - Function value display and colour coding
 * - Communication between sliders, visualisation, and scoring
 *
 * @module game
 */

import { griewank } from "./griewank.js";
import { createSliders } from "./sliders.js";
import { createVisualisation } from "./visualisation.js";
import { submitScore as postScore, getRound } from "./api.js";

// ============================================================
// Level Configuration
// ============================================================

export const LEVELS = [
  {
    id: 1,
    name: "Level 1",
    dimensions: 1,
    range: [-5, 5],
    budget: 40,
    description: "1D — One slider, visible landscape",
  },
  {
    id: 2,
    name: "Level 2",
    dimensions: 2,
    range: [-5, 5],
    budget: 35,
    description: "2D — Two sliders, contour map",
  },
  {
    id: 3,
    name: "Level 3",
    dimensions: 5,
    range: [-5, 5],
    budget: 30,
    description: "5D — Five sliders, no visualisation",
  },
  {
    id: 4,
    name: "Level 4",
    dimensions: 10,
    range: [-5, 5],
    budget: 25,
    description: "10D — Ten sliders, pure strategy",
  },
];

// ============================================================
// Game Modes
// ============================================================

export const MODES = {
  EXPLORE: "explore",
  CHALLENGE: "challenge",
  AI: "ai",
};

// ============================================================
// Level Progression (localStorage-backed)
// ============================================================

const STORAGE_KEY = "optimgame_unlocked_levels";

/**
 * Get the list of unlocked level IDs from localStorage.
 * Level 1 is always unlocked by default.
 *
 * @returns {number[]} Array of unlocked level IDs, e.g. [1, 2]
 */
export function getUnlockedLevels() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Ensure level 1 is always included
        if (!parsed.includes(1)) {
          parsed.unshift(1);
        }
        return parsed;
      }
    }
  } catch (e) {
    // If localStorage is unavailable or data is corrupt, fall back to default
  }
  return [1];
}

/**
 * Unlock the next level after the given current level.
 * Persists to localStorage so unlocks survive page reloads.
 *
 * @param {number} currentLevel - The level just completed
 * @returns {number[]} Updated array of unlocked levels
 */
export function unlockNextLevel(currentLevel) {
  const unlocked = getUnlockedLevels();
  const nextLevel = currentLevel + 1;

  // Only unlock if the next level exists and isn't already unlocked
  const maxLevel = LEVELS[LEVELS.length - 1].id;
  if (nextLevel <= maxLevel && !unlocked.includes(nextLevel)) {
    unlocked.push(nextLevel);
    unlocked.sort((a, b) => a - b);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(unlocked));
    } catch (e) {
      // localStorage unavailable — unlock won't persist but game still works
    }
  }

  return unlocked;
}

// ============================================================
// Game State
// ============================================================

/**
 * Initialise the game on the game page.
 * Reads mode and level from URL params, sets up sliders and visualisation.
 *
 * Expected URL params:
 *   ?mode=explore&level=1&nickname=alice
 *
 * @param {object} elements - DOM element references
 * @param {HTMLElement} elements.sliderContainer - Where to render sliders
 * @param {HTMLCanvasElement} elements.canvas - Visualisation canvas
 * @param {HTMLElement} elements.fnValue - Element to display f(x) value
 * @param {HTMLElement} elements.progressFill - Progress bar fill element
 * @param {HTMLElement} elements.levelLabel - Level name display
 * @param {HTMLElement} elements.budgetLabel - Budget display (challenge mode)
 * @param {HTMLElement} elements.visContainer - Visualisation wrapper (to show/hide)
 * @param {HTMLElement} elements.levelSelector - Level button container
 */
export function initGame(elements) {
  const params = new URLSearchParams(window.location.search);
  const mode = params.get("mode") || MODES.EXPLORE;
  const startLevel = parseInt(params.get("level")) || 1;
  const nickname = params.get("nickname") || "player";

  const state = {
    mode,
    nickname,
    currentLevel: startLevel,
    evalsUsed: 0,
    budget: 0,
    path: [],
    currentValues: [],
    currentScore: 0,
    sliderController: null,
    vis: null,
    gameOver: false,
    submitted: false,
  };

  // Initialise visualisation
  if (elements.canvas) {
    state.vis = createVisualisation(elements.canvas);
  }

  // Render level selector
  renderLevelSelector(elements.levelSelector, state, elements);

  // Load the starting level
  loadLevel(state, elements);

  // Set up submit button for challenge/AI modes
  setupSubmitButton(state, elements);

  return state;
}

/**
 * Load a level — create sliders, reset state, update UI.
 */
function loadLevel(state, elements) {
  const levelConfig = LEVELS.find((l) => l.id === state.currentLevel);
  if (!levelConfig) return;

  // Reset state for new level
  state.evalsUsed = 0;
  state.budget = levelConfig.budget;
  state.path = [];
  state.gameOver = false;
  state.submitted = false;
  state.currentValues = [];
  state.currentScore = 0;

  // Update level label
  if (elements.levelLabel) {
    elements.levelLabel.textContent = `${levelConfig.name} — ${levelConfig.description}`;
  }

  // Update budget display
  updateBudgetDisplay(state, elements);

  // Show/hide visualisation based on dimensions
  if (elements.visContainer) {
    elements.visContainer.style.display = levelConfig.dimensions <= 2 ? "block" : "none";
  }

  // Destroy old sliders
  if (state.sliderController) {
    state.sliderController.destroy();
  }

  // Create new sliders
  state.sliderController = createSliders(
    elements.sliderContainer,
    levelConfig,
    (values) => onSliderChange(values, state, elements, levelConfig),
    (values) => onSliderRelease(values, state, elements, levelConfig)
  );
}

/**
 * Handle slider value changes — update function value, visualisation.
 * Fires continuously during drag (input event).
 */
function onSliderChange(values, state, elements, levelConfig) {
  state.currentValues = values;

  // Compute function value
  const fValue = griewank(values);
  state.currentScore = fValue;

  // Update function value display
  updateFnValueDisplay(fValue, elements);

  // Update visualisation
  if (state.vis && levelConfig.dimensions === 1) {
    state.vis.draw1D(values[0], levelConfig.range);
  } else if (state.vis && levelConfig.dimensions === 2) {
    state.vis.draw2D(values[0], values[1], levelConfig.range);
  }
}

/**
 * Handle slider release — decrement budget, record path, check game over.
 * Fires once on slider release (change event). Only active in Challenge/AI modes.
 */
function onSliderRelease(values, state, elements, levelConfig) {
  // Budget tracking only applies to Challenge and AI modes
  if (state.mode === MODES.EXPLORE) return;

  // Don't count if game is already over
  if (state.gameOver) return;

  // Decrement budget
  state.evalsUsed++;

  // Record path snapshot
  const fValue = griewank(values);
  state.path.push({ position: [...values], value: fValue });

  // Update budget display
  updateBudgetDisplay(state, elements);

  // Check if budget exhausted
  const remaining = state.budget - state.evalsUsed;
  if (remaining <= 0) {
    state.gameOver = true;
    // Auto-submit when budget exhausted
    submitScore(state, elements);
  }
}

// ============================================================
// Score Submission
// ============================================================

const SCORES_STORAGE_KEY = "optimgame_scores";

/**
 * Submit the player's score — store locally, POST to backend, and show result.
 * Validates that a nickname is set (Requirement 5.7).
 *
 * @param {object} state - Current game state
 * @param {object} elements - DOM element references
 */
async function submitScore(state, elements) {
  // Prevent double submission
  if (state.submitted) return;

  // Validate nickname (Requirement 5.7)
  if (!state.nickname || state.nickname.trim() === "" || state.nickname === "player") {
    alert("Please set a nickname before submitting a score. Return to the menu and enter your nickname.");
    return;
  }

  state.submitted = true;
  state.gameOver = true;

  // Get the current round (if any) for backend submission
  let roundId = null;
  try {
    const round = await getRound();
    if (round) {
      roundId = round.id;
    }
  } catch (e) {
    // No active round or network issue — continue with local-only submission
  }

  // Build score data object
  const scoreData = {
    nickname: state.nickname,
    level: state.currentLevel,
    score: state.currentScore,
    evals_used: state.evalsUsed,
    path: state.path,
    round_id: roundId,
    timestamp: new Date().toISOString(),
  };

  // Store in localStorage as backup (Requirement: score submission failure backup)
  storeScoreLocally(scoreData);

  // Submit to backend if we have a round
  let backendResult = null;
  if (roundId) {
    try {
      // Backend expects path as array of position arrays (list[list[float]])
      const pathForBackend = state.path.map((entry) => entry.position);
      backendResult = await postScore({
        nickname: scoreData.nickname,
        level: scoreData.level,
        score: scoreData.score,
        evals_used: scoreData.evals_used,
        path: pathForBackend,
        round_id: roundId,
      });
    } catch (e) {
      // Backend submission failed — localStorage backup is the fallback
      console.warn("Backend score submission failed:", e.message);
    }
  }

  // Unlock next level (level progression)
  unlockNextLevel(state.currentLevel);

  // Re-render level selector to reflect newly unlocked level
  renderLevelSelector(elements.levelSelector, state, elements);

  // Show submission result overlay (with rank info if available)
  showScoreResult(state, elements, backendResult);

  // Disable sliders
  if (state.sliderController) {
    const container = elements.sliderContainer;
    if (container) {
      container.querySelectorAll("input").forEach((input) => {
        input.disabled = true;
      });
    }
  }

  // Hide submit button
  if (elements.submitSection) {
    elements.submitSection.style.display = "none";
  }
}

/**
 * Store score data in localStorage as a backup.
 * Maintains an array of past submissions under the key 'optimgame_scores'.
 *
 * @param {object} scoreData - Score submission object
 */
function storeScoreLocally(scoreData) {
  try {
    const existing = localStorage.getItem(SCORES_STORAGE_KEY);
    const scores = existing ? JSON.parse(existing) : [];
    scores.push(scoreData);
    localStorage.setItem(SCORES_STORAGE_KEY, JSON.stringify(scores));
  } catch (e) {
    // localStorage unavailable — score won't be backed up but game continues
  }
}

/**
 * Show the score result overlay after submission.
 *
 * @param {object} state - Current game state
 * @param {object} elements - DOM element references
 * @param {object|null} backendResult - Backend response with rank info (or null)
 */
function showScoreResult(state, elements, backendResult = null) {
  if (elements.finalScoreDisplay) {
    elements.finalScoreDisplay.textContent = `f(x) = ${state.currentScore.toFixed(4)}`;

    // Apply colour coding to final score
    elements.finalScoreDisplay.classList.remove(
      "fn-value--excellent", "fn-value--good", "fn-value--ok", "fn-value--far"
    );
    if (state.currentScore < 0.01) {
      elements.finalScoreDisplay.classList.add("fn-value--excellent");
    } else if (state.currentScore < 0.1) {
      elements.finalScoreDisplay.classList.add("fn-value--good");
    } else if (state.currentScore < 1.0) {
      elements.finalScoreDisplay.classList.add("fn-value--ok");
    } else {
      elements.finalScoreDisplay.classList.add("fn-value--far");
    }
  }

  if (elements.evalsUsedDisplay) {
    const remaining = state.budget - state.evalsUsed;
    elements.evalsUsedDisplay.textContent =
      `Used ${state.evalsUsed} of ${state.budget} evaluations (${remaining} remaining)`;
  }

  // Show rank info if available from backend
  if (elements.rankDisplay && backendResult) {
    elements.rankDisplay.textContent =
      `Rank: ${backendResult.rank} of ${backendResult.total_players}`;
    elements.rankDisplay.style.display = "block";
  }

  if (elements.scoreResultOverlay) {
    elements.scoreResultOverlay.style.display = "flex";
  }
}

/**
 * Set up the submit button — show it in challenge/AI modes,
 * wire click handler.
 *
 * @param {object} state - Current game state
 * @param {object} elements - DOM element references
 */
function setupSubmitButton(state, elements) {
  if (!elements.submitSection || !elements.submitBtn) return;

  // Only show submit button in challenge/AI modes
  if (state.mode === MODES.EXPLORE) {
    elements.submitSection.style.display = "none";
    return;
  }

  elements.submitSection.style.display = "block";

  // Wire click handler
  elements.submitBtn.addEventListener("click", () => {
    if (!state.gameOver && !state.submitted) {
      submitScore(state, elements);
    }
  });
}

/**
 * Update the function value display with colour coding.
 */
function updateFnValueDisplay(value, elements) {
  if (!elements.fnValue) return;

  elements.fnValue.textContent = `f(x) = ${value.toFixed(4)}`;

  // Remove all colour classes
  elements.fnValue.classList.remove(
    "fn-value--excellent",
    "fn-value--good",
    "fn-value--ok",
    "fn-value--far"
  );

  // Apply colour class based on proximity to 0
  if (value < 0.01) {
    elements.fnValue.classList.add("fn-value--excellent");
  } else if (value < 0.1) {
    elements.fnValue.classList.add("fn-value--good");
  } else if (value < 1.0) {
    elements.fnValue.classList.add("fn-value--ok");
  } else {
    elements.fnValue.classList.add("fn-value--far");
  }

  // Update progress bar
  if (elements.progressFill) {
    // Map value to width (inverse — lower value = more progress)
    const maxDisplay = 5; // Values above this show as 0% progress
    const progress = Math.max(0, 1 - value / maxDisplay) * 100;
    elements.progressFill.style.width = `${progress}%`;

    // Colour the progress bar
    if (value < 0.01) {
      elements.progressFill.style.backgroundColor = "var(--color-success)";
    } else if (value < 0.1) {
      elements.progressFill.style.backgroundColor = "var(--accent-primary)";
    } else if (value < 1.0) {
      elements.progressFill.style.backgroundColor = "var(--color-warning)";
    } else {
      elements.progressFill.style.backgroundColor = "var(--color-danger)";
    }
  }
}

/**
 * Update the budget display (only visible in challenge/AI modes).
 */
function updateBudgetDisplay(state, elements) {
  if (!elements.budgetLabel) return;

  if (state.mode === MODES.EXPLORE) {
    elements.budgetLabel.style.display = "none";
    return;
  }

  elements.budgetLabel.style.display = "inline";
  const remaining = state.budget - state.evalsUsed;
  elements.budgetLabel.textContent = `Budget: ${remaining}`;

  // Colour coding
  elements.budgetLabel.className = "game-header__budget";
  if (remaining < 5) {
    elements.budgetLabel.classList.add("game-header__budget--danger");
  } else if (remaining < 10) {
    elements.budgetLabel.classList.add("game-header__budget--warning");
  }
}

/**
 * Render level selector buttons.
 * In Challenge/AI modes, locked levels are disabled.
 * In Explore mode, all levels are always accessible.
 */
function renderLevelSelector(container, state, elements) {
  if (!container) return;

  container.innerHTML = "";

  const unlocked = getUnlockedLevels();
  const isLocked = (levelId) =>
    state.mode !== MODES.EXPLORE && !unlocked.includes(levelId);

  LEVELS.forEach((level) => {
    const btn = document.createElement("button");
    btn.className = "level-selector__btn";
    btn.title = level.description;

    if (level.id === state.currentLevel) {
      btn.classList.add("level-selector__btn--active");
    }

    if (isLocked(level.id)) {
      btn.disabled = true;
      btn.textContent = `🔒 ${level.id}D`;
      btn.title = `${level.description} (locked — complete previous level to unlock)`;
    } else {
      btn.textContent = `${level.id}D`;

      btn.addEventListener("click", () => {
        state.currentLevel = level.id;
        // Update active state on all buttons
        container.querySelectorAll(".level-selector__btn").forEach((b) => {
          b.classList.remove("level-selector__btn--active");
        });
        btn.classList.add("level-selector__btn--active");
        loadLevel(state, elements);
      });
    }

    container.appendChild(btn);
  });
}
