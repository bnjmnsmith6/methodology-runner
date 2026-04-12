"""
Weighting System: Manage dual-mode weights and dimension balancing.

Two modes
---------
discrete_fidget  — Primary goal: stay unnoticed while maintaining ADHD focus regulation
                   during meetings, calls, or public settings.
deep_practice    — Primary goal: develop skill depth that creates long-term engagement
                   and prevents boredom-driven attention collapse.

Invariant: weights per mode must sum to exactly 1.0 across all 5 dimensions.

Default weights rationale
--------------------------
In DISCRETE FIDGET mode:
  - meeting_safety and discretion are paramount (combined 55%)
  - attention_outcomes still matters (25%) — the core ADHD benefit
  - progression and resistance are secondary (20%) — tool still needs to work

In DEEP PRACTICE mode:
  - progression is dominant (35%) — depth of skill is the point
  - attention_outcomes remains important (25%)
  - resistance elevated (20%) — proprioceptive engagement drives session quality
  - discretion and safety less critical in intentional practice context (20%)
"""

from __future__ import annotations

from enum import Enum
from typing import Dict

DIMENSIONS = [
    "discretion",
    "progression",
    "resistance",
    "meeting_safety",
    "attention_outcomes",
]

WEIGHT_TOLERANCE = 1e-9  # floating-point tolerance for sum-to-1 check


class DualMode(Enum):
    DISCRETE_FIDGET = "discrete_fidget"
    DEEP_PRACTICE = "deep_practice"


# Default weights — evidence-informed, dual-mode balanced
DEFAULT_WEIGHTS: Dict[str, Dict[str, float]] = {
    DualMode.DISCRETE_FIDGET.value: {
        "discretion": 0.25,
        "progression": 0.10,
        "resistance": 0.10,
        "meeting_safety": 0.30,
        "attention_outcomes": 0.25,
    },
    DualMode.DEEP_PRACTICE.value: {
        "discretion": 0.10,
        "progression": 0.35,
        "resistance": 0.20,
        "meeting_safety": 0.10,
        "attention_outcomes": 0.25,
    },
}


class WeightingSystem:
    """
    Manages dimension weights for both evaluation modes.

    Weights are validated on assignment to ensure they sum to 1.0 per mode,
    satisfying the framework invariant.
    """

    def __init__(self) -> None:
        # Deep-copy defaults to avoid mutation surprises
        self._weights: Dict[str, Dict[str, float]] = {
            mode: dict(dims) for mode, dims in DEFAULT_WEIGHTS.items()
        }

    # --------------------------------------------------------- public API

    def get_weights(self, mode: DualMode) -> Dict[str, float]:
        """Return the current weight dict for the given mode."""
        return dict(self._weights[mode.value])

    def set_weights(self, mode: DualMode, weights: Dict[str, float]) -> None:
        """
        Replace weights for *mode*.  Raises ValueError if:
          - any dimension is missing or extra
          - weights don't sum to 1.0 within tolerance
          - any weight is negative
        """
        self._validate_weights(weights)
        self._weights[mode.value] = dict(weights)

    def validate_weights(self, weights: Dict[str, float]) -> bool:
        """Return True if weights pass all invariants, False otherwise."""
        try:
            self._validate_weights(weights)
            return True
        except ValueError:
            return False

    def apply_mode_adjustments(
        self,
        base_weights: Dict[str, float],
        adjustments: Dict[str, float],
        mode: DualMode,
    ) -> Dict[str, float]:
        """
        Apply relative adjustments to *base_weights* and renormalise so they
        sum to 1.0.

        *adjustments* maps dimension → delta (positive increases weight,
        negative decreases it).  Useful for context-specific tweaks (e.g.,
        extra emphasis on discretion for a boardroom setting).

        Returns a new weight dict; does NOT persist to the system.
        """
        adjusted = {
            dim: max(0.0, base_weights.get(dim, 0.0) + adjustments.get(dim, 0.0))
            for dim in DIMENSIONS
        }
        total = sum(adjusted.values())
        if total == 0:
            raise ValueError("Adjustments resulted in all-zero weights.")
        normalised = {dim: v / total for dim, v in adjusted.items()}
        return normalised

    def describe_weights(self, mode: DualMode) -> str:
        """Human-readable summary of weights for a mode."""
        weights = self._weights[mode.value]
        lines = [f"Mode: {mode.value}"]
        for dim in DIMENSIONS:
            lines.append(f"  {dim:<22} {weights[dim]:.0%}")
        lines.append(f"  {'SUM':<22} {sum(weights.values()):.1%}")
        return "\n".join(lines)

    def both_modes_summary(self) -> str:
        return (
            self.describe_weights(DualMode.DISCRETE_FIDGET)
            + "\n\n"
            + self.describe_weights(DualMode.DEEP_PRACTICE)
        )

    # ------------------------------------------------------- private

    @staticmethod
    def _validate_weights(weights: Dict[str, float]) -> None:
        provided = set(weights.keys())
        expected = set(DIMENSIONS)
        if provided != expected:
            missing = expected - provided
            extra = provided - expected
            parts = []
            if missing:
                parts.append(f"missing: {missing}")
            if extra:
                parts.append(f"extra: {extra}")
            raise ValueError(f"Weight keys mismatch — {'; '.join(parts)}")
        for dim, val in weights.items():
            if val < 0:
                raise ValueError(f"Weight for '{dim}' is negative: {val}")
        total = sum(weights.values())
        if abs(total - 1.0) > WEIGHT_TOLERANCE:
            raise ValueError(
                f"Weights must sum to 1.0, got {total:.10f} "
                f"(delta = {abs(total - 1.0):.2e})"
            )
