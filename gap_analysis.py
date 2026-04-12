"""
Gap Analysis: Identify research gaps and evidence weaknesses in the scoring framework.

A 'gap' is any condition where available evidence is insufficient to support
reliable, reproducible scoring.  Gap severity is classified as:

  CRITICAL  — dimension cannot be reliably scored without this evidence;
              scores produced are likely unreliable
  MODERATE  — scoring is possible but confidence intervals would be wide;
              findings should be flagged as provisional
  MINOR     — nice-to-have; current evidence is adequate for core purposes

Gap priorities are ordered: CRITICAL > MODERATE > MINOR, then by dimension
importance in the dual-mode weighting system.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Dict, List, Optional

from evidence_database import EvidenceDatabase, VALID_DIMENSIONS


class GapSeverity(Enum):
    CRITICAL = "CRITICAL"
    MODERATE = "MODERATE"
    MINOR = "MINOR"


@dataclass
class ResearchGap:
    gap_id: str
    dimension: str
    description: str
    severity: GapSeverity
    affected_source_types: List[str]      # which evidence types are missing
    specific_need: str                    # what study/data would close the gap
    interim_mitigation: str              # how to handle the gap now
    priority_rank: int = 0               # lower = higher priority; set by prioritize_needs()

    def to_dict(self) -> dict:
        return {
            "gap_id": self.gap_id,
            "dimension": self.dimension,
            "severity": self.severity.value,
            "description": self.description,
            "affected_source_types": self.affected_source_types,
            "specific_need": self.specific_need,
            "interim_mitigation": self.interim_mitigation,
            "priority_rank": self.priority_rank,
        }


# ---------------------------------------------------------------------------
# Known a priori gaps (from framework design phase)
# ---------------------------------------------------------------------------

KNOWN_GAPS: List[ResearchGap] = [
    ResearchGap(
        gap_id="G-ATT-01",
        dimension="attention_outcomes",
        description=(
            "No RCT or controlled study directly tests *skill toy* use (as opposed "
            "to general movement/fidgeting) on ADHD attention outcomes.  Sarver 2015 "
            "and related studies address gross motor movement; translation to "
            "fine-motor skill toy manipulation is theoretical."
        ),
        severity=GapSeverity.CRITICAL,
        affected_source_types=["academic"],
        specific_need=(
            "RCT comparing skill toy types (high-progression vs low-progression) "
            "on sustained attention and working memory in ADHD adults and children, "
            "with active control (standard fidget spinner) and no-fidget control."
        ),
        interim_mitigation=(
            "Use Sarver 2015 SGM framework as theoretical proxy; cap attention_outcomes "
            "academic evidence confidence at 'medium'; flag all attention scores as "
            "evidence-inferred rather than empirically validated."
        ),
    ),
    ResearchGap(
        gap_id="G-ATT-02",
        dimension="attention_outcomes",
        description=(
            "Existing ADHD fidget research is predominantly in children (ages 6–14). "
            "Adult ADHD population — likely the primary user of professional-setting "
            "skill toys — is severely under-studied."
        ),
        severity=GapSeverity.CRITICAL,
        affected_source_types=["academic"],
        specific_need=(
            "Controlled studies of fidget/skill toy effectiveness in adult ADHD "
            "(ages 18–65) in workplace or meeting-equivalent settings."
        ),
        interim_mitigation=(
            "Apply a 0.80 confidence discount to attention_outcomes scores; "
            "note adult generalisation caveat in all scorecards."
        ),
    ),
    ResearchGap(
        gap_id="G-PRG-01",
        dimension="progression",
        description=(
            "No published framework objectively quantifies 'skill depth' for fidget "
            "or skill toys.  Current progression scores rely on community-derived "
            "trick counts and qualitative descriptions."
        ),
        severity=GapSeverity.MODERATE,
        affected_source_types=["academic", "practitioner"],
        specific_need=(
            "A validated taxonomy of skill-toy technique complexity — ideally with "
            "measurable milestones (e.g., time-to-learn per technique tier) — that "
            "can ground the progression dimension objectively."
        ),
        interim_mitigation=(
            "Use community-documented trick-count tiers as proxy; "
            "require ≥2 independent community sources to confirm trick-count claims."
        ),
    ),
    ResearchGap(
        gap_id="G-RES-01",
        dimension="resistance",
        description=(
            "Tactile resistance has not been independently operationalised for skill "
            "toys.  The Zentall optimal-stimulation model provides theoretical basis "
            "but no empirical measure of 'optimal resistance level' for ADHD "
            "proprioceptive regulation."
        ),
        severity=GapSeverity.MODERATE,
        affected_source_types=["academic"],
        specific_need=(
            "Psychophysical study measuring ADHD vs. neurotypical preferences for "
            "tactile resistance in hand-held objects, producing an evidence-based "
            "resistance target range."
        ),
        interim_mitigation=(
            "Operationalise resistance via community preference surveys "
            "(corroboration_count ≥ 20 for reliability); "
            "treat resistance scores as community-evidence-only until academic "
            "support emerges."
        ),
    ),
    ResearchGap(
        gap_id="G-DISC-01",
        dimension="discretion",
        description=(
            "Discretion scores are entirely based on physical dimensions and community "
            "social norms.  No study has measured social disruption caused by fidget "
            "tools in professional settings (meetings, open-plan offices)."
        ),
        severity=GapSeverity.MODERATE,
        affected_source_types=["academic", "practitioner"],
        specific_need=(
            "Observational or survey study measuring bystander distraction rates "
            "for different fidget tool types in professional settings."
        ),
        interim_mitigation=(
            "Score discretion from physical characteristics (size, noise, movement "
            "range) using rubric; treat as physical/engineering assessment rather "
            "than behavioural evidence."
        ),
    ),
    ResearchGap(
        gap_id="G-SAF-01",
        dimension="meeting_safety",
        description=(
            "Meeting-safety is assessed via proxy (discretion + noise) with no direct "
            "evidence from meeting settings.  Cultural variation in meeting norms is "
            "not captured."
        ),
        severity=GapSeverity.MINOR,
        affected_source_types=["academic", "community"],
        specific_need=(
            "Survey of meeting participants rating acceptability of specific fidget "
            "types; cross-cultural validation."
        ),
        interim_mitigation=(
            "Use conservative defaults; note that meeting-safety scores are "
            "context-dependent and may require user adjustment."
        ),
    ),
    ResearchGap(
        gap_id="G-DUAL-01",
        dimension="all",
        description=(
            "Dual-mode weights (discrete_fidget vs deep_practice) are theoretically "
            "derived.  No user research has validated that these weightings reflect "
            "actual user value trade-offs across ADHD subtypes."
        ),
        severity=GapSeverity.MODERATE,
        affected_source_types=["academic", "community", "practitioner"],
        specific_need=(
            "Conjoint analysis or user preference study with ADHD adults rating "
            "dimension importance in each mode, stratified by ADHD subtype "
            "(inattentive vs hyperactive-impulsive vs combined)."
        ),
        interim_mitigation=(
            "Publish current weights as v1.0 defaults with clear documentation "
            "of theoretical basis; invite community calibration; version-control "
            "weight sets so updates are backwards-traceable."
        ),
    ),
    ResearchGap(
        gap_id="G-PRAC-01",
        dimension="all",
        description=(
            "Practitioner insights (OT, ADHD coaches) are not yet systematically "
            "incorporated.  This is an open evidence source with potentially high "
            "signal-to-noise ratio for the meeting-safety and discretion dimensions."
        ),
        severity=GapSeverity.MINOR,
        affected_source_types=["practitioner"],
        specific_need=(
            "Structured survey of 20+ OTs and ADHD coaches who recommend fidget "
            "tools; capture dimension-level ratings and case documentation."
        ),
        interim_mitigation=(
            "Flag practitioner dimension as pending; note in scorecards that "
            "practitioner validation is absent."
        ),
    ),
]


# ---------------------------------------------------------------------------
# Core analysis functions
# ---------------------------------------------------------------------------

class GapAnalyzer:
    """Analyse evidence coverage and produce prioritised gap reports."""

    # Minimum evidence thresholds per dimension for 'adequate' coverage
    COVERAGE_THRESHOLDS = {
        "academic_min_quality": 3,       # at least quality 3 academic entry
        "academic_min_entries": 1,        # at least one academic entry per dimension
        "community_min_corroboration": 5, # if community used, must reach this threshold
        "overall_min_entries": 2,         # at least 2 entries total per dimension
    }

    def __init__(self, db: EvidenceDatabase) -> None:
        self.db = db
        self._gaps: List[ResearchGap] = list(KNOWN_GAPS)  # start with known gaps

    def analyze_coverage(self) -> Dict[str, dict]:
        """
        Assess evidence coverage for each dimension.

        Returns a dict mapping dimension → coverage summary.
        """
        coverage = {}
        for dim in VALID_DIMENSIONS:
            entries = self.db.categorize_by_dimension(dim)
            academic = [e for e in entries if e.source_type == "academic"]
            community = [e for e in entries if e.source_type == "community"]
            practitioner = [e for e in entries if e.source_type == "practitioner"]

            max_academic_quality = max((e.quality_rating for e in academic), default=0)
            avg_quality = (
                sum(e.quality_rating for e in entries) / len(entries) if entries else 0.0
            )

            coverage[dim] = {
                "total_entries": len(entries),
                "academic_entries": len(academic),
                "community_entries": len(community),
                "practitioner_entries": len(practitioner),
                "max_academic_quality": max_academic_quality,
                "average_quality": round(avg_quality, 2),
                "adequate": (
                    len(entries) >= self.COVERAGE_THRESHOLDS["overall_min_entries"]
                    and max_academic_quality >= self.COVERAGE_THRESHOLDS["academic_min_quality"]
                ),
            }
        return coverage

    def identify_gaps(self, include_known: bool = True) -> List[ResearchGap]:
        """
        Return all current gaps (both known a priori and discovered from
        coverage analysis).

        Args:
            include_known: If True, include the pre-defined KNOWN_GAPS
                           in addition to any discovered from coverage data.
        """
        discovered = self._discover_coverage_gaps()
        if include_known:
            return self._gaps + discovered
        return discovered

    def _discover_coverage_gaps(self) -> List[ResearchGap]:
        """Dynamically discover gaps from current database coverage."""
        coverage = self.analyze_coverage()
        dynamic_gaps: List[ResearchGap] = []
        gap_counter = 1

        for dim, cov in coverage.items():
            if cov["total_entries"] == 0:
                dynamic_gaps.append(
                    ResearchGap(
                        gap_id=f"G-DYN-{gap_counter:02d}",
                        dimension=dim,
                        description=f"No evidence entries at all for dimension '{dim}'.",
                        severity=GapSeverity.CRITICAL,
                        affected_source_types=["academic", "community", "practitioner"],
                        specific_need=f"Any evidence addressing '{dim}'.",
                        interim_mitigation=f"Do not produce scores for '{dim}' until evidence is added.",
                    )
                )
                gap_counter += 1
            elif not cov["adequate"]:
                dynamic_gaps.append(
                    ResearchGap(
                        gap_id=f"G-DYN-{gap_counter:02d}",
                        dimension=dim,
                        description=(
                            f"Dimension '{dim}' has {cov['total_entries']} entries but "
                            f"coverage is inadequate (max academic quality: "
                            f"{cov['max_academic_quality']})."
                        ),
                        severity=GapSeverity.MODERATE,
                        affected_source_types=["academic"],
                        specific_need=f"Peer-reviewed evidence (quality ≥ 3) for '{dim}'.",
                        interim_mitigation="Flag scores as low-confidence pending additional evidence.",
                    )
                )
                gap_counter += 1

        return dynamic_gaps

    def prioritize_needs(self, gaps: Optional[List[ResearchGap]] = None) -> List[ResearchGap]:
        """
        Sort gaps by priority: CRITICAL first, then MODERATE, then MINOR.
        Within severity, order by the dimension's average weight across both modes
        (higher weight = higher priority).
        """
        if gaps is None:
            gaps = self.identify_gaps()

        # Import here to avoid circular import
        from weighting_system import WeightingSystem, DualMode

        ws = WeightingSystem()
        discrete_w = ws.get_weights(DualMode.DISCRETE_FIDGET)
        deep_w = ws.get_weights(DualMode.DEEP_PRACTICE)

        def _avg_weight(dim: str) -> float:
            if dim == "all":
                return 1.0  # cross-cutting gaps get highest within-severity priority
            dw = discrete_w.get(dim, 0.0)
            pw = deep_w.get(dim, 0.0)
            return (dw + pw) / 2

        severity_order = {
            GapSeverity.CRITICAL: 0,
            GapSeverity.MODERATE: 1,
            GapSeverity.MINOR: 2,
        }

        sorted_gaps = sorted(
            gaps,
            key=lambda g: (severity_order[g.severity], -_avg_weight(g.dimension)),
        )
        for rank, gap in enumerate(sorted_gaps, start=1):
            gap.priority_rank = rank
        return sorted_gaps

    def gap_report(self) -> dict:
        """Produce a full gap analysis report as a serialisable dict."""
        coverage = self.analyze_coverage()
        all_gaps = self.prioritize_needs()
        return {
            "coverage_summary": coverage,
            "total_gaps": len(all_gaps),
            "by_severity": {
                sev.value: [g.to_dict() for g in all_gaps if g.severity == sev]
                for sev in GapSeverity
            },
            "top_3_priorities": [g.to_dict() for g in all_gaps[:3]],
            "dimensions_adequate": {
                dim: cov["adequate"] for dim, cov in coverage.items()
            },
            "overall_framework_ready": all(
                cov["adequate"] for cov in coverage.values()
            ),
        }
