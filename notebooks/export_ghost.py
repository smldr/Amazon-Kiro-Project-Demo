"""Export ghost data for OptimGame AI mode.

Runs CMA-ES on the Griewank function for each level configuration and
outputs ghost JSON files (level1.json through level4.json) into backend/ghosts/.

Usage:
    python notebooks/export_ghost.py

Level configurations:
    Level 1: 1D, budget 40
    Level 2: 2D, budget 35
    Level 3: 5D, budget 30
    Level 4: 10D, budget 25

The Griewank function: f(x) = 1 + (1/4000)·sum(xi^2) - prod(cos(xi/sqrt(i)))
Search range: [-5, 5] per dimension
Global minimum: 0 at origin
"""

import json
import math
import os
import sys

import numpy as np

# ---------------------------------------------------------------------------
# Griewank function — matches backend/griewank.py exactly
# ---------------------------------------------------------------------------


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


# ---------------------------------------------------------------------------
# CMA-ES implementation (simplified, self-contained)
# ---------------------------------------------------------------------------


def cma_es(
    objective,
    dimensions: int,
    budget: int,
    bounds: tuple[float, float] = (-5.0, 5.0),
    sigma0: float = 2.0,
    seed: int = 42,
) -> list[dict]:
    """Run CMA-ES and return the evaluation trace.

    Returns a list of dicts: [{"eval": i, "position": [...], "value": f}, ...]
    The trace is truncated or padded to exactly `budget` entries.
    """
    rng = np.random.default_rng(seed)

    # CMA-ES parameters
    n = dimensions
    lam = 4 + int(3 * np.log(n))  # population size
    mu = lam // 2  # number of parents
    weights = np.log(mu + 0.5) - np.log(np.arange(1, mu + 1))
    weights = weights / weights.sum()
    mu_eff = 1.0 / (weights**2).sum()

    # Step-size adaptation parameters
    cs = (mu_eff + 2.0) / (n + mu_eff + 5.0)
    ds = 1.0 + 2.0 * max(0.0, np.sqrt((mu_eff - 1.0) / (n + 1.0)) - 1.0) + cs
    chi_n = np.sqrt(n) * (1.0 - 1.0 / (4.0 * n) + 1.0 / (21.0 * n * n))

    # Covariance adaptation parameters
    cc = (4.0 + mu_eff / n) / (n + 4.0 + 2.0 * mu_eff / n)
    c1 = 2.0 / ((n + 1.3) ** 2 + mu_eff)
    cmu = min(
        1.0 - c1,
        2.0 * (mu_eff - 2.0 + 1.0 / mu_eff) / ((n + 2.0) ** 2 + mu_eff),
    )

    # State initialization
    mean = rng.uniform(bounds[0] * 0.8, bounds[1] * 0.8, size=n)
    sigma = sigma0
    C = np.eye(n)
    ps = np.zeros(n)
    pc = np.zeros(n)

    trace = []
    eval_count = 0

    # Record the initial mean as the first evaluation
    val = objective(mean.tolist())
    eval_count += 1
    trace.append(
        {"eval": eval_count, "position": mean.tolist(), "value": float(val)}
    )

    best_x = mean.copy()
    best_val = val

    while eval_count < budget:
        # Generate offspring
        try:
            eigvals, B = np.linalg.eigh(C)
            eigvals = np.maximum(eigvals, 1e-20)
            D = np.sqrt(eigvals)
        except np.linalg.LinAlgError:
            C = np.eye(n)
            D = np.ones(n)
            B = np.eye(n)

        offspring = []
        offspring_values = []

        for _ in range(lam):
            if eval_count >= budget:
                break
            z = rng.standard_normal(n)
            x = mean + sigma * (B @ (D * z))
            # Clip to bounds
            x = np.clip(x, bounds[0], bounds[1])
            val = objective(x.tolist())
            eval_count += 1
            offspring.append(x)
            offspring_values.append(val)

            # Record in trace
            trace.append(
                {"eval": eval_count, "position": x.tolist(), "value": float(val)}
            )

            if val < best_val:
                best_val = val
                best_x = x.copy()

        if len(offspring) == 0:
            break

        # Sort by fitness
        indices = np.argsort(offspring_values)

        # Use at most mu parents (may have fewer if budget ran out mid-generation)
        actual_mu = min(mu, len(offspring))
        if actual_mu < 2:
            # Not enough offspring to do a meaningful update
            break

        # Recompute weights for actual_mu parents
        w = np.log(actual_mu + 0.5) - np.log(np.arange(1, actual_mu + 1))
        w = w / w.sum()

        # Update mean
        old_mean = mean.copy()
        mean = np.zeros(n)
        for i in range(actual_mu):
            mean += w[i] * offspring[indices[i]]

        # Update evolution paths
        invsqrtC = B @ np.diag(1.0 / D) @ B.T
        ps = (1 - cs) * ps + np.sqrt(cs * (2 - cs) * mu_eff) * invsqrtC @ (
            mean - old_mean
        ) / sigma

        hs = (
            np.linalg.norm(ps)
            / np.sqrt(1 - (1 - cs) ** (2 * eval_count / lam))
            / chi_n
            < 1.4 + 2.0 / (n + 1.0)
        )

        pc = (1 - cc) * pc + hs * np.sqrt(cc * (2 - cc) * mu_eff) * (
            mean - old_mean
        ) / sigma

        # Update covariance matrix
        artmp = np.array(
            [(offspring[indices[i]] - old_mean) / sigma for i in range(actual_mu)]
        )
        C = (
            (1 - c1 - cmu) * C
            + c1 * (np.outer(pc, pc) + (1 - hs) * cc * (2 - cc) * C)
            + cmu * (artmp.T @ np.diag(w) @ artmp)
        )

        # Enforce symmetry
        C = (C + C.T) / 2.0
        np.fill_diagonal(C, np.maximum(np.diag(C), 1e-20))

        # Update step size
        sigma *= np.exp((cs / ds) * (np.linalg.norm(ps) / chi_n - 1))
        sigma = min(sigma, bounds[1] - bounds[0])  # cap sigma

    # Select the best evaluation at each step to form a monotonic "best-so-far" trace
    best_trace = _extract_best_so_far_trace(trace, budget)

    return best_trace


