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
import { submitScore as postScore, getRound, getGhost } from "./api.js";
import { createGhostPlayer } from "./ghost.js";

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
    ghostPlayer: null,
    ghostState: null,
    ghostData: null,
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

  // Hide ghost display by default
  if (elements.ghostDisplay) {
    elements.ghostDisplay.style.display = "none";
  }

  // Stop any existing ghost player
  if (state.ghostPlayer) {
    state.ghostPlayer.stop();
    state.ghostPlayer = null;
    state.ghostState = null;
    state.ghostData = null;
  }

  // In AI mode, fetch and start ghost replay
  if (state.mode === MODES.AI) {
    startGhostReplay(state, elements, levelConfig);
  }
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
    // Overlay ghost dot if in AI mode
    if (state.ghostState && state.ghostState.position) {
      state.vis.drawGhostDot1D(state.ghostState.position[0], levelConfig.range);
    }
  } else if (state.vis && levelConfig.dimensions === 2) {
    state.vis.draw2D(values[0], values[1], levelConfig.range);
    // Overlay ghost dot if in AI mode
    if (state.ghostState && state.ghostState.position) {
      state.vis.drawGhostDot2D(state.ghostState.position[0], state.ghostState.position[1], levelConfig.range);
    }
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
// Ghost Replay (AI Mode)
// ============================================================

/**
 * Fetch ghost data and start the ghost replay for the current level.
 * Updates the ghost display and overlays the ghost dot on visualisation.
 */
async function startGhostReplay(state, elements, levelConfig) {
  try {
    const ghostData = await getGhost(levelConfig.id);

    // Store ghost data on state for comparison summary (Requirement 6.5)
    state.ghostData = ghostData;

    // Create ghost player
    state.ghostPlayer = createGhostPlayer({ rate: 1000 });

    // Show ghost display
    if (elements.ghostDisplay) {
      elements.ghostDisplay.style.display = "block";
    }

    // Set algorithm name and total evals
    if (elements.ghostAlgorithm) {
      elements.ghostAlgorithm.textContent = ghostData.algorithm || "CMA-ES";
    }
    if (elements.ghostTotalEvals) {
      elements.ghostTotalEvals.textContent = ghostData.budget;
    }

    // On each tick, update ghost display and redraw visualisation with ghost overlay
    state.ghostPlayer.onTick((ghostState) => {
      if (!ghostState) return;
      state.ghostState = ghostState;

      // Update ghost text display
      if (elements.ghostFnValue) {
        elements.ghostFnValue.textContent = ghostState.value.toFixed(4);
      }
      if (elements.ghostEvalCount) {
        elements.ghostEvalCount.textContent = ghostState.eval;
      }

      // Redraw visualisation with ghost dot overlay (for levels 1-2)
      redrawWithGhost(state, elements, levelConfig);
    });

    // Start the replay
    state.ghostPlayer.start(ghostData);
  } catch (e) {
    console.warn("Failed to load ghost data:", e.message);
    // Ghost unavailable — game continues without it
  }
}

/**
 * Redraw the visualisation with the ghost dot overlaid.
 * The player dot is drawn first (via draw1D/draw2D), then the ghost dot on top.
 */
function redrawWithGhost(state, elements, levelConfig) {
  if (!state.vis || !state.ghostState) return;
  if (levelConfig.dimensions > 2) return; // No visualisation for 3D+

  const ghostPos = state.ghostState.position;

  if (levelConfig.dimensions === 1 && state.currentValues.length >= 1) {
    // Redraw full 1D plot (player), then overlay ghost
    state.vis.draw1D(state.currentValues[0], levelConfig.range);
    state.vis.drawGhostDot1D(ghostPos[0], levelConfig.range);
  } else if (levelConfig.dimensions === 2 && state.currentValues.length >= 2) {
    // Redraw full 2D plot (player), then overlay ghost
    state.vis.draw2D(state.currentValues[0], state.currentValues[1], levelConfig.range);
    state.vis.drawGhostDot2D(ghostPos[0], ghostPos[1], levelConfig.range);
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

  // Show AI comparison summary in AI mode
  if (state.mode === MODES.AI && state.ghostData) {
    showAiComparison(state, elements);
  }

  if (elements.scoreResultOverlay) {
    elements.scoreResultOverlay.style.display = "flex";
  }
}

/**
 * Show the AI comparison summary in the score result overlay.
 * Displays player's result vs. the ghost's result side by side,
 * with a verdict indicating who performed better.
 *
 * Requirement 6.5: Display comparison summary when both ghost and player have
 * exhausted their budgets.
 *
 * @param {object} state - Current game state (must have ghostData set)
 * @param {object} elements - DOM element references
 */
function showAiComparison(state, elements) {
  if (!elements.aiComparison) return;

  const ghostData = state.ghostData;
  if (!ghostData) return;

  const playerScore = state.currentScore;
  const playerEvals = state.evalsUsed;
  const ghostScore = ghostData.final_value;
  const ghostBudget = ghostData.budget;
  const algorithm = ghostData.algorithm || "CMA-ES";

  // Populate player results
  if (elements.playerResult) {
    elements.playerResult.textContent = playerScore.toFixed(4);
  }
  if (elements.playerEvals) {
    elements.playerEvals.textContent = playerEvals;
  }

  // Populate ghost results
  if (elements.ghostAlgorithmLabel) {
    elements.ghostAlgorithmLabel.textContent = `${algorithm}:`;
  }
  if (elements.ghostResult) {
    elements.ghostResult.textContent = ghostScore.toFixed(4);
  }
  if (elements.ghostEvals) {
    elements.ghostEvals.textContent = ghostBudget;
  }

  // Determine winner (lower score is better)
  const playerRow = elements.aiComparison.querySelector(".ai-comparison__row--player");
  const ghostRow = elements.aiComparison.querySelector(".ai-comparison__row--ghost");

  if (elements.comparisonVerdict) {
    // Remove existing verdict classes
    elements.comparisonVerdict.classList.remove(
      "ai-comparison__verdict--player-wins",
      "ai-comparison__verdict--ghost-wins",
      "ai-comparison__verdict--tie"
    );

    if (playerRow) playerRow.classList.remove("ai-comparison__row--winner");
    if (ghostRow) ghostRow.classList.remove("ai-comparison__row--winner");

    if (Math.abs(playerScore - ghostScore) < 1e-6) {
      // Tie
      elements.comparisonVerdict.textContent = "It's a tie!";
      elements.comparisonVerdict.classList.add("ai-comparison__verdict--tie");
    } else if (playerScore < ghostScore) {
      // Player wins
      elements.comparisonVerdict.textContent = "You beat the AI!";
      elements.comparisonVerdict.classList.add("ai-comparison__verdict--player-wins");
      if (playerRow) playerRow.classList.add("ai-comparison__row--winner");
    } else {
      // Ghost wins
      elements.comparisonVerdict.textContent = `${algorithm} wins this round.`;
      elements.comparisonVerdict.classList.add("ai-comparison__verdict--ghost-wins");
      if (ghostRow) ghostRow.classList.add("ai-comparison__row--winner");
    }
  }

  // Show the comparison section
  elements.aiComparison.style.display = "block";
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
