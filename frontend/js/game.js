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
  };

  // Initialise visualisation
  if (elements.canvas) {
    state.vis = createVisualisation(elements.canvas);
  }

  // Render level selector
  renderLevelSelector(elements.levelSelector, state, elements);

  // Load the starting level
  loadLevel(state, elements);

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
    (values) => onSliderChange(values, state, elements, levelConfig)
  );
}

/**
 * Handle slider value changes — update function value, visualisation, budget.
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
 */
function renderLevelSelector(container, state, elements) {
  if (!container) return;

  container.innerHTML = "";

  LEVELS.forEach((level) => {
    const btn = document.createElement("button");
    btn.className = "level-selector__btn";
    btn.textContent = `${level.id}D`;
    btn.title = level.description;

    if (level.id === state.currentLevel) {
      btn.classList.add("level-selector__btn--active");
    }

    btn.addEventListener("click", () => {
      state.currentLevel = level.id;
      // Update active state on all buttons
      container.querySelectorAll(".level-selector__btn").forEach((b) => {
        b.classList.remove("level-selector__btn--active");
      });
      btn.classList.add("level-selector__btn--active");
      loadLevel(state, elements);
    });

    container.appendChild(btn);
  });
}