def _extract_best_so_far_trace(trace: list[dict], budget: int) -> list[dict]:
    """Extract a best-so-far trace from raw evaluations.

    Produces exactly `budget` entries showing the best position found
    at each evaluation step.
    """
    if not trace:
        return []

    best_so_far = []
    current_best_val = float("inf")
    current_best_pos = None

    for entry in trace:
        if entry["value"] < current_best_val:
            current_best_val = entry["value"]
            current_best_pos = entry["position"]
        best_so_far.append(
            {
                "eval": entry["eval"],
                "position": list(current_best_pos),
                "value": float(current_best_val),
            }
        )

    # Truncate to budget
    if len(best_so_far) > budget:
        best_so_far = best_so_far[:budget]

    # Pad if needed (repeat last entry)
    while len(best_so_far) < budget:
        last = best_so_far[-1]
        best_so_far.append(
            {
                "eval": len(best_so_far) + 1,
                "position": list(last["position"]),
                "value": last["value"],
            }
        )

    # Re-number evaluations 1..budget
    for i, entry in enumerate(best_so_far):
        entry["eval"] = i + 1

    return best_so_far


# ---------------------------------------------------------------------------
# Level configurations
# ---------------------------------------------------------------------------

LEVELS = [
    {"level": 1, "dimensions": 1, "budget": 40},
    {"level": 2, "dimensions": 2, "budget": 35},
    {"level": 3, "dimensions": 5, "budget": 30},
    {"level": 4, "dimensions": 10, "budget": 25},
]


# ---------------------------------------------------------------------------
# Main export logic
# ---------------------------------------------------------------------------


def generate_ghost_data(output_dir: str) -> None:
    """Generate ghost JSON files for all levels.

    Args:
        output_dir: Directory to write level1.json through level4.json.
    """
    os.makedirs(output_dir, exist_ok=True)

    for level_config in LEVELS:
        level = level_config["level"]
        dims = level_config["dimensions"]
        budget = level_config["budget"]

        print(f"Generating ghost for Level {level} ({dims}D, budget={budget})...")

        trace = cma_es(
            objective=griewank,
            dimensions=dims,
            budget=budget,
            bounds=(-5.0, 5.0),
            sigma0=2.0,
            seed=42 + level,  # Different seed per level for variety
        )

        # Build ghost data structure
        final_entry = trace[-1]
        ghost_data = {
            "level": level,
            "dimensions": dims,
            "algorithm": "CMA-ES",
            "budget": budget,
            "path": trace,
            "final_position": final_entry["position"],
            "final_value": final_entry["value"],
        }

        # Write JSON file
        filename = f"level{level}.json"
        filepath = os.path.join(output_dir, filename)
        with open(filepath, "w") as f:
            json.dump(ghost_data, f, indent=2)

        print(
            f"  -> {filepath} "
            f"(final_value={final_entry['value']:.6f}, "
            f"{len(trace)} steps)"
        )

    print("\nDone! Ghost data generated for all levels.")


if __name__ == "__main__":
    # Determine output directory relative to this script's location
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.dirname(script_dir)
    output_dir = os.path.join(project_root, "backend", "ghosts")

    print(f"Output directory: {output_dir}")
    print("=" * 60)

    generate_ghost_data(output_dir)
