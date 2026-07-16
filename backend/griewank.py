"""Griewank function — Python implementation matching frontend/js/griewank.js exactly.

f(x) = 1 + (1/4000) * Σᵢ xᵢ² - Πᵢ cos(xᵢ / √i)

Global minimum: f(0, 0, ..., 0) = 0
Typical search range: [-5, 5] per dimension
"""

import math


def griewank(x: list[float]) -> float:
    """Evaluate the Griewank function for an N-dimensional input.

    Args:
        x: Array of input values (one per dimension).

    Returns:
        The function value (0 at the global minimum).
    """
    n = len(x)
    if n == 0:
        return 0.0

    sum_sq = sum(xi * xi for xi in x)
    prod_cos = math.prod(math.cos(xi / math.sqrt(i + 1)) for i, xi in enumerate(x))

    return 1.0 + sum_sq / 4000.0 - prod_cos
