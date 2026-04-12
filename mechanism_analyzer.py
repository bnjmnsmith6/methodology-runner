"""
Classify and analyze tactile alignment mechanisms in puzzle locks.

A "tactile alignment" mechanism is one where the solver must physically
manipulate two or more components into a precise positional relationship
using hand/finger feel alone — no visible indicator shows correct alignment.
"""
from dataclasses import dataclass
from typing import Optional


TACTILE_KEYWORDS = {
    "shackle rotation", "shackle angle", "body twist", "barrel rotation",
    "disk alignment", "wafer feel", "spring detent", "click detent",
    "magnetic alignment", "hidden button", "pressure point", "lever feel",
    "notch engagement", "gate alignment", "false gate", "binding order",
}

EXCLUSION_KEYWORDS = {
    "key", "combination dial", "slider", "number wheel", "digit",
    "sequence", "code", "cipher",
}


@dataclass
class MechanismProfile:
    is_tactile_alignment: bool
    piece_count: int
    hand_precision_required: bool
    detected_keywords: list[str]
    exclusion_hits: list[str]
    confidence: float  # 0-1
    notes: str = ""


def classify_mechanism(description: str, piece_count: int) -> MechanismProfile:
    """
    Given a text description and piece count, determine whether the mechanism
    qualifies as a 2-piece tactile alignment puzzle lock.
    """
    desc_lower = description.lower()

    detected = [kw for kw in TACTILE_KEYWORDS if kw in desc_lower]
    excluded = [kw for kw in EXCLUSION_KEYWORDS if kw in desc_lower]

    is_tactile = len(detected) > 0 and len(excluded) == 0 and piece_count >= 2
    hand_precision = any(
        phrase in desc_lower
        for phrase in ("angle", "rotation", "precise", "exact", "feel", "finger", "hand position")
    )

    if excluded:
        confidence = 0.0
    elif len(detected) >= 2:
        confidence = 0.9
    elif len(detected) == 1:
        confidence = 0.65
    else:
        confidence = 0.1

    return MechanismProfile(
        is_tactile_alignment=is_tactile,
        piece_count=piece_count,
        hand_precision_required=hand_precision,
        detected_keywords=detected,
        exclusion_hits=excluded,
        confidence=confidence,
    )


def assess_tactile_requirements(description: str) -> dict:
    """
    Returns a structured summary of what tactile skills the lock demands.
    """
    desc_lower = description.lower()
    return {
        "requires_angle_precision": any(w in desc_lower for w in ("angle", "rotation", "tilt")),
        "requires_pressure_control": any(w in desc_lower for w in ("press", "pressure", "spring", "tension")),
        "requires_sequential_feel": any(w in desc_lower for w in ("binding", "order", "sequence of feel")),
        "requires_two_hand_coordination": any(w in desc_lower for w in ("both hands", "two hand", "simultaneous")),
        "magnetic_element": "magnetic" in desc_lower,
        "spring_detent_present": any(w in desc_lower for w in ("click", "detent", "snap", "spring")),
    }


def rate_difficulty(mechanism_profile: MechanismProfile, tactile_assessment: dict) -> tuple[int, str]:
    """
    Returns a difficulty score (1-10) and justification string.
    Score is based on tactile complexity indicators.
    """
    score = 2  # base for any lock
    justification_parts = []

    if mechanism_profile.hand_precision_required:
        score += 2
        justification_parts.append("hand/angle precision required (+2)")
    if tactile_assessment.get("requires_pressure_control"):
        score += 1
        justification_parts.append("pressure control needed (+1)")
    if tactile_assessment.get("requires_sequential_feel"):
        score += 2
        justification_parts.append("sequential tactile steps (+2)")
    if tactile_assessment.get("requires_two_hand_coordination"):
        score += 1
        justification_parts.append("two-hand coordination (+1)")
    if tactile_assessment.get("magnetic_element"):
        score += 1
        justification_parts.append("hidden magnetic element adds misdirection (+1)")
    if mechanism_profile.piece_count > 2:
        score += min(mechanism_profile.piece_count - 2, 2)
        justification_parts.append(f"extra pieces ({mechanism_profile.piece_count}) (+{min(mechanism_profile.piece_count-2,2)})")

    score = max(1, min(10, score))
    justification = f"Base 2; " + "; ".join(justification_parts) if justification_parts else "Base difficulty, simple single-step alignment"
    return score, justification
