import { griewank1D, griewank2D, linspace } from "./griewank.js";

// Catppuccin Mocha colours
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

  function draw2D(x1, x2, range) {
    const [min, max] = range;
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;
    const padding = { top: 10, right: 10, bottom: 25, left: 25 };
    const plotW = w - padding.left - padding.right;
    const plotH = h - padding.top - padding.bottom;

    clear();

    // Generate or use cached heatmap
    // Use a fixed resolution for the heatmap to avoid expensive recomputation
    const heatmapRes = 100; // 100x100 grid, then stretch to fill
    const rangeKey = `${min},${max},${heatmapRes}`;
    if (!heatmapCache || cachedRange !== rangeKey) {
      heatmapCache = generateHeatmapCanvas(min, max, heatmapRes, heatmapRes);
      cachedRange = rangeKey;
    }

    // Draw heatmap using drawImage (respects transform, scales correctly)
    ctx.drawImage(heatmapCache, padding.left, padding.top, plotW, plotH);

    // Draw axis labels
    ctx.fillStyle = COLORS.overlay0;
    ctx.font = "9px monospace";
    ctx.textAlign = "center";
    ctx.fillText(`x\u2081: ${min}`, padding.left, h - 3);
    ctx.fillText(`${max}`, w - padding.right, h - 3);

    ctx.save();
    ctx.translate(8, padding.top + plotH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = "center";
    ctx.fillText("x\u2082", 0, 0);
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
   * Generate heatmap as an offscreen canvas (so drawImage respects transforms).
   */
  function generateHeatmapCanvas(min, max, width, height) {
    const offscreen = document.createElement("canvas");
    offscreen.width = width;
    offscreen.height = height;
    const offCtx = offscreen.getContext("2d");
    const imageData = offCtx.createImageData(width, height);
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
      const t = Math.min(values[i] / Math.max(maxVal * 0.5, 1), 1);
      const [r, g, b] = heatColor(t);
      const idx = i * 4;
      data[idx] = r;
      data[idx + 1] = g;
      data[idx + 2] = b;
      data[idx + 3] = 255;
    }

    offCtx.putImageData(imageData, 0, 0);
    return offscreen;
  }

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

  function drawGhostDot1D(ghostX, range) {
    const [min, max] = range;
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;
    const padding = { top: 20, right: 20, bottom: 30, left: 40 };
    const plotW = w - padding.left - padding.right;
    const plotH = h - padding.top - padding.bottom;

    // Compute y-axis max (same logic as draw1D)
    const steps = Math.min(200, Math.floor(plotW));
    const xs = linspace(min, max, steps);
    const ys = xs.map((x) => griewank1D(x));
    const yMax = Math.max(...ys, 1);

    function toPixelX(x) {
      return padding.left + ((x - min) / (max - min)) * plotW;
    }
    function toPixelY(y) {
      return padding.top + plotH - (y / yMax) * plotH;
    }

    const ghostVal = griewank1D(ghostX);
    const gpx = toPixelX(ghostX);
    const gpy = toPixelY(ghostVal);

    // Vertical line from x-axis to point (lavender, faded)
    ctx.strokeStyle = COLORS.lavender;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.4;
    ctx.beginPath();
    ctx.moveTo(gpx, padding.top + plotH);
    ctx.lineTo(gpx, gpy);
    ctx.stroke();
    ctx.globalAlpha = 1;

    // Ghost dot
    ctx.fillStyle = COLORS.lavender;
    ctx.beginPath();
    ctx.arc(gpx, gpy, 6, 0, Math.PI * 2);
    ctx.fill();

    // Dot border
    ctx.strokeStyle = COLORS.base;
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  function drawGhostDot2D(x1, x2, range) {
    const [min, max] = range;
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;
    const padding = { top: 10, right: 10, bottom: 25, left: 25 };
    const plotW = w - padding.left - padding.right;
    const plotH = h - padding.top - padding.bottom;

    const gpx = padding.left + ((x1 - min) / (max - min)) * plotW;
    const gpy = padding.top + plotH - ((x2 - min) / (max - min)) * plotH;

    // Ghost dot
    ctx.fillStyle = COLORS.lavender;
    ctx.beginPath();
    ctx.arc(gpx, gpy, 7, 0, Math.PI * 2);
    ctx.fill();

    // Dot border
    ctx.strokeStyle = COLORS.base;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Inner dot
    ctx.fillStyle = COLORS.base;
    ctx.beginPath();
    ctx.arc(gpx, gpy, 2, 0, Math.PI * 2);
    ctx.fill();
  }

  /**
   * Draw a parallel coordinates plot for N-dimensional data.
   * Each dimension gets a vertical axis. The player's position is a polyline.
   *
   * @param {number[]} values - Player's current position (one value per dimension)
   * @param {number[]} range - [min, max] range for all dimensions
   */
  function drawParallelCoords(values, range) {
    const [min, max] = range;
    const n = values.length;
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;
    const padding = { top: 25, right: 30, bottom: 30, left: 30 };
    const plotW = w - padding.left - padding.right;
    const plotH = h - padding.top - padding.bottom;

    clear();

    // Spacing between axes
    const axisSpacing = plotW / (n - 1 || 1);

    // Draw axes
    ctx.strokeStyle = COLORS.surface1;
    ctx.lineWidth = 1;
    for (let i = 0; i < n; i++) {
      const x = padding.left + i * axisSpacing;

      // Axis line
      ctx.beginPath();
      ctx.moveTo(x, padding.top);
      ctx.lineTo(x, padding.top + plotH);
      ctx.stroke();

      // Axis label
      ctx.fillStyle = COLORS.overlay0;
      ctx.font = "9px monospace";
      ctx.textAlign = "center";
      ctx.fillText(`x${subscriptStr(i + 1)}`, x, h - 8);

      // Range labels (top = max, bottom = min)
      ctx.fillStyle = COLORS.surface1;
      ctx.font = "8px monospace";
      ctx.fillText(max.toFixed(0), x, padding.top - 6);
      ctx.fillText(min.toFixed(0), x, padding.top + plotH + 14);
    }

    // Draw zero line across all axes
    const zeroY = padding.top + plotH * (max / (max - min));
    ctx.strokeStyle = COLORS.overlay0;
    ctx.lineWidth = 0.5;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(padding.left, zeroY);
    ctx.lineTo(padding.left + plotW, zeroY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw player polyline
    ctx.strokeStyle = COLORS.yellow;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const x = padding.left + i * axisSpacing;
      const y = padding.top + plotH - ((values[i] - min) / (max - min)) * plotH;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Draw player dots on each axis
    for (let i = 0; i < n; i++) {
      const x = padding.left + i * axisSpacing;
      const y = padding.top + plotH - ((values[i] - min) / (max - min)) * plotH;

      ctx.fillStyle = COLORS.yellow;
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = COLORS.base;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }

  /**
   * Overlay the ghost's position on the parallel coordinates plot.
   *
   * @param {number[]} ghostValues - Ghost's current position
   * @param {number[]} range - [min, max] range
   */
  function drawGhostParallelCoords(ghostValues, range) {
    const [min, max] = range;
    const n = ghostValues.length;
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;
    const padding = { top: 25, right: 30, bottom: 30, left: 30 };
    const plotW = w - padding.left - padding.right;
    const plotH = h - padding.top - padding.bottom;
    const axisSpacing = plotW / (n - 1 || 1);

    // Draw ghost polyline
    ctx.strokeStyle = COLORS.lavender;
    ctx.lineWidth = 2.5;
    ctx.globalAlpha = 0.8;
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const x = padding.left + i * axisSpacing;
      const y = padding.top + plotH - ((ghostValues[i] - min) / (max - min)) * plotH;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;

    // Draw ghost dots on each axis
    for (let i = 0; i < n; i++) {
      const x = padding.left + i * axisSpacing;
      const y = padding.top + plotH - ((ghostValues[i] - min) / (max - min)) * plotH;

      ctx.fillStyle = COLORS.lavender;
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = COLORS.base;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }

  /** Helper: generate subscript string for axis labels. */
  function subscriptStr(n) {
    const subs = "\u2080\u2081\u2082\u2083\u2084\u2085\u2086\u2087\u2088\u2089";
    return String(n).split("").map((d) => subs[parseInt(d)]).join("");
  }

  // Initial resize
  resize();

  // Listen for window resize
  window.addEventListener("resize", () => {
    resize();
  });

  return { draw1D, draw2D, drawParallelCoords, drawGhostDot1D, drawGhostDot2D, drawGhostParallelCoords, clear, resize };
}
