"""Tests for the Python Griewank function — cross-validates against known mathematical values.

Validates: Requirements 1.5
"""

import math

import pytest

from griewank import griewank


class TestGriewankZero:
    """griewank([0, 0, ..., 0]) == 0 for various dimensions."""

    @pytest.mark.parametrize("dims", [1, 2, 3, 5, 10])
    def test_zero_input_returns_zero(self, dims):
        x = [0.0] * dims
        assert griewank(x) == pytest.approx(0.0, abs=1e-15)

    def test_empty_input_returns_zero(self):
        assert griewank([]) == 0.0


class TestGriewankNonNegative:
    """griewank always returns >= 0 for inputs in [-5, 5]."""

    @pytest.mark.parametrize("x", [
        [5.0],
        [-5.0],
        [5.0, 5.0],
        [-5.0, -5.0],
        [3.14, -2.71],
        [1.0, 2.0, 3.0, 4.0, 5.0],
        [-1.0, -2.0, -3.0, -4.0, -5.0, 1.0, 2.0, 3.0, 4.0, 5.0],
    ])
    def test_non_negative(self, x):
        assert griewank(x) >= 0.0


class TestGriewankKnownValues:
    """Cross-validate against hand-computed mathematical values."""

    def test_1d_at_pi(self):
        # f([π]) = 1 + π²/4000 - cos(π/√1) = 1 + π²/4000 - cos(π)
        # cos(π) = -1, π²/4000 ≈ 0.002467
        # f = 1 + 0.002467 - (-1) = 2.002467
        expected = 1 + (math.pi ** 2) / 4000 - math.cos(math.pi)
        assert griewank([math.pi]) == pytest.approx(expected, rel=1e-10)

    def test_2d_at_one_one(self):
        # f([1, 1]) = 1 + (1+1)/4000 - cos(1/√1)*cos(1/√2)
        x = [1.0, 1.0]
        sum_sq = 2.0
        prod_cos = math.cos(1.0 / math.sqrt(1)) * math.cos(1.0 / math.sqrt(2))
        expected = 1 + sum_sq / 4000 - prod_cos
        assert griewank(x) == pytest.approx(expected, rel=1e-10)

    def test_1d_symmetry(self):
        # Griewank is symmetric: f([x]) == f([-x])
        for val in [1.0, 2.5, 4.99]:
            assert griewank([val]) == pytest.approx(griewank([-val]), rel=1e-10)

    def test_global_minimum_is_unique_near_origin(self):
        # Small perturbation from origin should increase the value
        assert griewank([0.001]) > 0.0
        assert griewank([0.0, 0.001]) > 0.0

    def test_5d_at_boundary(self):
        # All dimensions at +5: verify the formula manually
        x = [5.0] * 5
        sum_sq = 5 * 25.0  # 125
        prod_cos = 1.0
        for i in range(5):
            prod_cos *= math.cos(5.0 / math.sqrt(i + 1))
        expected = 1.0 + sum_sq / 4000.0 - prod_cos
        assert griewank(x) == pytest.approx(expected, rel=1e-10)


class TestGriewankMatchesJS:
    """Values that should match the JavaScript implementation exactly.

    These test vectors can be run in both Python and JS to cross-validate.
    """

    # Pre-computed reference values (computed by the formula)
    TEST_VECTORS = [
        ([0.0], 0.0),
        ([1.0], 1 + 1 / 4000 - math.cos(1.0)),
        ([0.0, 0.0], 0.0),
        ([2.0, 3.0], 1 + (4 + 9) / 4000 - math.cos(2.0) * math.cos(3.0 / math.sqrt(2))),
        ([1.0, 1.0, 1.0], 1 + 3 / 4000 - math.cos(1.0) * math.cos(1 / math.sqrt(2)) * math.cos(1 / math.sqrt(3))),
    ]

    @pytest.mark.parametrize("x,expected", TEST_VECTORS)
    def test_matches_reference(self, x, expected):
        assert griewank(x) == pytest.approx(expected, rel=1e-10)
