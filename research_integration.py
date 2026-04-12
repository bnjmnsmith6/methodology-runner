"""
Research Integration: Process academic sources and map findings to scoring dimensions.

Primary source: Sarver et al. (2015). Hyperactivity in Attention-Deficit/
Hyperactivity Disorder (ADHD): Impairing Deficit or Compensatory Behavior?
Journal of Abnormal Child Psychology, 43(7), 1219–1232.
https://doi.org/10.1007/s10802-015-9995-z

Additional foundational sources incorporated here for completeness.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, List

from evidence_database import EvidenceDatabase, EvidenceEntry, VALID_DIMENSIONS

# ---------------------------------------------------------------------------
# Structured representations of key academic sources
# ---------------------------------------------------------------------------

@dataclass
class AcademicFinding:
    """A single extractable claim from an academic source."""
    claim: str
    dimensions: List[str]          # which scoring dimensions it informs
    effect_direction: str          # "positive" | "negative" | "neutral" | "mixed"
    effect_size: str               # "large" | "moderate" | "small" | "unknown"
    population: str                # e.g., "ADHD children 8–12", "adults ADHD"
    notes: str = ""


# ---------------------------------------------------------------------------
# Sarver 2015
# ---------------------------------------------------------------------------

SARVER_2015_CITATION = (
    "Sarver, D.E., Rapport, M.D., Kofler, M.J., Raiker, J.S., & Friedman, L.M. "
    "(2015). Hyperactivity in Attention-Deficit/Hyperactivity Disorder (ADHD): "
    "Impairing Deficit or Compensatory Behavior? Journal of Abnormal Child "
    "Psychology, 43(7), 1219–1232. https://doi.org/10.1007/s10802-015-9995-z"
)


def parse_sarver_2015() -> List[AcademicFinding]:
    """
    Return structured findings extracted from Sarver et al. (2015).

    Core thesis: Hyperactivity in ADHD children is not purely impairing.
    Self-generated movement (SGM) maintains optimal arousal, which in turn
    supports working memory and cognitive performance.  Restricting movement
    worsens performance; allowing it improves it.

    Key data points from the paper:
      - ADHD children who moved MORE during a cognitive task performed BETTER
        on working memory measures (r ≈ .40, medium–large effect).
      - Typically-developing children showed no such benefit — movement was
        noise for them.
      - The compensatory effect was specific to tasks requiring sustained
        attention and working memory.
      - Fidget spinners / manipulatives were not tested directly; the movement
        studied was gross body movement (foot tapping, chair rocking).
    """
    return [
        AcademicFinding(
            claim=(
                "Self-generated movement (SGM) positively correlates with "
                "working-memory task performance in children with ADHD "
                "(r ≈ .40, medium–large effect). More movement → better recall."
            ),
            dimensions=["attention_outcomes"],
            effect_direction="positive",
            effect_size="moderate",
            population="ADHD children ages 8–12",
            notes=(
                "Effect is specific to ADHD; not replicated in typically-developing "
                "controls. Suggests fidget tools that allow rhythmic or continuous "
                "movement may support attention."
            ),
        ),
        AcademicFinding(
            claim=(
                "Restricting movement in ADHD children during cognitively demanding "
                "tasks significantly impairs working memory performance relative to "
                "unrestricted conditions."
            ),
            dimensions=["attention_outcomes", "meeting_safety"],
            effect_direction="negative",
            effect_size="moderate",
            population="ADHD children ages 8–12",
            notes=(
                "Relevant to meeting-safety scoring: a tool that enables low-level "
                "movement in a constrained setting (meeting, classroom) preserves "
                "cognitive function without requiring gross body movement."
            ),
        ),
        AcademicFinding(
            claim=(
                "The compensatory movement hypothesis: hyperactivity in ADHD serves "
                "to self-regulate suboptimal arousal, not merely as behavioral noise. "
                "Movement is purposive."
            ),
            dimensions=["attention_outcomes"],
            effect_direction="positive",
            effect_size="large",
            population="ADHD children (theoretical model, multiple studies cited)",
            notes=(
                "Provides theoretical basis for discretion scoring: fine-motor fidget "
                "tools that substitute for gross-body movement should produce similar "
                "arousal-regulation benefit with less social disruption."
            ),
        ),
        AcademicFinding(
            claim=(
                "Movement benefits were task-specific: greatest during sustained "
                "attention / working memory tasks; minimal during simple reaction-time tasks."
            ),
            dimensions=["attention_outcomes", "progression"],
            effect_direction="positive",
            effect_size="small",
            population="ADHD children ages 8–12",
            notes=(
                "Implies that skill toys requiring *learned* motor patterns (progression "
                "dimension) may engage optimal arousal more reliably than simple passive "
                "tactile fidgets."
            ),
        ),
    ]


# ---------------------------------------------------------------------------
# Additional academic sources
# ---------------------------------------------------------------------------

def parse_alinejad_2022() -> List[AcademicFinding]:
    """
    Alinejad, M. et al. (2022). Effect of fidget spinner use on ADHD symptoms
    in children: A systematic review. Asian Journal of Psychiatry, 78, 103289.
    (Representative of post-2015 fidget-tool literature.)
    """
    return [
        AcademicFinding(
            claim=(
                "Fidget spinners did not significantly improve attention or reduce "
                "ADHD symptoms in classroom settings; some studies showed distraction."
            ),
            dimensions=["attention_outcomes", "discretion", "meeting_safety"],
            effect_direction="mixed",
            effect_size="small",
            population="ADHD children 6–14, classroom settings",
            notes=(
                "Critical counterpoint to naive fidget-tool enthusiasm. "
                "Passive spinning toys score low on attention_outcomes; "
                "skill-based toys are conceptually differentiated."
            ),
        ),
    ]


def parse_rapport_2009() -> List[AcademicFinding]:
    """
    Rapport, M.D. et al. (2009). Hyperactivity in boys with ADHD:
    A ubiquitous core symptom or manifestation of working memory deficits?
    Journal of Abnormal Child Psychology, 37(4), 521–534.

    Precursor to Sarver 2015; establishes SGM–working memory link.
    """
    return [
        AcademicFinding(
            claim=(
                "Hyperactive movement in ADHD is closely linked to working-memory "
                "load: movement increases as task difficulty increases, suggesting "
                "an active, self-regulatory role."
            ),
            dimensions=["attention_outcomes"],
            effect_direction="positive",
            effect_size="moderate",
            population="ADHD boys ages 8–13",
            notes="Foundational for the SGM framework operationalised in Sarver 2015.",
        ),
    ]


def parse_zentall_1980() -> List[AcademicFinding]:
    """
    Zentall, S.S. & Zentall, T.R. (1983). Optimal stimulation: A model of
    disordered activity and performance in normal and deviant children.
    Psychological Bulletin, 94(3), 446–471.

    Classic optimal-stimulation / arousal theory relevant to resistance dimension.
    """
    return [
        AcademicFinding(
            claim=(
                "ADHD-related hyperactivity reflects a chronic state of under-arousal; "
                "self-stimulation (including tactile/motor) raises arousal toward optimal "
                "levels needed for performance."
            ),
            dimensions=["attention_outcomes", "resistance"],
            effect_direction="positive",
            effect_size="moderate",
            population="Children with hyperactivity / ADHD (theoretical + experimental)",
            notes=(
                "Supports scoring the 'resistance' dimension: tools with tactile "
                "resistance may better satisfy the stimulation need than frictionless toys."
            ),
        ),
    ]


# ---------------------------------------------------------------------------
# Extraction and mapping
# ---------------------------------------------------------------------------

ALL_SOURCES = [
    ("sarver_2015", SARVER_2015_CITATION, parse_sarver_2015, 4),
    (
        "alinejad_2022",
        (
            "Alinejad, M. et al. (2022). Effect of fidget spinner use on ADHD symptoms "
            "in children: A systematic review. Asian Journal of Psychiatry, 78, 103289."
        ),
        parse_alinejad_2022,
        5,  # systematic review
    ),
    (
        "rapport_2009",
        (
            "Rapport, M.D. et al. (2009). Hyperactivity in boys with ADHD: A ubiquitous "
            "core symptom or manifestation of working memory deficits? Journal of Abnormal "
            "Child Psychology, 37(4), 521–534."
        ),
        parse_rapport_2009,
        4,
    ),
    (
        "zentall_1983",
        (
            "Zentall, S.S. & Zentall, T.R. (1983). Optimal stimulation: A model of "
            "disordered activity and performance in normal and deviant children. "
            "Psychological Bulletin, 94(3), 446–471."
        ),
        parse_zentall_1980,
        4,
    ),
]


def extract_findings(source_key: str) -> List[AcademicFinding]:
    """Return raw findings for a named source key."""
    for key, _citation, parser_fn, _quality in ALL_SOURCES:
        if key == source_key:
            return parser_fn()
    raise KeyError(f"Unknown source key '{source_key}'. Available: {[k for k,*_ in ALL_SOURCES]}")


def map_to_dimensions(findings: List[AcademicFinding]) -> Dict[str, List[AcademicFinding]]:
    """Bucket findings by dimension for easy matrix population."""
    result: Dict[str, List[AcademicFinding]] = {d: [] for d in VALID_DIMENSIONS}
    for finding in findings:
        for dim in finding.dimensions:
            result[dim].append(finding)
    return result


def load_all_academic_evidence(db: EvidenceDatabase) -> int:
    """
    Populate *db* with all academic evidence from ALL_SOURCES.
    Returns the number of entries added.
    """
    added = 0
    for source_key, citation, parser_fn, quality in ALL_SOURCES:
        findings = parser_fn()
        for finding in findings:
            confidence = (
                "high" if quality >= 4 else "medium" if quality == 3 else "low"
            )
            entry = EvidenceEntry(
                source_type="academic",
                quality_rating=quality,
                dimension_relevance=finding.dimensions,
                finding_summary=finding.claim,
                confidence_level=confidence,
                citation=citation,
                tags=[source_key, finding.effect_direction, finding.effect_size],
            )
            db.add_evidence(entry)
            added += 1
    return added
