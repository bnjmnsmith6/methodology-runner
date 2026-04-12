"""
Scoring Matrix: Core calculation engine for evaluating skill toys across 5 dimensions.

Scoring Matrix Schema per toy:
  toy_id            : str   — unique toy identifier
  discretion_score  : float — 0.0–10.0
  progression_score : float — 0.0–10.0
  resistance_score  : float — 0.0–10.0
  safety_score      : float — 0.0–10.0  (meeting-safety)
  attention_score   : float — 0.0–10.0  (ADHD attention outcomes)
  weighted_total    : float — 0.0–10.0  (after applying mode weights)

Dimension definitions
---------------------
discretion      Size, visual profile, noise level. High = pocket-sized, silent,
                indistinguishable from ordinary handling.
progression     Depth of learnable skill content. High = years of technique depth
                (beginner → intermediate → advanced → expert).
resistance      Quality and consistency of tactile/motor feedback. High = noticeable
                physical resistance that satisfies the proprioceptive stimulation need
                hypothesised by Zentall (1983) / Sarver (2015).
meeting_safety  Usability during meetings or focus-required settings without disrupting
                others (visual, auditory, or attentional disruption to bystanders).
attention_outcomes
                Evidence-based likelihood of supporting ADHD attention regulation.
                Composite of: theoretical alignment with SGM model, empirical evidence,
                skill-engagement depth (prevents boredom saturation).

Scoring rubrics for each dimension are encoded in DIMENSION_RUBRICS below.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, List, Optional

from weighting_system import WeightingSystem, DualMode

# ---------------------------------------------------------------------------
# Rubrics: human-readable anchors for integer scores 1–10
# ---------------------------------------------------------------------------

DIMENSION_RUBRICS: Dict[str, Dict[int, str]] = {
    "discretion": {
        1:  "Large, visually conspicuous object; draws attention constantly",
        3:  "Medium-sized; some visual distraction; likely noticed by others",
        5:  "Fist-sized; manageable but occasionally noticed",
        7:  "Small, fits in one hand; rarely attracts attention",
        9:  "Finger-sized or smaller; essentially invisible in social contexts",
        10: "Can be manipulated inside pocket or under table without any visibility",
    },
    "progression": {
        1:  "No learnable technique; single state (e.g., smooth worry stone)",
        3:  "One or two beginner tricks; skill ceiling reached in days",
        5:  "Several technique layers; skill plateau after weeks–months",
        7:  "Rich technique tree; 6–12 months to intermediate mastery",
        9:  "Deep progression; 2+ years to advanced; active skill community",
        10: "Essentially unlimited depth; competitive/professional skill pathway",
    },
    "resistance": {
        1:  "No physical resistance; frictionless or purely visual",
        3:  "Minimal feedback; light click or soft tactile bump",
        5:  "Moderate resistance; noticeable spring, click, or texture",
        7:  "Strong, satisfying resistance; proprioceptive engagement",
        9:  "High resistance with skill-dependent variation in feedback",
        10: "Maximal proprioceptive engagement; tool 'fights back' meaningfully",
    },
    "meeting_safety": {
        1:  "Requires both hands, large movements, or generates audible sound",
        3:  "Occasional noise or large movement; disruptive if others notice",
        5:  "Mostly one-handed; minimal noise; tolerable in casual meetings",
        7:  "One-handed, silent operation; unlikely to distract neighbours",
        9:  "Completely silent; micro-movements only; no visual distraction",
        10: "Invisible/under-desk operation; zero disruption to others",
    },
    "attention_outcomes": {
        1:  "No evidence of benefit; passive toy, no arousal engagement",
        3:  "Weak evidence or theoretical link only; no empirical support",
        5:  "Plausible mechanism + some community evidence; no RCT",
        7:  "Aligns with SGM/arousal theory + positive case series/surveys",
        9:  "Strong theoretical + empirical support; replicable findings",
        10: "RCT-level evidence of attention benefit in ADHD population",
    },
}


@dataclass
class ToyScorecard:
    toy_id: str
    toy_name: str
    discretion_score: float
    progression_score: float
    resistance_score: float
    safety_score: float
    attention_score: float
    mode: DualMode
    weights_applied: Dict[str, float] = field(default_factory=dict)
    weighted_total: float = 0.0
    rationale: Dict[str, str] = field(default_factory=dict)

    def to_dict(self) -> dict:
        return {
            "toy_id": self.toy_id,
            "toy_name": self.toy_name,
            "scores": {
                "discretion": self.discretion_score,
                "progression": self.progression_score,
                "resistance": self.resistance_score,
                "meeting_safety": self.safety_score,
                "attention_outcomes": self.attention_score,
            },
            "mode": self.mode.value,
            "weights_applied": self.weights_applied,
            "weighted_total": round(self.weighted_total, 3),
            "rationale": self.rationale,
        }


class ScoringMatrix:
    """
    Core calculation engine.  Produces ToyScorecard objects from raw dimension
    scores and a WeightingSystem.
    """

    def __init__(self, weighting_system: WeightingSystem) -> None:
        self.weighting_system = weighting_system
        self._scorecards: Dict[str, ToyScorecard] = {}

    # ----------------------------------------------------- score entry point

    def score_toy(
        self,
        toy_id: str,
        toy_name: str,
        discretion: float,
        progression: float,
        resistance: float,
        meeting_safety: float,
        attention_outcomes: float,
        mode: DualMode,
        rationale: Optional[Dict[str, str]] = None,
    ) -> ToyScorecard:
        """
        Compute and store a full scorecard for a toy in a given mode.

        All raw scores must be in [0, 10].  Returns the completed ToyScorecard.
        """
        raw_scores = {
            "discretion": discretion,
            "progression": progression,
            "resistance": resistance,
            "meeting_safety": meeting_safety,
            "attention_outcomes": attention_outcomes,
        }
        self._validate_raw_scores(raw_scores)

        dimension_scores = self.calculate_dimension_scores(raw_scores)
        weights = self.weighting_system.get_weights(mode)
        total = self.apply_weights(dimension_scores, weights)

        scorecard = ToyScorecard(
            toy_id=toy_id,
            toy_name=toy_name,
            discretion_score=dimension_scores["discretion"],
            progression_score=dimension_scores["progression"],
            resistance_score=dimension_scores["resistance"],
            safety_score=dimension_scores["meeting_safety"],
            attention_score=dimension_scores["attention_outcomes"],
            mode=mode,
            weights_applied=weights,
            weighted_total=total,
            rationale=rationale or {},
        )
        # Store under composite key so both modes can coexist
        self._scorecards[f"{toy_id}::{mode.value}"] = scorecard
        return scorecard

    # -------------------------------------------------- calculation helpers

    @staticmethod
    def _validate_raw_scores(scores: Dict[str, float]) -> None:
        for dim, val in scores.items():
            if not (0.0 <= val <= 10.0):
                raise ValueError(
                    f"Score for '{dim}' must be in [0, 10], got {val}"
                )

    @staticmethod
    def calculate_dimension_scores(raw_scores: Dict[str, float]) -> Dict[str, float]:
        """
        Currently a direct pass-through; hook provided for future normalisation
        or evidence-weighted adjustments.
        """
        return {dim: float(score) for dim, score in raw_scores.items()}

    @staticmethod
    def apply_weights(
        dimension_scores: Dict[str, float], weights: Dict[str, float]
    ) -> float:
        """Return the weighted sum across dimensions."""
        return sum(
            dimension_scores[dim] * weights[dim]
            for dim in dimension_scores
        )

    def generate_total_score(self, toy_id: str, mode: DualMode) -> float:
        """Retrieve the pre-computed weighted total for a toy/mode pair."""
        key = f"{toy_id}::{mode.value}"
        if key not in self._scorecards:
            raise KeyError(
                f"No scorecard found for toy_id='{toy_id}' in mode='{mode.value}'. "
                "Call score_toy() first."
            )
        return self._scorecards[key].weighted_total

    # ------------------------------------------------------------ retrieval

    def get_scorecard(self, toy_id: str, mode: DualMode) -> Optional[ToyScorecard]:
        return self._scorecards.get(f"{toy_id}::{mode.value}")

    def rank_toys(self, mode: DualMode) -> List[ToyScorecard]:
        """Return all scored toys sorted by weighted_total descending."""
        scorecards = [
            sc for key, sc in self._scorecards.items()
            if key.endswith(f"::{mode.value}")
        ]
        return sorted(scorecards, key=lambda s: s.weighted_total, reverse=True)

    def compare_modes(self, toy_id: str) -> Optional[Dict[str, object]]:
        """Side-by-side comparison of a toy's scores across both modes."""
        discrete_key = f"{toy_id}::discrete_fidget"
        deep_key = f"{toy_id}::deep_practice"
        sc_d = self._scorecards.get(discrete_key)
        sc_p = self._scorecards.get(deep_key)
        if sc_d is None or sc_p is None:
            return None
        return {
            "toy_id": toy_id,
            "discrete_fidget_total": sc_d.weighted_total,
            "deep_practice_total": sc_p.weighted_total,
            "delta": sc_p.weighted_total - sc_d.weighted_total,
            "dual_mode_viable": (
                sc_d.weighted_total >= 6.0 and sc_p.weighted_total >= 6.0
            ),
        }

    # ----------------------------------------------------------- rubric util

    @staticmethod
    def describe_score(dimension: str, score: float) -> str:
        """Return the closest rubric description for a given score."""
        if dimension not in DIMENSION_RUBRICS:
            raise KeyError(f"No rubric for dimension '{dimension}'")
        rubric = DIMENSION_RUBRICS[dimension]
        closest = min(rubric.keys(), key=lambda k: abs(k - score))
        return rubric[closest]
