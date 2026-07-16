/**
 * Visualisation module — Canvas-based 1D line plots and 2D contour heatmaps.
 *
 * Renders the Griewank function landscape and shows the player's current position.
 * Only active for levels with 1 or 2 dimensions.
 *
 * @module visualisation
 */

import { griewank1D, griewank2D, linspace } from "./griewank.js";

// Catppuccin Mocha colours (matching CSS vars)
const COLORS = {
  base: "#1e1e2e",
  surface0: "#313244",
  surface1: "#45475a",
  overlay0: "#6c7086",
  text: "#cdd6f4",
  teal: "#94e2d5",
  yellow: "#f9e2af",
  lavender: "#b4befe",
  green: "#a6e3a1",
  peach: "#fab387",
  red: "#f38ba8",
};

/**
 * Create a visualisation renderer for a canvas element.
 * @param {HTMLCanvasElement} canvas - The canvas to draw on
 * @returns {object} Renderer with methods: draw1D(x, range), draw2D(x1, x2, range), clear(), resize()
 */
export function createVisualisation(canvas) {
  const ctx = canvas.getContext("2d");
  let dpr = window.devicePixelRatio || 1;

  // Cache for 2D heatmap (expensive to recompute every frame)
  let heatmapCache = null;
  let cachedRange = null;

  function resize() {
    dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // Invalidate heatmap cache on resize
    heatmapCache = null;
  }

  function clear() {
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;
    ctx.fillStyle = COLORS.surface0;
    ctx.fillRect(0, 0, w, h);
  }

  /**
   * Draw the 1D Griewank function with the player's current position.
   * @param {number} currentX - Player's current x value
   * @param {number[]} range - [min, max] range
   */
  function draw1D(currentX, range) {
    const [min, max] = range;
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;
    const padding = { top: 20, right: 20, bottom: 30, left: 40 };
    const plotW = w - padding.left - padding.right;
    const plotH = h - padding.top - padding.bottom;

    clear();

    // Compute function values
    const steps = Math.min(200, Math.floor(plotW));
    const xs = linspace(min, max, steps);
    const ys = xs.map((x) => griewank1D(x));
    const yMax = Math.max(...ys, 1);

    // Map to pixel coordinates
    function toPixelX(x) {
      return padding.left + ((x - min) / (max - min)) * plotW;
    }

    function toPixelY(y) {
      return padding.top + plotH - (y / yMax) * plotH;
    }

    // Draw axes
    ctx.strokeStyle = COLORS.overlay0;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padding.left, padding.top + plotH);
    ctx.lineTo(padding.left + plotW, padding.top + plotH);
    ctx.stroke();

    // Draw axis labels
    ctx.fillStyle = COLORS.overlay0;
    ctx.font = "10px monospace";
    ctx.textAlign = "center";
    ctx.fillText(min.toFixed(1), padding.left, h - 5);
    ctx.fillText(max.toFixed(1), w - padding.right, h - 5);
    ctx.fillText("0", padding.left + plotW / 2, h - 5);

    // Draw the function curve
    ctx.strokeStyle = COLORS.teal;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i < steps; i++) {
      const px = toPixelX(xs[i]);
      const py = toPixelY(ys[i]);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();

    // Draw zero line
    ctx.strokeStyle = COLORS.overlay0;
    ctx.lineWidth = 0.5;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    const zeroY = toPixelY(0);
    ctx.moveTo(padding.left, zeroY);
    ctx.lineTo(padding.left + plotW, zeroY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw player position
    const playerPx = toPixelX(currentX);
    const playerVal = griewank1D(currentX);
    const playerPy = toPixelY(playerVal);

    // Vertical line from x-axis to point
    ctx.strokeStyle = COLORS.yellow;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.4;
    ctx.beginPath();
    ctx.moveTo(playerPx, padding.top + plotH);
    ctx.lineTo(playerPx, playerPy);
    ctx.stroke();
    ctx.globalAlpha = 1;

    // Player dot
    ctx.fillStyle = COLORS.yellow;
    ctx.beginPath();
    ctx.arc(playerPx, playerPy, 6, 0, Math.PI * 2);
    ctx.fill();

    // Dot border
    ctx.strokeStyle = COLORS.base;
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  /**
   * Draw the 2D Griewank contour heatmap with the player's current position.
   * @param {number} x1 - Player's x₁ value
   * @param {number} x2 - Player's x₂ value
   * @param {number[]} range - [min, max] range (same for both axes)
   */
  function draw2D(x1, x2, range) {
    const [min, max] = range;
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;
    const padding = { top: 10, right: 10, bottom: 25, left: 25 };
    const plotW = w - padding.left - padding.right;
    const plotH = h - padding.top - padding.bottom;

    clear();

    // Generate or use cached heatmap
    const rangeKey = `${min},${max},${Math.round(plotW)},${Math.round(plotH)}`;
    if (!heatmapCache || cachedRange !== rangeKey) {
      heatmapCache = generateHeatmap(min, max, Math.round(plotW), Math.round(plotH));
      cachedRange = rangeKey;
    }

    // Draw heatmap
    ctx.putImageData(heatmapCache, padding.left, padding.top);

    // Draw axis labels
    ctx.fillStyle = COLORS.overlay0;
    ctx.font = "9px monospace";
    ctx.textAlign = "center";
    ctx.fillText(`x₁: ${min}`, padding.left, h - 3);
    ctx.fillText(`${max}`, w - padding.right, h - 3);

    ctx.save();
    ctx.translate(8, padding.top + plotH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = "center";
    ctx.fillText("x₂", 0, 0);
    ctx.restore();

    // Draw player position
    const px = padding.left + ((x1 - min) / (max - min)) * plotW;
    const py = padding.top + plotH - ((x2 - min) / (max - min)) * plotH;

    // Crosshair
    ctx.strokeStyle = COLORS.yellow;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.5;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(px, padding.top);
    ctx.lineTo(px, padding.top + plotH);
    ctx.moveTo(padding.left, py);
    ctx.lineTo(padding.left + plotW, py);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;

    // Player dot
    ctx.fillStyle = COLORS.yellow;
    ctx.beginPath();
    ctx.arc(px, py, 7, 0, Math.PI * 2);
    ctx.fill();

    // Dot border
    ctx.strokeStyle = COLORS.base;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Inner dot
    ctx.fillStyle = COLORS.base;
    ctx.beginPath();
    ctx.arc(px, py, 2, 0, Math.PI * 2);
    ctx.fill();
  }

  /**
   * Generate a heatmap ImageData for the 2D Griewank function.
   * Uses a colour map from teal (low) to red (high).
   */
  function generateHeatmap(min, max, width, height) {
    const imageData = ctx.createImageData(width, height);
    const data = imageData.data;

    // Pre-compute max value for normalisation
    let maxVal = 0;
    const values = new Float32Array(width * height);

    for (let py = 0; py < height; py++) {
      for (let px = 0; px < width; px++) {
        const x1 = min + (px / (width - 1)) * (max - min);
        const x2 = max - (py / (height - 1)) * (max - min); // Flip y-axis
        const val = griewank2D(x1, x2);
        values[py * width + px] = val;
        if (val > maxVal) maxVal = val;
      }
    }

    // Map values to colours
    for (let i = 0; i < values.length; i++) {
      const t = Math.min(values[i] / Math.max(maxVal * 0.5, 1), 1); // Normalise with compression
      const [r, g, b] = heatColor(t);
      const idx = i * 4;
      data[idx] = r;
      data[idx + 1] = g;
      data[idx + 2] = b;
      data[idx + 3] = 255;
    }

    return imageData;
  }

  /**
   * Map a normalised value [0, 1] to an RGB colour.
   * 0 = dark (near minimum) → 1 = bright (high value)
   * Uses a palette-inspired gradient: base → teal → peach → red
   */
  function heatColor(t) {
    // Custom gradient stops
    const stops = [
      { t: 0.0, r: 30, g: 30, b: 46 },     // base
      { t: 0.1, r: 49, g: 50, b: 68 },      // surface0
      { t: 0.3, r: 148, g: 226, b: 213 },   // teal
      { t: 0.6, r: 250, g: 179, b: 135 },   // peach
      { t: 1.0, r: 243, g: 139, b: 168 },   // red
    ];

    // Find surrounding stops
    let lower = stops[0];
    let upper = stops[stops.length - 1];
    for (let i = 0; i < stops.length - 1; i++) {
      if (t >= stops[i].t && t <= stops[i + 1].t) {
        lower = stops[i];
        upper = stops[i + 1];
        break;
      }
    }

    // Interpolate
    const range = upper.t - lower.t;
    const factor = range === 0 ? 0 : (t - lower.t) / range;
    return [
      Math.round(lower.r + (upper.r - lower.r) * factor),
      Math.round(lower.g + (upper.g - lower.g) * factor),
      Math.round(lower.b + (upper.b - lower.b) * factor),
    ];
  }

  // Initial resize
  resize();

  // Listen for window resize
  window.addEventListener("resize", () => {
    resize();
  });

  return { draw1D, draw2D, clear, resize };
}
