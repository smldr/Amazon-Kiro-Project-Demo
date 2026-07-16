/**
 * Slider management — dynamic creation and event handling.
 *
 * Creates N sliders based on the current level's dimensionality.
 * Each slider represents one input variable to the Griewank function.
 *
 * @module sliders
 */

/**
 * Create slider elements for the given level configuration.
 * @param {HTMLElement} container - DOM element to append sliders into
 * @param {object} levelConfig - Level configuration object
 * @param {number} levelConfig.dimensions - Number of sliders to create
 * @param {number} levelConfig.range[0] - Minimum slider value
 * @param {number} levelConfig.range[1] - Maximum slider value
 * @param {function} onChange - Callback fired on every slider input (during drag). Receives array of all current values.
 * @param {function} [onRelease] - Callback fired on slider release (change event). Receives array of all current values. Used for budget tracking.
 * @returns {object} Slider controller with methods: getValues(), setValues(), destroy()
 */
export function createSliders(container, levelConfig, onChange, onRelease) {
  const { dimensions, range } = levelConfig;
  const [min, max] = range;
  const step = 0.01;

  // Clear existing sliders
  container.innerHTML = "";

  const sliders = [];
  const valueDisplays = [];

  for (let i = 0; i < dimensions; i++) {
    const row = document.createElement("div");
    row.className = "slider-row";

    // Label (x₁, x₂, etc.)
    const label = document.createElement("span");
    label.className = "slider-row__label";
    label.textContent = `x${subscript(i + 1)}`;
    row.appendChild(label);

    // Slider input
    const input = document.createElement("input");
    input.type = "range";
    input.className = "slider-row__input";
    input.min = min;
    input.max = max;
    input.step = step;
    input.value = randomStart(min, max);
    input.setAttribute("aria-label", `Variable x${i + 1}`);
    row.appendChild(input);

    // Value display
    const valueSpan = document.createElement("span");
    valueSpan.className = "slider-row__value mono";
    valueSpan.textContent = formatValue(input.value);
    row.appendChild(valueSpan);

    container.appendChild(row);
    sliders.push(input);
    valueDisplays.push(valueSpan);

    // Event listeners — update on input (real-time) for visualisation
    input.addEventListener("input", () => {
      valueSpan.textContent = formatValue(input.value);
      onChange(getValues());
    });

    // Change event fires once on slider release — used for budget tracking
    input.addEventListener("change", () => {
      if (onRelease) {
        onRelease(getValues());
      }
    });
  }

  function getValues() {
    return sliders.map((s) => parseFloat(s.value));
  }

  function setValues(values) {
    values.forEach((val, i) => {
      if (sliders[i]) {
        sliders[i].value = val;
        valueDisplays[i].textContent = formatValue(val);
      }
    });
  }

  function destroy() {
    container.innerHTML = "";
    sliders.length = 0;
    valueDisplays.length = 0;
  }

  // Fire initial callback with starting values
  onChange(getValues());

  return { getValues, setValues, destroy };
}

/**
 * Generate a random starting value within range.
 * Avoids starting at 0 (the solution) — picks from outer regions.
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
function randomStart(min, max) {
  // Start in a random position, avoiding the center (the solution)
  const halfRange = (max - min) / 2;
  const offset = halfRange * 0.3 + Math.random() * halfRange * 0.6;
  return Math.random() > 0.5 ? offset : -offset;
}

/**
 * Format a slider value for display.
 * @param {number|string} val
 * @returns {string}
 */
function formatValue(val) {
  return parseFloat(val).toFixed(2);
}

/**
 * Convert a number to subscript string representation.
 * @param {number} n
 * @returns {string}
 */
function subscript(n) {
  const subs = "₀₁₂₃₄₅₆₇₈₉";
  return String(n)
    .split("")
    .map((d) => subs[parseInt(d)])
    .join("");
}
