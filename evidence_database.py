"""
Evidence Database: Store and manage all research evidence for the skill toy
ADHD scoring framework.

Evidence Entry Schema:
  source_type       : str  — "academic" | "community" | "practitioner"
  quality_rating    : int  — 1–5 (1 = anecdote, 5 = RCT / meta-analysis)
  dimension_relevance: list[str] — which of the 5 dimensions this evidence speaks to
  finding_summary   : str  — plain-language summary of the finding
  confidence_level  : str  — "low" | "medium" | "high"

Quality rating rubric
  5 – Systematic review or RCT with adequate sample size
  4 – Controlled study, quasi-experimental, or peer-reviewed observational
  3 – Case series, expert consensus, or validated survey instrument
  2 – Single case study, grey literature, or small pilot
  1 – Forum post, anecdotal report, or unverified practitioner claim
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from typing import Dict, List, Optional

VALID_SOURCE_TYPES = {"academic", "community", "practitioner"}
VALID_DIMENSIONS = {
    "discretion",
    "progression",
    "resistance",
    "meeting_safety",
    "attention_outcomes",
}
VALID_CONFIDENCE = {"low", "medium", "high"}


@dataclass
class EvidenceEntry:
    source_type: str
    quality_rating: int          # 1–5
    dimension_relevance: List[str]
    finding_summary: str
    confidence_level: str
    citation: str                # Full citation string
    entry_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    tags: List[str] = field(default_factory=list)

    def __post_init__(self) -> None:
        if self.source_type not in VALID_SOURCE_TYPES:
            raise ValueError(
                f"source_type must be one of {VALID_SOURCE_TYPES}, got '{self.source_type}'"
            )
        if not (1 <= self.quality_rating <= 5):
            raise ValueError(
                f"quality_rating must be 1–5, got {self.quality_rating}"
            )
        invalid_dims = set(self.dimension_relevance) - VALID_DIMENSIONS
        if invalid_dims:
            raise ValueError(
                f"Unknown dimensions: {invalid_dims}. Valid: {VALID_DIMENSIONS}"
            )
        if self.confidence_level not in VALID_CONFIDENCE:
            raise ValueError(
                f"confidence_level must be one of {VALID_CONFIDENCE}"
            )

    def to_dict(self) -> dict:
        return {
            "entry_id": self.entry_id,
            "source_type": self.source_type,
            "quality_rating": self.quality_rating,
            "dimension_relevance": self.dimension_relevance,
            "finding_summary": self.finding_summary,
            "confidence_level": self.confidence_level,
            "citation": self.citation,
            "tags": self.tags,
        }


class EvidenceDatabase:
    """In-memory repository for all evidence entries used in scoring."""

    def __init__(self) -> None:
        self._entries: Dict[str, EvidenceEntry] = {}

    # ------------------------------------------------------------------ CRUD

    def add_evidence(self, entry: EvidenceEntry) -> str:
        """Persist an EvidenceEntry and return its entry_id."""
        self._entries[entry.entry_id] = entry
        return entry.entry_id

    def get_evidence(self, entry_id: str) -> Optional[EvidenceEntry]:
        return self._entries.get(entry_id)

    def list_all(self) -> List[EvidenceEntry]:
        return list(self._entries.values())

    def remove_evidence(self, entry_id: str) -> bool:
        if entry_id in self._entries:
            del self._entries[entry_id]
            return True
        return False

    # -------------------------------------------------------- Quality helpers

    def assess_quality(self, entry_id: str) -> dict:
        """Return a quality report for a single evidence entry."""
        entry = self._entries.get(entry_id)
        if entry is None:
            raise KeyError(f"No entry with id '{entry_id}'")
        label_map = {
            5: "Systematic review / RCT",
            4: "Controlled / peer-reviewed study",
            3: "Case series / expert consensus",
            2: "Pilot / grey literature",
            1: "Anecdotal / unverified",
        }
        return {
            "entry_id": entry_id,
            "quality_rating": entry.quality_rating,
            "quality_label": label_map[entry.quality_rating],
            "confidence_level": entry.confidence_level,
            "source_type": entry.source_type,
            "citation": entry.citation,
        }

    def average_quality_by_dimension(self) -> Dict[str, float]:
        """Return mean quality rating per dimension across all entries."""
        totals: Dict[str, List[int]] = {d: [] for d in VALID_DIMENSIONS}
        for entry in self._entries.values():
            for dim in entry.dimension_relevance:
                totals[dim].append(entry.quality_rating)
        return {
            dim: (sum(vals) / len(vals) if vals else 0.0)
            for dim, vals in totals.items()
        }

    # ------------------------------------------------------- Categorisation

    def categorize_by_dimension(self, dimension: str) -> List[EvidenceEntry]:
        """Return all entries relevant to a given dimension."""
        if dimension not in VALID_DIMENSIONS:
            raise ValueError(f"Unknown dimension '{dimension}'")
        return [
            e for e in self._entries.values() if dimension in e.dimension_relevance
        ]

    def categorize_by_source_type(self, source_type: str) -> List[EvidenceEntry]:
        if source_type not in VALID_SOURCE_TYPES:
            raise ValueError(f"Unknown source_type '{source_type}'")
        return [
            e for e in self._entries.values() if e.source_type == source_type
        ]

    def categorize_by_min_quality(self, min_quality: int) -> List[EvidenceEntry]:
        """Return entries at or above a minimum quality rating."""
        return [
            e for e in self._entries.values() if e.quality_rating >= min_quality
        ]

    # ------------------------------------------------------------ Reporting

    def summary_report(self) -> dict:
        """High-level summary of database contents."""
        all_entries = self.list_all()
        return {
            "total_entries": len(all_entries),
            "by_source_type": {
                st: sum(1 for e in all_entries if e.source_type == st)
                for st in VALID_SOURCE_TYPES
            },
            "by_quality_rating": {
                str(q): sum(1 for e in all_entries if e.quality_rating == q)
                for q in range(1, 6)
            },
            "average_quality_by_dimension": self.average_quality_by_dimension(),
            "dimension_coverage": {
                dim: len(self.categorize_by_dimension(dim))
                for dim in VALID_DIMENSIONS
            },
        }
