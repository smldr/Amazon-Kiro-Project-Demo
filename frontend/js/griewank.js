/**
 * Griewank Function — N-dimensional optimization benchmark.
 *
 * f(x) = 1 + (1/4000) * Σᵢ xᵢ² - Πᵢ cos(xᵢ / √i)
 *
 * Global minimum: f(0, 0, ..., 0) = 0
 * Typical search range: [-5, 5] per dimension
 *
 * @module griewank
 */

/**
 * Evaluate the Griewank function for an N-dimensional input.
 * @param {number[]} x - Array of input values (one per dimension)
 * @returns {number} The function value (0 at the global minimum)
 */
export function griewank(x) {
  const n = x.length;
  if (n === 0) return 0;

  let sumSq = 0;
  let prodCos = 1;

  for (let i = 0; i < n; i++) {
    sumSq += x[i] * x[i];
    prodCos *= Math.cos(x[i] / Math.sqrt(i + 1));
  }

  return 1 + sumSq / 4000 - prodCos;
}

/**
 * Evaluate the 1D Griewank function at a single point.
 * Convenience wrapper for plotting.
 * @param {number} x - Input value
 * @returns {number} The function value
 */
export function griewank1D(x) {
  return griewank([x]);
}

/**
 * Evaluate the 2D Griewank function at a point.
 * Convenience wrapper for contour plotting.
 * @param {number} x1 - First dimension value
 * @param {number} x2 - Second dimension value
 * @returns {number} The function value
 */
export function griewank2D(x1, x2) {
  return griewank([x1, x2]);
}

/**
 * Generate an array of evenly spaced values.
 * Useful for creating plot axes.
 * @param {number} start - Start value
 * @param {number} end - End value
 * @param {number} steps - Number of points
 * @returns {number[]} Array of evenly spaced values
 */
export function linspace(start, end, steps) {
  const arr = new Array(steps);
  const step = (end - start) / (steps - 1);
  for (let i = 0; i < steps; i++) {
    arr[i] = start + step * i;
  }
  return arr;
}
